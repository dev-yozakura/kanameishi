<template>
    <div class="outer1">
        <div class="container">
            <div class="bar">
                <div class="title">{{ $t('shakeDetect.title') }}</div>
            </div>

            <div class="header">
                <div class="col location">{{ $t('shakeDetect.location') }}</div>
                <div class="col time">{{ $t('shakeDetect.origin_time') }}</div>
                <div class="col depth">{{ $t('shakeDetect.depth') }}</div>
                <div class="col obs">{{ $t('shakeDetect.obs_count') }}</div>
            </div>

            <div class="list" v-if="items.length">
                <div class="row" v-for="item in items" :key="item.id">
                    <div class="col location">
                        <div class="main">{{ item.epicenterName || '-' }}</div>
                        <div class="sub">{{ formatSource(item) }}</div>
                    </div>
                    <div class="col time">
                        <div class="main">{{ item.originTimeText || '-' }}</div>
                        <div class="sub">UTC+{{ item.timeZone }}</div>
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

const shakeDetectionsStore = useShakeDetectionsStore();

onBeforeMount(() => {
    if (!shakeDetectionsStore.hydrated) {
        shakeDetectionsStore.hydrateFromStorage(localStorage.getItem('shakeDetections'));
    }
});

const items = computed(() => shakeDetectionsStore.sortedItems);

function formatSource(item) {
    if (item.kind === 'tsunami') return 'TSUNAMI';
    if (item.source === 'niedkmoni') return 'NIEDkmoni';
    if (item.source === 'nied') return 'NIED';
    if (item.source === 'palert') return 'P-Alert';
    return item.source || '-';
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

            .title {
                font-size: 24px;
                font-weight: 700;
            }
        }

        .header {
            width: 100%;
            display: grid;
            grid-template-columns: 1.4fr 1.1fr 0.6fr 0.7fr;
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
            grid-template-columns: 1.4fr 1.1fr 0.6fr 0.7fr;
            gap: 8px;
            padding: 6px 4px;
            border-radius: 8px;
            background-color: #ffffff;
            border: #dcdfe6 1px solid;

            .col {
                min-width: 0;
                display: flex;
                flex-direction: column;
                justify-content: center;

                &.depth,
                &.obs {
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
