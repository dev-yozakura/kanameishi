<template>
    <div class="outer">
        <div class="container">
            <div class="title">CWA OpenData</div>
            <div class="receive" v-if="!apiKey">APIキー未設定（設定から入力してください）</div>
            <div class="receive" v-else-if="loading">読み込み中...</div>
            <div class="receive" v-else-if="error">{{ error }}</div>
            <div class="receive" v-else-if="items.length === 0">データなし</div>

            <div v-else class="list">
                <div
                    class="info"
                    v-for="item in items"
                    :key="item.id"
                    :style="{ border: `var(--${item.className}) 2px solid` }"
                    @click="openItem(item)"
                >
                    <div class="background" :class="item.className"></div>
                    <div class="intensity" :class="item.className">
                        <div class="intensity-title">最大震度</div>
                        <div class="shindo">{{ item.maxIntensityDisplay }}</div>
                    </div>
                    <div class="right">
                        <div class="location">{{ item.location || item.reportContent || '震源 調査中' }}</div>
                        <div class="time">{{ item.originTime }} (UTC+8)</div>
                        <div class="bottom">
                            <div class="magnitude">M{{ item.magnitudeText }}</div>
                            <div class="depth">{{ item.depthText }}</div>
                            <div class="source">CWA</div>
                        </div>
                    </div>
                    <div class="buttons" @click.stop>
                        <el-button class="button" type="warning" plain @click.stop="openUrl(item.web)">查看网页</el-button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import '@/assets/background.css';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useSettingsStore } from '@/stores/settings';
import Http from '@/classes/Http';
import { openUrl, setClassName } from '@/utils/Utils';

const settingsStore = useSettingsStore();

const apiKey = computed(() => (settingsStore.advancedSettings.tokens.cwa_opendata || '').trim());

const loading = ref(false);
const error = ref('');
const items = ref([]);

const ENDPOINTS = [
    'https://opendata.cwa.gov.tw/api/v1/rest/datastore/E-A0015-001',
    'https://opendata.cwa.gov.tw/api/v1/rest/datastore/E-A0016-001',
];

const getByPath = (obj, path) => {
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
};

const firstDefined = (obj, paths) => {
    for(const path of paths) {
        const value = getByPath(obj, path);
        if(value !== undefined && value !== null && value !== '') return value;
    }
    return undefined;
};

const extractRecordArray = (data) => {
    const records = data?.records;
    if(Array.isArray(records)) return records;
    if(records && typeof records === 'object') {
        const values = Object.values(records);
        const arr = values.find(v => Array.isArray(v));
        if(arr) return arr;
    }
    return [];
};

const normalizeIntensity = (value) => {
    if(!value) return '';
    const s = String(value).trim();
    if(s.endsWith('級')) return s.slice(0, -1);
    return s;
};

const intensityRank = (value) => {
    const s = normalizeIntensity(value);
    if(!s) return -1;
    const base = Number.parseInt(s, 10);
    if(Number.isFinite(base)) {
        if(s.includes('強')) return base + 0.5;
        return base;
    }
    return -1;
};

const getMaxIntensity = (record) => {
    const areas = record?.Intensity?.ShakingArea;
    if(Array.isArray(areas)) {
        const candidates = areas.map(a => a?.AreaIntensity).filter(Boolean);
        if(candidates.length) {
            let best = candidates[0];
            for(const c of candidates) {
                if(intensityRank(c) > intensityRank(best)) best = c;
            }
            return best;
        }
    }

    const reportContent = firstDefined(record, ['ReportContent', 'reportContent']);
    if(reportContent) {
        const m = String(reportContent).match(/最大震度.*?([0-9]+級|[0-9]+[弱強])/);
        if(m?.[1]) return m[1];
    }
    return '';
};

const normalize = (record) => {
    const earthquakeNo = firstDefined(record, [
        'EarthquakeNo',
        'earthquakeNo',
        'EarthquakeInfo.EarthquakeNo',
        'EarthquakeInfo.earthquakeNo'
    ]);

    const originTime = firstDefined(record, [
        'OriginTime',
        'originTime',
        'EarthquakeInfo.OriginTime',
        'EarthquakeInfo.originTime'
    ]);

    const magnitudeValue = firstDefined(record, [
        'MagnitudeValue',
        'magnitudeValue',
        'EarthquakeInfo.MagnitudeValue',
        'EarthquakeInfo.magnitudeValue',
        'EarthquakeInfo.EarthquakeMagnitude.MagnitudeValue',
        'EarthquakeInfo.Magnitude.MagnitudeValue'
    ]);

    const focalDepth = firstDefined(record, [
        'FocalDepth',
        'focalDepth',
        'EarthquakeInfo.FocalDepth',
        'EarthquakeInfo.focalDepth'
    ]);

    const web = firstDefined(record, [
        'Web',
        'web',
        'ReportURL',
        'reportURL'
    ]);

    const location = firstDefined(record, [
        'EarthquakeInfo.Epicenter.Location',
        'Epicenter.Location',
        'Location',
        'location'
    ]);

    const reportContent = firstDefined(record, ['ReportContent', 'reportContent']);

    const maxIntensityRaw = getMaxIntensity(record);
    const maxIntensityNormalized = normalizeIntensity(maxIntensityRaw);
    const className = setClassName(maxIntensityNormalized || '0', true, false);

    const magnitude = magnitudeValue !== undefined ? Number(magnitudeValue) : undefined;
    const depth = focalDepth !== undefined ? Number(focalDepth) : undefined;

    return {
        id: String(earthquakeNo || originTime || Math.random()),
        earthquakeNo,
        originTime: originTime || '-',
        magnitude,
        depth,
        web,
        location,
        reportContent,
        maxIntensityDisplay: maxIntensityNormalized || '?',
        className,
    };
};

