<template>
    <div class="outer1">
        <div class="container">
            <div class="bar">
                <div class="title">{{ $t('shakeDetect.title') }}</div>
                <label class="capture">
                    <input type="checkbox" v-model="captureEnabled" />
                    <span>{{ $t('shakeDetect.capture') }}</span>
                </label>
            </div>

            <div class="header">
                <div class="col location">{{ $t('shakeDetect.location') }}</div>
                <div class="col time">{{ $t('shakeDetect.origin_time') }}</div>
                <div class="col max">{{ $t('shakeDetect.max_intensity') }}</div>
                <div class="col depth">{{ $t('shakeDetect.depth') }}</div>
                <div class="col obs">{{ $t('shakeDetect.obs_count') }}</div>
            </div>

            <div class="list" v-if="items.length">
                <div class="row" v-for="item in items" :key="item.id" @click="handleRowClick(item, $event)">
                    <div class="col location">
                        <div class="main">{{ item.epicenterName || '-' }}</div>
                        <div class="sub">{{ formatSource(item) }}</div>
                    </div>
                    <div class="col time">
                        <div class="main">{{ item.originTimeText || '-' }}</div>
                        <div class="sub">UTC+{{ item.timeZone }}</div>
                    </div>
                    <div class="col max">
                        <div class="main">{{ item.maxShindo || '-' }}</div>
                        <div class="sub">{{ $t('shakeDetect.click_hint') }}</div>
                    </div>
                    <div class="col depth">
                        {{ Number.isFinite(item.depthKm) ? `${Math.round(item.depthKm)}km` : '-' }}
                    </div>
                    <div class="col obs">
                        {{ Number.isInteger(item.obsCount) ? item.obsCount : '-' }}
                    </div>
                </div>
            </div>

            <div class="empty" v-else>
                {{ $t('shakeDetect.empty') }}
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed, onBeforeMount } from 'vue';
import { useShakeDetectionsStore } from '@/stores/shakeDetections';
import { useSettingsStore } from '@/stores/settings';
import { useTimeStore } from '@/stores/time';

const shakeDetectionsStore = useShakeDetectionsStore();
const settingsStore = useSettingsStore();
const timeStore = useTimeStore();

onBeforeMount(() => {
    if (!shakeDetectionsStore.hydrated) {
        shakeDetectionsStore.hydrateFromStorage(localStorage.getItem('shakeDetections'));
    }
});

const items = computed(() => shakeDetectionsStore.sortedItems);

const captureEnabled = computed({
    get: () => !!shakeDetectionsStore.captureEnabled,
    set: (v) => shakeDetectionsStore.setCaptureEnabled(!!v),
});

function formatSource(item) {
    if (item.kind === 'tsunami') return 'TSUNAMI';
    if (item.source === 'niedkmoni') return 'NIEDkmoni';
    if (item.source === 'nied') return 'NIED';
    if (item.source === 'palert') return 'P-Alert';
    return item.source || '-';
}

function parseOriginTimeTextToUtcMs(originTimeText, timeZone) {
    if (!originTimeText || !Number.isInteger(timeZone)) return NaN;
    const m = String(originTimeText).trim().match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return NaN;
    const yyyy = Number(m[1]);
    const MM = Number(m[2]);
    const dd = Number(m[3]);
    const hh = Number(m[4]);
    const mm = Number(m[5]);
    const ss = Number(m[6]);
    if (![yyyy, MM, dd, hh, mm, ss].every(Number.isFinite)) return NaN;
    return Date.UTC(yyyy, MM - 1, dd, hh - timeZone, mm, ss);
}

function handleRowClick(item, ev) {
    if (!item || item.kind !== 'shake') return;
    if (ev && (ev.ctrlKey || ev.metaKey)) {
        shakeDetectionsStore.removeItem(item.id);
        return;
    }
    const originUtcMs = parseOriginTimeTextToUtcMs(item.originTimeText, item.timeZone);
    if (!Number.isFinite(originUtcMs)) return;

    // 発生時刻の5秒前へシークする（delayは分単位だが小数で秒まで表現できる）
    const targetUtcMs = originUtcMs - 5000;
    const nowMs = timeStore.getTimeStamp();
    const delayMin = (nowMs - targetUtcMs) / 60000;
    settingsStore.mainSettings.displaySeisNet.delay = Math.max(0, delayMin);
}
</script>

<style lang="scss" scoped>
.outer1 {
    width: 100%;

    .container {
        width: 100%;
        padding: 5px;
        padding-right: calc(100% - 395px);
        display: flex;
        flex-direction: column;
        gap: 8px;

        .bar {
            width: 100%;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: space-between;

            .capture {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 12px;
                opacity: 0.8;
                user-select: none;

                input {
                    width: 14px;
                    height: 14px;
                }
            }

            .title {
                font-size: 24px;
                font-weight: 700;
            }
        }

        .header {
            width: 100%;
            display: grid;
            grid-template-columns: 1.4fr 1.1fr 0.6fr 0.6fr 0.7fr;
            gap: 8px;
            padding: 0 4px;
            font-size: 12px;
            opacity: 0.7;
        }

        .list {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .row {
            width: 100%;
            display: grid;
            grid-template-columns: 1.4fr 1.1fr 0.6fr 0.6fr 0.7fr;
            gap: 8px;
            padding: 6px 4px;
            border-radius: 8px;
            background-color: #ffffff;
            border: #dcdfe6 1px solid;
            cursor: pointer;

            .col {
                min-width: 0;
                display: flex;
                flex-direction: column;
                justify-content: center;

                &.depth,
                &.obs {
                    align-items: flex-end;
                }

                &.max {
                    align-items: flex-end;
                }

                .main {
                    font-size: 14px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .sub {
                    font-size: 11px;
                    opacity: 0.65;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
            }

            .col.time {
                align-items: flex-start;

                .main {
                    font-size: 12px;
                    white-space: normal;
                    overflow: visible;
                    text-overflow: clip;
                    word-break: break-word;
                    line-height: 1.15;
                }
            }
        }

        .empty {
            width: 100%;
            padding: 12px 4px;
            font-size: 14px;
            opacity: 0.7;
        }
    }
}
</style>