const load = async () => {
    error.value = '';
    items.value = [];

    if(!apiKey.value) return;

    loading.value = true;
    try {
        const results = await Promise.all(
            ENDPOINTS.map(url => Http.get(`${url}?Authorization=${encodeURIComponent(apiKey.value)}`))
        );

        const all = results
            .filter(Boolean)
            .flatMap(data => extractRecordArray(data))
            .map(normalize)
            .filter(item => item.originTime && item.originTime !== '-')
            .filter(item => !Number.isNaN(item.magnitude) || !Number.isNaN(item.depth));

        const byId = new Map();
        for(const item of all) {
            byId.set(item.earthquakeNo || item.originTime, item);
        }

        const sorted = Array.from(byId.values()).sort((a, b) => {
            const at = Date.parse(a.originTime);
            const bt = Date.parse(b.originTime);
            if(Number.isFinite(at) && Number.isFinite(bt)) return bt - at;
            return String(b.originTime).localeCompare(String(a.originTime));
        });

        items.value = sorted.slice(0, 6).map(it => ({
            ...it,
            magnitudeText: Number.isFinite(it.magnitude) ? it.magnitude.toFixed(1) : '?',
            depthText: Number.isFinite(it.depth) ? `${it.depth.toFixed(0)}km` : '?'
        }));
    } catch (e) {
        console.log(e);
        error.value = '取得に失敗しました';
    } finally {
        loading.value = false;
    }
};

const openItem = (item) => {
    if(item?.web) openUrl(item.web);
    else openUrl('https://opendata.cwa.gov.tw/');
};

let timerId = null;

onMounted(() => {
    load();
    timerId = setInterval(load, 60_000);
});

onBeforeUnmount(() => {
    if(timerId) clearInterval(timerId);
});

watch(apiKey, () => {
    load();
});
</script>

<style lang="scss" scoped>
.outer{
    width: 100%;
    .container{
        position: relative;
        overflow: hidden;
        width: 100%;
        padding: 10px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        background-color: var(--tsunami-gray);
        border-radius: 10px;
        user-select: none;
        .title {
            font-size: 24px;
            font-weight: 700;
        }
        .receive {
            color: #7f7f7f;
            font-size: 14px;
            text-align: center;
        }
        .list {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        .info{
            width: 100%;
            height: 80px;
            border-radius: 12px;
            overflow: hidden;
            display: flex;
            gap: 7px;
            align-items: center;
            pointer-events: auto;
            position: relative;
            cursor: pointer;
            &:hover .buttons {
                display: flex;
            }
            * {
                z-index: 1;
            }
            .background {
                position: absolute;
                width: 100%;
                height: 100%;
                z-index: 0;
                opacity: 0.2;
            }
            .intensity{
                width: 78px;
                flex-shrink: 0;
                height: 100%;
                padding-right: 2px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                position: relative;
                pointer-events: none;
                .intensity-title{
                    height: 16px;
                    font-size: 13px;
                    line-height: 1;
                    position: absolute;
                    top: 2px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                .shindo{
                    height: 64px;
                    text-align: center;
                    letter-spacing: -4px;
                    padding-right: 4px;
                    position: absolute;
                    bottom: 4px;
                    font-size: 44px;
                }
                .shindo::first-letter{
                    font-size: 64px;
                    vertical-align: top;
                }
            }
            .right{
                flex: 1;
                min-width: 0;
                height: 100%;
                display: flex;
                flex-direction: column;
                justify-content: space-evenly;
                line-height: 1;
                vertical-align: middle;
                padding-top: 2px;
                .location{
                    width: 100%;
                    font-size: 24px;
                    white-space: nowrap;
                    text-overflow: ellipsis;
                    overflow: hidden;
                }
                .time{
                    width: 100%;
                    font-size: 20px;
                    white-space: nowrap;
                    text-overflow: ellipsis;
                    overflow: hidden;
                }
                .bottom{
                    width: 100%;
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    overflow: hidden;
                    white-space: nowrap;
                    .magnitude{
                        font-size: 20px;
                    }
                    .depth{
                        font-size: 20px;
                    }
                    .source {
                        margin-left: auto;
                        margin-right: 4px;
                        font-size: 14px;
                        color: #7f7f7f;
                        align-self: flex-end;
                    }
                }
            }
            .buttons {
                width: 100%;
                height: 100%;
                position: absolute;
                background-color: #ffffff9f;
                backdrop-filter: blur(1px);
                display: none;
                justify-content: space-evenly;
                align-items: center;
                z-index: 2;
                .button {
                    width: 88px;
                    height: 32px;
                }
            }
        }
    }
}
</style>
