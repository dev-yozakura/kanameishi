<template>
    <div class="outer">
        <div class="container">
            <div class="mapContainer">
                <div id="mainMap" @wheel.passive="handleManual" @dblclick="handleManual"></div>
                <div class="eewList">
                    <div class="event" v-for="(event, index) of currentEewInfoItems" :key="index" v-show="menuId != 'eqlists'">
                        <div class="eew">
                            <div class="bar" :class="getBarClass(event)">
                                <div><WarnTriangleFilled style="width: 1em; height: 1em; margin-right: 0.25em;" />{{ event.eqMessage.titleText + ' ' + event.eqMessage.reportNumText }}</div>
                                <div v-show="activeEewList.length > 1">{{ activeEewList.findIndex(e => e == event) + 1 }}/{{ activeEewList.length }}</div>
                            </div>
                            <div class="info" @click="() => {
                                event.handleClick();
                                infoPageCounter = infoPageCounter - infoPageCounter % 10;
                            }">
                                <div class="background" :class="event.eqMessage.className"></div>
                                <div v-if="event.eqMessage.useShindo" class="intensity" :class="event.eqMessage.className">
                                    <div class="intensity-title">{{ $t('mainMap.eew.max_intensity') }}</div>
                                    <div :class="formatShindo(event.eqMessage.maxIntensity) != '?'?'shindo':'csis'">
                                        {{ formatShindo(event.eqMessage.maxIntensity) }}
                                    </div>
                                </div>
                                <div v-else class="intensity" :class="event.eqMessage.className">
                                    <div class="intensity-title">{{ $t('mainMap.eew.max_csis') }}</div>
                                    <div class="csis" :class="{
                                        'roman': settingsStore.mainSettings.useRomanCsis,
                                        'scale-75': event.eqMessage.maxIntensity == '8',
                                        'scale-9': event.eqMessage.maxIntensity == '7' || event.eqMessage.maxIntensity == '12'
                                    }">
                                        {{ formatCsis(event.eqMessage.maxIntensity, settingsStore.mainSettings.useRomanCsis) }}
                                    </div>
                                </div>
                                <div class="right">
                                    <div class="location">{{ event.eqMessage.hypocenter }}</div>
                                    <div class="time">{{ event.eqMessage.originTime + ` (${formatTimeZone(event.eqMessage.timeZone)})` }}</div>
                                    <div class="bottom">
                                        <div class="magnitude">{{ event.eqMessage.isAssumption? $t('mainMap.eew.assumed_hypocenter') : $t('mainMap.eew.magnitude') + event.eqMessage.magnitude.toFixed(1) }}</div>
                                        <div class="depth">{{ event.eqMessage.isAssumption?'':event.eqMessage.depthText }}</div>
                                        <div class="type" v-if="settingsStore.advancedSettings.displayApiType">{{ sourceTypes[event.eqMessage.source][event.eqMessage.type] }}</div>
                                    </div>
                                </div>
                                <div class="eew-buttons" v-if="event.showMenu">
                                    <el-button class="eew-button" type="primary" plain @click="event.mute = !event.mute">{{ event.mute ? $t('mainMap.eew.unmute') : $t('mainMap.eew.mute') }}</el-button>
                                    <el-button class="eew-button" type="danger" plain @click.stop="event.terminate(true)">{{ $t('mainMap.eew.close_alert') }}</el-button>
                                </div>
                            </div>
                        </div>
                        <div class="countdown eew realtime" v-if="settingsStore.mainSettings.displayCountdown">
                            <div class="shindo-bar" @dblclick="event.showPCountdown = !event.showPCountdown"
                            :class="event.showPCountdown ? 'blue' 
                            : event.countdown < 0 || event.eqMessage.isCanceled ? 'gray' 
                            : event.countdown <= 15 ? 'red' 
                            : event.countdown <= 60 ? 'orange' 
                            : 'yellow'">
                                {{ event.countdown == -1 ? '-' : Math.ceil(event.showPCountdown ? event.pCountdown : event.countdown) }}秒
                            </div>
                            <div class="info" v-if="event.nearestJmaLoc">
                                <div class="intensity" :class="setClassName(event.userShindo, true, event.eqMessage.isCanceled)">
                                    <div class="intensity-title">{{ $t('mainMap.eew.local_intensity') }}</div>
                                    <div :class="event.userShindo != '?'?'shindo':'csis'">
                                        {{ event.userShindo }}
                                    </div>
                                </div>
                            </div>
                            <div class="info" v-else>
                                <div class="intensity" :class="setClassName(event.userCsis, false, event.eqMessage.isCanceled)">
                                    <div class="intensity-title">{{ $t('mainMap.eew.local_csis') }}</div>
                                    <div class="csis" :class="{
                                        'roman': settingsStore.mainSettings.useRomanCsis,
                                        'scale-75': event.userCsis == '8',
                                        'scale-9': event.userCsis == '7' || event.userCsis == '12'
                                    }">
                                        {{ formatCsis(event.userCsis, settingsStore.mainSettings.useRomanCsis) }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="event" v-for="(event, index) of currentEqlistInfoItems" :key="index" v-show="menuId != 'eews'">
                        <div class="eew">
                            <div class="bar" :class="getBarClass(event)">
                                <div><InfoFilled style="width: 1em; height: 1em; margin-right: 0.25em;" />{{ event.eqMessage.titleText }}</div>
                                <div v-show="displayEqlistList.length > 1">{{ displayEqlistList.findIndex(e => e == event) + 1 }}/{{ displayEqlistList.length }}</div>
                            </div>
                            <div class="info" @click="() => {
                                event.handleClick();
                                infoPageCounter = infoPageCounter - infoPageCounter % 10;
                            }">
                                <div class="background" :class="event.eqMessage.className"></div>
                                <div v-if="event.eqMessage.useShindo" class="intensity" :class="event.eqMessage.className">
                                    <div class="intensity-title">{{ $t('mainMap.eew.max_intensity') }}</div>
                                    <div :class="formatShindo(event.eqMessage.maxIntensity) != '?'?'shindo':'csis'">
                                        {{ formatShindo(event.eqMessage.maxIntensity) }}
                                    </div>
                                </div>
                                <div v-else class="intensity" :class="event.eqMessage.className">
                                    <div class="intensity-title">{{ $t('mainMap.eew.max_csis') }}</div>
                                    <div class="csis" :class="{
                                        'roman': settingsStore.mainSettings.useRomanCsis,
                                        'scale-75': event.eqMessage.maxIntensity == '8',
                                        'scale-9': event.eqMessage.maxIntensity == '7' || event.eqMessage.maxIntensity == '12'
                                    }">
                                        {{ formatCsis(event.eqMessage.maxIntensity, settingsStore.mainSettings.useRomanCsis) }}
                                    </div>
                                </div>
                                <div class="right">
                                    <div class="location">{{ event.eqMessage.hypocenter || $t('mainMap.eqlist.location_ongoing') }}</div>
                                    <div class="time">{{ event.eqMessage.originTime + ` (${formatTimeZone(event.eqMessage.timeZone)})` }}</div>
                                    <div class="bottom">
                                        <div class="magnitude">{{ event.eqMessage.magnitude != -1 ? $t('mainMap.eqlist.magnitude') + event.eqMessage.magnitude.toFixed(1) : $t('mainMap.eqlist.magnitude_ongoing') }}</div>
                                        <div class="depth">{{ event.eqMessage.depth != -1 ? event.eqMessage.depthText : '' }}</div>
                                        <div class="type" v-if="settingsStore.advancedSettings.displayApiType">{{ sourceTypes[event.eqMessage.source][event.eqMessage.type] }}</div>
                                    </div>
                                </div>
                                <div class="eew-buttons" v-if="event.showMenu">
                                    <el-button 
                                    class="eew-button" 
                                    type="danger" 
                                    plain 
                                    :disabled="!event.isActive"
                                    @click.stop="() => {
                                        if(tempEqlists == event.eqMessage.source) {
                                            tempEqlists = ''
                                        }
                                        event.deactivate()
                                    }"
                                    >{{ $t('mainMap.eqlist.close_info') }}</el-button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="event" v-if="settingsStore.mainSettings.source.nmefcTsunami && statusStore.isActive.nmefcTsunami">
                        <div class="eew" v-show="menuId != 'eews'">
                            <div class="bar" :class="statusStore.tsunamiMessage.nmefcTsunami.className">
                                <div><WarnTriangleFilled style="width: 1em; height: 1em; margin-right: 0.25em;" />{{ statusStore.tsunamiMessage.nmefcTsunami.titleText }}</div>
                            </div>
                            <div class="tsunami-info">
                                <div class="background" :class="statusStore.tsunamiMessage.nmefcTsunami.className"></div>
                                <div v-show="statusStore.tsunamiMessage.nmefcTsunami.status >= 3" class="legend tsunami-purple"></div>
                                <div v-show="statusStore.tsunamiMessage.nmefcTsunami.status >= 3" class="text">{{ $t('mainMap.tsunami.major_warning') }}</div>
                                <div v-show="statusStore.tsunamiMessage.nmefcTsunami.status >= 2" class="legend tsunami-red"></div>
                                <div v-show="statusStore.tsunamiMessage.nmefcTsunami.status >= 2" class="text">{{ $t('mainMap.tsunami.warning') }}</div>
                                <div v-show="statusStore.tsunamiMessage.nmefcTsunami.status >= 1" class="legend tsunami-yellow"></div>
                                <div v-show="statusStore.tsunamiMessage.nmefcTsunami.status >= 1" class="text">{{ $t('mainMap.tsunami.advisory') }}</div>
                            </div>
                        </div>
                    </div>
                    <div class="event" v-if="settingsStore.mainSettings.source.jmaTsunami && statusStore.isActive.jmaTsunami">
                        <div class="eew" v-show="menuId != 'eews'">
                            <div class="bar" :class="statusStore.tsunamiMessage.jmaTsunami.className">
                                <div><WarnTriangleFilled style="width: 1em; height: 1em; margin-right: 0.25em;" />{{ statusStore.tsunamiMessage.jmaTsunami.titleText }}</div>
                            </div>
                            <div class="tsunami-info">
                                <div class="background" :class="statusStore.tsunamiMessage.jmaTsunami.className"></div>
                                <div v-show="statusStore.tsunamiMessage.jmaTsunami.status >= 3" class="legend tsunami-purple"></div>
                                <div v-show="statusStore.tsunamiMessage.jmaTsunami.status >= 3" class="text">{{ $t('mainMap.tsunami.jma_major_warning') }}</div>
                                <div v-show="statusStore.tsunamiMessage.jmaTsunami.status >= 2" class="legend tsunami-red"></div>
                                <div v-show="statusStore.tsunamiMessage.jmaTsunami.status >= 2" class="text">{{ $t('mainMap.tsunami.jma_warning') }}</div>
                                <div v-show="statusStore.tsunamiMessage.jmaTsunami.status >= 1" class="legend tsunami-yellow"></div>
                                <div v-show="statusStore.tsunamiMessage.jmaTsunami.status >= 1" class="text">{{ $t('mainMap.tsunami.jma_advisory') }}</div>
                            </div>
                        </div>
                    </div>
                    <div class="event">
                        <div class="eew realtime" v-if="settingsStore.mainSettings.displaySeisNet.niedNet && settingsStore.mainSettings.displaySeisNet.displayNiedShindo">
                            <div class="shindo-bar gray">{{ $t('mainMap.realtime.nied_realtime') }}</div>
                            <div class="info">
                                <div class="intensity" :class="setClassName(niedMaxShindo, true)">
                                    <div class="intensity-title">{{ $t('mainMap.eew.max_intensity') }}</div>
                                    <div :class="niedMaxShindo != '?'?'shindo':'csis'">
                                        {{ niedMaxShindo }}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="eew realtime" v-if="settingsStore.mainSettings.displaySeisNet.niedNet && settingsStore.mainSettings.displaySeisNet.displayNiedShindo && niedPeriodMaxShindo != '?'">
                            <div class="shindo-bar" :class="niedPeriodBarClass">{{ $t('mainMap.realtime.nied_period') }}</div>
                            <div class="info">
                                <div class="intensity" :class="setClassName(niedPeriodMaxShindo, true)">
                                    <div class="intensity-title">{{ $t('mainMap.eew.max_intensity') }}</div>
                                    <div :class="niedPeriodMaxShindo != '?'?'shindo':'csis'">
                                        {{ niedPeriodMaxShindo }}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="eew realtime" v-if="settingsStore.mainSettings.displaySeisNet.tremNet && settingsStore.mainSettings.displaySeisNet.displayTremShindo">
                            <div class="shindo-bar gray">{{ $t('mainMap.realtime.trem_realtime') }}</div>
                            <div class="info">
                                <div class="intensity" :class="setClassName(tremMaxShindo, true)">
                                    <div class="intensity-title">{{ $t('mainMap.eew.max_intensity') }}</div>
                                    <div :class="tremMaxShindo != '?'?'shindo':'csis'">
                                        {{ tremMaxShindo }}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="eew realtime" v-if="settingsStore.mainSettings.displaySeisNet.tremNet && settingsStore.mainSettings.displaySeisNet.displayTremShindo && tremPeriodMaxShindo != '?'">
                            <div class="shindo-bar" :class="tremPeriodBarClass">{{ $t('mainMap.realtime.trem_period') }}</div>
                            <div class="info">
                                <div class="intensity" :class="setClassName(tremPeriodMaxShindo, true)">
                                    <div class="intensity-title">{{ $t('mainMap.eew.max_intensity') }}</div>
                                    <div :class="tremPeriodMaxShindo != '?'?'shindo':'csis'">
                                        {{ tremPeriodMaxShindo }}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="eew realtime" v-if="settingsStore.mainSettings.displaySeisNet.kmaNet && settingsStore.mainSettings.displaySeisNet.displayKmaInt">
                            <div class="shindo-bar gray">{{ $t('mainMap.realtime.kma_realtime') }}</div>
                            <div class="info">
                                <div class="intensity" :class="setClassName(kmaMaxInt, false)">
                                    <div class="intensity-title">{{ $t('mainMap.eew.max_csis') }}</div>
                                    <div class="csis" :class="{
                                        'roman': settingsStore.mainSettings.useRomanCsis,
                                        'scale-75': kmaMaxInt == '8',
                                        'scale-9': kmaMaxInt == '7' || kmaMaxInt == '12'
                                    }">
                                        {{ formatCsis(kmaMaxInt, settingsStore.mainSettings.useRomanCsis) }}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="eew realtime" v-if="settingsStore.mainSettings.displaySeisNet.kmaNet && settingsStore.mainSettings.displaySeisNet.displayKmaInt && kmaPeriodMaxInt != '?'">
                            <div class="shindo-bar" :class="kmaPeriodBarClass">{{ $t('mainMap.realtime.kma_period') }}</div>
                            <div class="info">
                                <div class="intensity" :class="setClassName(kmaPeriodMaxInt, false)">
                                    <div class="intensity-title">{{ $t('mainMap.eew.max_csis') }}</div>
                                    <div class="csis" :class="{
                                        'roman': settingsStore.mainSettings.useRomanCsis,
                                        'scale-75': kmaPeriodMaxInt == '8',
                                        'scale-9': kmaPeriodMaxInt == '7' || kmaPeriodMaxInt == '12'
                                    }">
                                        {{ formatCsis(kmaPeriodMaxInt, settingsStore.mainSettings.useRomanCsis) }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="left-bottom">
                    <div class="legend" v-if="settingsStore.mainSettings.displayLegend && !settingsStore.mainSettings.disableEewBaseMap && (activeEewList.length > 0 || menuId == 'eqlists')">
                        <div class="single-legend" v-for="(className, index) of classNameArray" :key="index">
                            <div class="align-right">{{ settingsStore.mainSettings.useRomanCsis ? csisRomanArray[index] : csisArray[index] }}</div>
                            <div class="color" :class="className"></div>
                            <div class="align-left">{{ shindoArray[index] }}</div>
                        </div>
                        <div class="sub-title single-legend">
                            <div class="align-right">{{ $t('mainMap.csis') }}</div>
                            <div class="color"></div>
                            <div class="align-left">{{ $t('mainMap.shindo') }}</div>
                        </div>
                        <div class="legend-title">{{ $t('mainMap.map_colors') }}</div>
                    </div>
                    <div class="ws-status">
                        <div>{{ $t('mainMap.websocket_status') }}</div>
                        <div :class="'s' + wolfxRS">Wolfx{{ wolfxUrlIndex ? '(B)' : '' }}</div>
                        <div :class="'s' + fanRS">FAN{{ fanUrlIndex ? '(B)' : '' }}</div>
                        <div :class="'s' + p2pquakeRS">P2PQ{{ p2pquakeUrlIndex ? '(B)' : '' }}</div>
                        <div v-if="settingsStore.advancedSettings.enableGqEew" :class="'s' + gqRS">GQ{{ gqUrlIndex ? '(B)' : '' }}</div>
                    </div>
                    <div class="update-time" :class="settingsStore.mainSettings.displaySeisNet.delay > 0 ? 'replay' : isNiedDelayed ? 'delayed' : ''" v-if="settingsStore.mainSettings.displaySeisNet.niedNet" @dblclick="resetSeisNetDelay">
                        {{ $t('mainMap.kyoshin_monitor') }} {{ niedUpdateTime }} (UTC+9)
                    </div>
                    <div class="update-time" :class="settingsStore.mainSettings.displaySeisNet.delay > 0 ? 'replay' : isTremDelayed ? 'delayed' : ''" v-if="settingsStore.mainSettings.displaySeisNet.tremNet" @dblclick="resetSeisNetDelay">
                        {{ $t('mainMap.trem_net') }} {{ tremUpdateTime }} (UTC+8)
                    </div>
                    <div class="update-time" :class="isKmaDelayed ? 'delayed' : ''" v-if="settingsStore.mainSettings.displaySeisNet.kmaNet" @dblclick="resetSeisNetDelay">
                        {{ $t('mainMap.kma_pews') }} {{ kmaUpdateTime }} (UTC+9)
                    </div>
                    <div class="update-time" :class="isMsilDelayed ? 'delayed' : ''" v-if="settingsStore.mainSettings.displaySeisNet.msilNet" @dblclick="resetSeisNetDelay">
                        {{ $t('settings.seisNet.msil_net') }} {{ msilUpdateTime }} (UTC+9)
                    </div>
                </div>
                <div class="int-list" v-if="settingsStore.mainSettings.displayAreaIntensities">
                    <div class="csis-list" v-show="csisList.length">
                        <div class="row" v-for="(item, index) of csisList" :key="index">
                            <div class="name">{{ item.name }}</div>
                            <div class="int" :class="setClassName(item.intensity, false)">
                                <div class="csis" :class="{
                                    'roman': settingsStore.mainSettings.useRomanCsis,
                                    'scale-9': item.intensity == '8'
                                }">{{ formatCsis(item.intensity, settingsStore.mainSettings.useRomanCsis) }}</div>
                            </div>
                        </div>
                    </div>
                    <div class="shindo-list" v-show="shindoList.length">
                        <div class="row" v-for="(item, index) of shindoList" :key="index">
                            <div class="name">{{ item.name }}</div>
                            <div class="int" :class="setClassName(item.intensity, true)">
                                <div class="shindo">{{ item.intensity }}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="bottom-right">
                    <div class="mocking" v-if="statusStore.isActive.mockEew" :class="blinkStatus ? 'mock-1' : 'mock-0'">{{ $t('mainMap.mock_eew_in_progress') }}</div>
                    <el-button
                    class="home"
                    :icon="HomeFilled"
                    v-show="!isAutoZoom"
                    @click="handleHome"></el-button>
                </div>
                <el-menu
                class="menu"
                :default-active="menuId"
                :collapse="true"
                @select="handleMenu">
                    <el-menu-item index="main">
                        <el-icon>
                            <FullScreen />
                        </el-icon>
                    </el-menu-item>
                    <el-menu-item index="eews">
                        <el-icon>
                            <WarnTriangleFilled />
                        </el-icon>
                    </el-menu-item>
                    <el-menu-item index="eqlists">
                        <el-icon>
                            <InfoFilled />
                        </el-icon>
                    </el-menu-item>
                    <el-menu-item index="settings">
                        <el-icon>
                            <Setting />
                        </el-icon>
                    </el-menu-item>
                </el-menu>
            </div>
            <div class="drawer" ref="drawer" v-show="menuId == 'eqlists' && !settingsStore.mainSettings.hideDrawer || menuId == 'settings'">
                <EqlistComponent v-show="menuId == 'eqlists'" />
                <SettingsComponent v-show="menuId == 'settings'" />
            </div>
            <transition name="dialog-fade">
                <div class="statusContainer" v-show="statusStore.showStatusPanel">
                    <StatusComponent />
                </div>
            </transition>
        </div>
    </div>
</template>

<script setup>
import L from 'leaflet';
import 'leaflet.vectorgrid';
import 'leaflet/dist/leaflet.css';
import '@/assets/background.css';
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, watchEffect, provide } from 'vue';
import { HomeFilled, FullScreen, WarnTriangleFilled, InfoFilled, Setting } from '@element-plus/icons-vue';
import { eewSources, eqlistSources, seisNetSources, sourceTypes, tsunamiSources, useStatusStore } from '@/stores/status';
import { useSettingsStore } from '@/stores/settings';
import { useTimeStore } from '@/stores/time';
import EqlistComponent from './EqlistComponent.vue';
import SettingsComponent from './SettingsComponent.vue';
import { verifyUpToDate, setClassName, getClassLevel, classNameArray, pointDistToCnArea, csisArray, shindoArray, calcCsisLevel, calcJmaShindoLevel, formatTimeZone, simplifyTopoJson, formatCsis, csisRomanArray, formatShindo, stampToTime, getShindoFromInstShindo, getLevelFromInstShindo, playSound, sendMyNotification, focusWindow } from '@/utils/Utils';
import { topojsonUrls, iconUrls } from '@/utils/Urls';
import { jmaSeisIntLoc } from '@/utils/JmaSeisIntLoc';
import { isTauri } from '@tauri-apps/api/core';
import { storeToRefs } from 'pinia';
import { simpleIcon, computeNiedStyleColorRadius } from '@/classes/StationClasses';
import { feature } from 'topojson-client';
import { cnCityLabels, cnProvinceLabels, jpPrefLabels } from '@/utils/Labels';
import terminator from '@joergdietrich/leaflet.terminator';
import StatusComponent from './StatusComponent.vue';

const style = window.getComputedStyle(document.body)
const classNameColors = {}, tsunamiColors = {}
classNameArray.forEach(color => classNameColors[color] = style.getPropertyValue(`--${color}`).trim())
classNameArray.forEach(color => tsunamiColors[color] = style.getPropertyValue(`--tsunami-${color}`).trim())
const statusStore = useStatusStore()
const settingsStore = useSettingsStore()
const timeStore = useTimeStore()
let map, jpEewBaseMap, cnEewBaseMap, jpTsunamiBaseMap, cnTsunamiBaseMap, labelLayer1, labelLayer2, terminatorLayer, terminatorFillLayer, cnFaultBaseMap
let eewMarkerPane, eqlistMarkerPane, historyMarkerPane, wavePane, waveFillPane, niedGridPane, tremGridPane, kmaGridPane, msilNetPane, msilNetLayer, tremRtsLayer, eewBasePane, tsunamiBasePane, labelPane1, labelPane2
let msilWorker
let userMarker
let kanameishiMarker
let jpSeedlinkStationsLayer
const jpStationWaveWindows = new Map()
const kanameishiLatLng = [27.06, 142.208]
const defaultLatLng = [38.1, 104.6]
const { isValidUserLatLng, isValidViewLatLng, isDisplayUser, nearestJmaLoc } = storeToRefs(settingsStore)
const userLatLng = computed(() => settingsStore.mainSettings.userLatLng)
const viewLatLng = computed(() => settingsStore.mainSettings.viewLatLng)
const zoomLevel = ref(settingsStore.mainSettings.defaultZoom)
const resetSeisNetDelay = () => settingsStore.mainSettings.displaySeisNet.delay = 0
const tempEqlists = ref('')
let tempEqlistsTimer
const handleTempEqlists = (time, source = '') => {
    clearTimeout(tempEqlistsTimer)
    if(time && source) {
        clearHistoryList()
        tempEqlists.value = source
        tempEqlistsTimer = setTimeout(() => {
            tempEqlists.value = ''
            smartSetView()
        }, time);
    }
    else {
        tempEqlists.value = ''
    }
}

const applyEstimatedShindoToMarker = (marker, shindoLabel) => {
    if (!marker || typeof marker.setStyle !== 'function') return
    const label = (typeof shindoLabel === 'string' && shindoLabel) ? shindoLabel : '0'
    const className = setClassName(label, true)
    const cssColor = classNameColors[className] || classNameColors['dark-gray']
    marker.setStyle({
        color: cssColor,
        fillColor: cssColor,
        opacity: 0.8,
        fillOpacity: 0.4,
        weight: 1,
    })
}

const _parseIrisStationText = (text) => {
    const lines = String(text)
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'))

    if (!lines.length) return []
    const usePipe = lines[0].includes('|')

    const out = []
    for (const line of lines) {
        const cols = usePipe ? line.split('|') : line.split(/\s+/)
        if (cols.length < 4) continue
        const net = String(cols[0] ?? '').trim()
        const sta = String(cols[1] ?? '').trim()
        const lat = Number(cols[2])
        const lon = Number(cols[3])
        if (!net || !sta) continue
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
        out.push({ net, sta, lat, lon })
    }
    return out
}

const loadJpSeedlinkStations = async () => {
    if (!map) return
    if (!jpSeedlinkStationsLayer) return

    const fetchStationText = async (net) => {
        const urls = [
            ...(import.meta.env.DEV
                ? [`/iris/fdsnws/station/1/query?net=${encodeURIComponent(net)}&level=station&format=text&nodata=404`]
                : []),
            `https://service.iris.edu/fdsnws/station/1/query?net=${encodeURIComponent(net)}&level=station&format=text&nodata=404`,
        ]

        for (const url of urls) {
            try {
                const res = await fetch(url, { cache: 'no-store' })
                if (!res.ok) continue
                const text = await res.text()
                if (text.trim()) return text
            }
            catch {
                // ignore and try next
            }
        }
        return ''
    }

    const [jpText, psText] = await Promise.all([
        fetchStationText('JP'),
        fetchStationText('PS'),
    ])

    if (!jpText.trim() && !psText.trim()) return

    const jpStations = jpText.trim() ? _parseIrisStationText(jpText).filter(s => s.net === 'JP') : []
    const psAllow = new Set(['MCSJ', 'ISG', 'INU'])
    const psStations = psText.trim()
        ? _parseIrisStationText(psText).filter(s => s.net === 'PS' && psAllow.has(s.sta))
        : []

    const stations = [...jpStations, ...psStations]

    // clear and re-render
    jpSeedlinkStationsLayer.clearLayers()

    const css = window.getComputedStyle(document.body)
    const color = css.getPropertyValue('--dark-gray').trim() || '#333333'

    const _openWaveWindow = (key, initialTitle) => {
        const existing = jpStationWaveWindows.get(key)
        if (existing?.win && !existing.win.closed) {
            existing.win.focus()
            return existing
        }

        const win = window.open('', key, 'width=360,height=260,resizable=yes,scrollbars=no')
        if (!win) return null

        win.document.title = initialTitle
        win.document.body.style.margin = '10px'
        win.document.body.style.fontFamily = 'sans-serif'

        const title = win.document.createElement('div')
        title.textContent = initialTitle
        title.style.fontWeight = '700'
        title.style.marginBottom = '6px'

        const canvas = win.document.createElement('canvas')
        canvas.style.width = '320px'
        canvas.style.height = '140px'

        const note = win.document.createElement('div')
        note.style.fontSize = '12px'
        note.style.marginTop = '6px'
        note.textContent = '読み込み中…'

        win.document.body.append(title, canvas, note)

        const state = { win, title, canvas, note, intervalId: null, marker: null }
        jpStationWaveWindows.set(key, state)

        win.addEventListener('beforeunload', () => {
            if (state.intervalId) clearInterval(state.intervalId)
            if (state.marker) applyEstimatedShindoToMarker(state.marker, '0')
            jpStationWaveWindows.delete(key)
        })

        return state
    }

    const loadStationSeries = async (net, sta, chan = 'BHZ') => {
        const res = await fetch(`/waveforms/${net}_${sta}_${chan}.json?_=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return { error: `waveforms/${net}_${sta}_${chan}.json が見つかりません（まず run_realtime_alljp.cmd を起動してください）` }
        const text2 = await res.text()
        if (!text2.trim()) return { error: 'JSONが空です' }

        let parsed2
        try {
            parsed2 = JSON.parse(text2)
        }
        catch {
            return { error: 'JSONとして読み取れません' }
        }

        const points2 = Array.isArray(parsed2) ? parsed2 : (Array.isArray(parsed2?.points) ? parsed2.points : null)
        if (!points2) return { error: 'JSON形式が不明です（配列 もしくは {points: []} を期待）' }

        const mode2 = (!Array.isArray(parsed2) && typeof parsed2?.mode === 'string') ? parsed2.mode : undefined
        const unit2 = (!Array.isArray(parsed2) && typeof parsed2?.unit === 'string') ? parsed2.unit : undefined
        const shake2 = (!Array.isArray(parsed2) && parsed2 && typeof parsed2 === 'object') ? parsed2?.shake : undefined
        const shindoEst2 = (!Array.isArray(parsed2) && parsed2 && typeof parsed2 === 'object') ? parsed2?.shindo_est : undefined

        const series2 = []
        for (const p of points2) {
            if (Array.isArray(p) && p.length >= 2) {
                const t = Number(p[0])
                const v = Number(p[1])
                if (Number.isFinite(t) && Number.isFinite(v)) series2.push({ t, v })
            }
        }
        series2.sort((a, b) => a.t - b.t)
        return { series: series2, mode: mode2, unit: unit2, shake: shake2, shindo_est: shindoEst2 }
    }

    const openStationWindow = async (marker, station) => {
        const { net, sta } = station
        const chan = 'BHZ'
        const key = `wave_${net}_${sta}_${chan}`
        const state = _openWaveWindow(key, `${net}_${sta}_${chan}`)
        if (!state) return

        state.marker = marker

        const refresh = async () => {
            if (state.win.closed) return
            const loaded = await loadStationSeries(net, sta, chan)
            if (loaded?.error) {
                state.note.textContent = loaded.error
                drawKanameishiLineChart(state.canvas, [])
                return
            }
            const mode = loaded?.mode || 'waveform'
            const unit = loaded?.unit || ''
            const series = loaded?.series || []

            const latestAll = series.length ? series[series.length - 1] : null
            let shown = series
            if (latestAll) {
                const windowMs = 3 * 60 * 1000
                const cutoff = latestAll.t - windowMs
                shown = series.filter(p => p.t >= cutoff)
            }
            const latest = shown.length ? shown[shown.length - 1] : null
            const shake = (loaded?.shake && typeof loaded.shake === 'object')
                ? loaded.shake
                : computeShakeFromSeries(shown, 180000)
            const shakeText = (shake && shake.detected) ? '揺れ検知: あり' : '揺れ検知: なし'

            const inst3c = (loaded?.inst_shindo_3c && typeof loaded.inst_shindo_3c === 'object')
                ? loaded.inst_shindo_3c
                : null

            const instLabel = (inst3c && inst3c.available && typeof inst3c.label === 'string') ? inst3c.label : null
            const estLabel = (loaded?.shindo_est && typeof loaded.shindo_est === 'object' && typeof loaded.shindo_est.label === 'string')
                ? loaded.shindo_est.label
                : estimateShindoFromSeries(shown, 180000).label
            const shindoLabel = instLabel || estLabel

            const instText = (inst3c && inst3c.available && typeof inst3c.I === 'number' && typeof inst3c.amax_gal === 'number')
                ? `計測震度I: ${inst3c.I.toFixed(2)} (amax=${inst3c.amax_gal.toFixed(1)} gal)`
                : null
            const shindoText = instText ? `${instText} / 震度: ${shindoLabel}` : `推定震度: ${shindoLabel}`

            applyEstimatedShindoToMarker(state.marker, shindoLabel)
            state.note.textContent = latest
                ? `${shindoText} / ${shakeText} / 最新: ${latest.v}${unit ? ` (${unit})` : ''}  at ${new Date(latest.t).toLocaleString()}`
                : `${shindoText} / ${shakeText} / データなし`
            state.title.textContent = mode === 'pga' ? `${net}_${sta} PGA` : `${net}_${sta} Waveform`
            state.win.document.title = state.title.textContent
            drawKanameishiLineChart(state.canvas, shown)
        }

        if (state.intervalId) clearInterval(state.intervalId)
        await refresh()
        state.intervalId = setInterval(async () => {
            if (state.win.closed) {
                if (state.intervalId) clearInterval(state.intervalId)
                jpStationWaveWindows.delete(key)
                return
            }
            await refresh()
        }, 1000)
    }

    for (const s of stations) {
        const marker = L.circleMarker([s.lat, s.lon], {
            radius: 3,
            pane: 'jpSeedlinkPane',
            interactive: true,
            color,
            weight: 1,
            opacity: 0.6,
            fillColor: color,
            fillOpacity: 0.15,
        }).addTo(jpSeedlinkStationsLayer)

        marker.on('click', () => openStationWindow(marker, s))
    }
}

const shindoTextToBin = (text) => {
    if(text === null || text === undefined) return -1
    const s = String(text)
    if(s === '?' || s === '不明') return -1
    if(s === '7') return 7
    if(s.startsWith('6')) return 6
    if(s.startsWith('5')) return 5
    const n = Number(s)
    if(Number.isFinite(n)) return Math.max(0, Math.min(4, Math.floor(n)))
    return -1
}

const instToShindoBin = (inst) => {
    if(inst === null || inst === undefined) return -1
    if(Number.isNaN(inst)) return -1
    return shindoTextToBin(getShindoFromInstShindo(inst))
}

const triggerShakeIfRising = (newVal, oldVal, flags) => {
    if(newVal > oldVal){
        if(settingsStore.mainSettings.onShake.sound){
            const type = `shindo${newVal}`
            playSound(type)
        }
        if(settingsStore.mainSettings.onShake.notification){
            if(newVal >= 1 && newVal <= 3 && !flags.shake1Notified){
                sendMyNotification('揺れを検出',
                    '揺れに注意してください。',
                    iconUrls.caution,
                    settingsStore.mainSettings.muteNotification)
                flags.shake1Notified = true
            }
            else if(newVal >= 4 && !flags.shake2Notified){
                sendMyNotification('強い揺れを検出',
                    '強い揺れに警戒してください。',
                    iconUrls.warn,
                    settingsStore.mainSettings.muteNotification)
                flags.shake1Notified = true
                flags.shake2Notified = true
            }
        }
        if(settingsStore.mainSettings.onShake.focus){
            if(newVal >= 1 && !flags.focused){
                focusWindow()
                flags.focused = true
            }
        }
        handleTempEqlists(0)
    }
    else{
        flags.shake1Notified = false
        flags.shake2Notified = false
        flags.focused = false
    }
}
provide('handleTempEqlists', handleTempEqlists)

const computeShakeFromSeries = (series, totalWindowMs = 180000) => {
    if (!Array.isArray(series) || series.length < 10) return { detected: false }
    const pts = [...series].sort((a, b) => a.t - b.t)
    const lastT = pts[pts.length - 1].t
    const curFrom = lastT - 10000
    const baseFrom = lastT - (Number.isFinite(totalWindowMs) ? totalWindowMs : 180000)
    const baseTo = lastT - 20000

    const cur = []
    const base = []
    for (const p of pts) {
        const v = Number(p.v)
        if (!Number.isFinite(v)) continue
        if (p.t >= curFrom) cur.push(v)
        else if (p.t >= baseFrom && p.t < baseTo) base.push(v)
    }
    if (!base.length) {
        for (const p of pts) {
            const v = Number(p.v)
            if (!Number.isFinite(v)) continue
            if (p.t < curFrom) base.push(v)
        }
    }

    const rms = (arr) => {
        if (!arr.length) return 0
        let s = 0
        for (const v of arr) s += v * v
        return Math.sqrt(s / arr.length)
    }
    const peak = (arr) => {
        let m = 0
        for (const v of arr) {
            const av = Math.abs(v)
            if (av > m) m = av
        }
        return m
    }

    const curRms = rms(cur)
    const baseRms = rms(base)
    const curPeak = peak(cur)
    const basePeak = peak(base)

    const eps = 1
    const baseRmsEff = Math.max(baseRms, eps)
    const basePeakEff = Math.max(basePeak, eps)

    const detected = (curRms > baseRmsEff * 6 && curPeak > basePeakEff * 6) || (curPeak > basePeakEff * 10)
    return { detected, current_rms: curRms, baseline_rms: baseRms, current_peak: curPeak, baseline_peak: basePeak }
}

const estimateShindoFromSeries = (series, totalWindowMs = 180000) => {
    const shake = computeShakeFromSeries(series, totalWindowMs)
    const curPeak = Math.abs(Number(shake.current_peak) || 0)
    const basePeak = Math.abs(Number(shake.baseline_peak) || 0)
    const curRms = Math.abs(Number(shake.current_rms) || 0)
    const baseRms = Math.abs(Number(shake.baseline_rms) || 0)

    const eps = 1
    const ratioPeak = curPeak / Math.max(basePeak, eps)
    const ratioRms = curRms / Math.max(baseRms, eps)
    const r = Math.max(ratioPeak, ratioRms)

    let label = '0'
    if (!(curPeak < eps * 2 && curRms < eps * 2)) {
        if (r < 2) label = '0'
        else if (r < 3) label = '1'
        else if (r < 4) label = '2'
        else if (r < 6) label = '3'
        else if (r < 9) label = '4'
        else if (r < 13) label = '5-'
        else if (r < 18) label = '5+'
        else if (r < 25) label = '6-'
        else if (r < 35) label = '6+'
        else label = '7'
    }
    return { label, ratio_peak: ratioPeak, ratio_rms: ratioRms }
}

const loadKanameishiSeries = async () => {
    const res = await fetch(`/pga_points.json?_=${Date.now()}`, { cache: 'no-store' })
    const text = await res.text()
    if (!text.trim()) return []

    let parsed
    try {
        parsed = JSON.parse(text)
    }
    catch {
        return { error: 'pga_points.json がJSONとして読み取れません' }
    }

    const points = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.points) ? parsed.points : null)
    if (!points) return { error: 'pga_points.json の形式が不明です（配列 もしくは {points: []} を期待）' }

    const mode = (!Array.isArray(parsed) && typeof parsed?.mode === 'string') ? parsed.mode : undefined
    const unit = (!Array.isArray(parsed) && typeof parsed?.unit === 'string') ? parsed.unit : undefined
    const shake = (!Array.isArray(parsed) && parsed && typeof parsed === 'object') ? parsed?.shake : undefined
    const shindoEst = (!Array.isArray(parsed) && parsed && typeof parsed === 'object') ? parsed?.shindo_est : undefined

    const series = []
    for (const p of points) {
        if (Array.isArray(p) && p.length >= 2) {
            const t = Number(p[0])
            const v = Number(p[1])
            if (Number.isFinite(t) && Number.isFinite(v)) series.push({ t, v })
            continue
        }
        const tRaw = p?.t ?? p?.time ?? p?.timestamp ?? p?.ts
        const vRaw = p?.pga ?? p?.value ?? p?.v
        const t = (typeof tRaw === 'string') ? Date.parse(tRaw) : Number(tRaw)
        const v = Number(vRaw)
        if (Number.isFinite(t) && Number.isFinite(v)) series.push({ t, v })
    }
    series.sort((a, b) => a.t - b.t)
    return { series, mode, unit, shake, shindo_est: shindoEst }
}

const drawKanameishiLineChart = (canvas, series) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const css = window.getComputedStyle(document.body)
    const axisColor = css.getPropertyValue('--dark-gray').trim() || '#333333'
    const lineColor = css.getPropertyValue('--blue').trim() || axisColor

    const w = canvas.clientWidth || 280
    const h = canvas.clientHeight || 140
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.clearRect(0, 0, w, h)

    const padL = 36
    const padR = 8
    const padT = 8
    const padB = 18

    ctx.strokeStyle = axisColor
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padL, padT)
    ctx.lineTo(padL, h - padB)
    ctx.lineTo(w - padR, h - padB)
    ctx.stroke()

    const x0 = padL
    const x1 = w - padR
    const y0 = h - padB
    const y1 = padT

    const formatNumber = (v) => {
        const av = Math.abs(v)
        if (av >= 1000) return Math.round(v).toString()
        if (av >= 10) return (Math.round(v * 10) / 10).toString()
        return (Math.round(v * 100) / 100).toString()
    }

    const formatTime = (t) => {
        try {
            return new Date(t).toLocaleTimeString('ja-JP', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
        }
        catch {
            return ''
        }
    }

    if (!series.length) {
        ctx.fillStyle = axisColor
        ctx.font = '12px sans-serif'
        ctx.fillText('データなし', padL + 8, padT + 14)
        return
    }

    const tMin = series[0].t
    const tMax = series[series.length - 1].t
    let vMin = series[0].v
    let vMax = series[0].v
    for (const p of series) {
        vMin = Math.min(vMin, p.v)
        vMax = Math.max(vMax, p.v)
    }
    if (vMin === vMax) {
        vMin -= 1
        vMax += 1
    }
    const xScale = (tMax === tMin) ? 1 : (x1 - x0) / (tMax - tMin)
    const yScale = (y0 - y1) / (vMax - vMin)
    const x = (t) => x0 + (t - tMin) * xScale
    const y = (v) => y0 - (v - vMin) * yScale

    // Y-axis ticks
    ctx.font = '11px sans-serif'
    ctx.fillStyle = axisColor
    ctx.strokeStyle = axisColor
    const yTicks = 4
    for (let i = 0; i <= yTicks; i++) {
        const vv = vMin + (vMax - vMin) * (i / yTicks)
        const yy = y(vv)

        // small tick
        ctx.beginPath()
        ctx.moveTo(x0 - 4, yy)
        ctx.lineTo(x0, yy)
        ctx.stroke()

        // label
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillText(formatNumber(vv), x0 - 6, yy)

        // light gridline
        ctx.save()
        ctx.globalAlpha = 0.18
        ctx.beginPath()
        ctx.moveTo(x0, yy)
        ctx.lineTo(x1, yy)
        ctx.stroke()
        ctx.restore()
    }

    // X-axis ticks
    const xTicks = 2
    for (let i = 0; i <= xTicks; i++) {
        const tt = tMin + (tMax - tMin) * (i / xTicks)
        const xx = x(tt)
        ctx.beginPath()
        ctx.moveTo(xx, y0)
        ctx.lineTo(xx, y0 + 4)
        ctx.stroke()

        ctx.textBaseline = 'top'
        ctx.textAlign = i === 0 ? 'left' : (i === xTicks ? 'right' : 'center')
        ctx.fillText(formatTime(tt), xx, y0 + 4)
    }

    ctx.strokeStyle = lineColor
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x(series[0].t), y(series[0].v))
    for (let i = 1; i < series.length; i++) {
        ctx.lineTo(x(series[i].t), y(series[i].v))
    }
    ctx.stroke()
}

const kanameishiWaveWindowKey = 'wave_kanameishi'

const openKanameishiWindow = async () => {
    const existing = jpStationWaveWindows.get(kanameishiWaveWindowKey)
    let state
    if (existing?.win && !existing.win.closed) {
        state = existing
        state.win.focus()
    }
    else {
        const win = window.open('', kanameishiWaveWindowKey, 'width=360,height=260,resizable=yes,scrollbars=no')
        if (!win) return

        win.document.title = 'Waveform'
        win.document.body.style.margin = '10px'
        win.document.body.style.fontFamily = 'sans-serif'

        const title = win.document.createElement('div')
        title.textContent = 'Waveform'
        title.style.fontWeight = '700'
        title.style.marginBottom = '6px'

        const canvas = win.document.createElement('canvas')
        canvas.style.width = '320px'
        canvas.style.height = '140px'

        const note = win.document.createElement('div')
        note.style.fontSize = '12px'
        note.style.marginTop = '6px'
        note.textContent = '読み込み中…'

        win.document.body.append(title, canvas, note)

        state = { win, title, canvas, note, intervalId: null }
        jpStationWaveWindows.set(kanameishiWaveWindowKey, state)

        win.addEventListener('beforeunload', () => {
            if (state.intervalId) clearInterval(state.intervalId)
            applyEstimatedShindoToMarker(kanameishiMarker, '0')
            jpStationWaveWindows.delete(kanameishiWaveWindowKey)
        })
    }

    const refresh = async () => {
        if (state.win.closed) return
        const loaded = await loadKanameishiSeries()
        if (loaded?.error) {
            state.note.textContent = loaded.error
            drawKanameishiLineChart(state.canvas, [])
            return
        }
        const mode = loaded?.mode || 'waveform'
        const unit = loaded?.unit || ''
        state.title.textContent = mode === 'pga' ? 'PGA' : 'Waveform'
        state.win.document.title = state.title.textContent

        let series = loaded?.series || []
        const latestAll = series.length ? series[series.length - 1] : null
        if (latestAll) {
            const windowMs = 3 * 60 * 1000
            const cutoff = latestAll.t - windowMs
            series = series.filter(p => p.t >= cutoff)
        }

        const latest = series.length ? series[series.length - 1] : null
        const shake = (loaded?.shake && typeof loaded.shake === 'object')
            ? loaded.shake
            : computeShakeFromSeries(series, 180000)
        const shakeText = (shake && shake.detected) ? '揺れ検知: あり' : '揺れ検知: なし'

        const shindoLabel = (loaded?.shindo_est && typeof loaded.shindo_est === 'object' && typeof loaded.shindo_est.label === 'string')
            ? loaded.shindo_est.label
            : estimateShindoFromSeries(series, 180000).label
        const shindoText = `推定震度: ${shindoLabel}`

        applyEstimatedShindoToMarker(kanameishiMarker, shindoLabel)

        state.note.textContent = latest
            ? `${shindoText} / ${shakeText} / 最新: ${latest.v}${unit ? ` (${unit})` : ''}  at ${new Date(latest.t).toLocaleString()}`
            : `${shindoText} / ${shakeText} / データなし`
        drawKanameishiLineChart(state.canvas, series)
    }

    if (state.intervalId) clearInterval(state.intervalId)
    await refresh()
    state.intervalId = setInterval(async () => {
        if (state.win.closed) {
            if (state.intervalId) clearInterval(state.intervalId)
            jpStationWaveWindows.delete(kanameishiWaveWindowKey)
            return
        }
        await refresh()
    }, 1000)
}

const defaultMenuId = computed(() => {
    let defaultMenuId = 'main'
    if(settingsStore.mainSettings.cinemaMode) {
        if(tempEqlists.value) {
            defaultMenuId = 'eqlists'
        }
        else {
            const isActive = statusStore.isActive
            const isEewOrNetActive = [...eewSources, ...seisNetSources, 'mockEew'].some(key => isActive[key])
            const isEqlistOrTsunamiActive = [...eqlistSources, ...tsunamiSources].some(key => isActive[key])
            if(isEewOrNetActive && isEqlistOrTsunamiActive) {
                defaultMenuId = 'main'
            }
            else if(isEewOrNetActive) {
                defaultMenuId = 'eews'
            }
            else if(isEqlistOrTsunamiActive) {
                defaultMenuId = 'eqlists'
            }
            else {
                defaultMenuId = settingsStore.mainSettings.eqlistsAsDefault ? 'eqlists' : 'main'
            }
        }
    }
    return defaultMenuId
})
const menuId = ref(defaultMenuId.value)
provide('menuId', menuId)
let autoZoomTimer
let firstMsg = false
const blinkStatus = ref(false)
let tsunamiFlickerCounter = 0
const infoPageCounter = ref(0)
const eventsPerPage = computed(() => (menuId.value == 'main' || menuId.value == 'settings') && (activeEewList.length > 0 && displayEqlistList.value.length > 0) ? 1 : 2)
const eewInfoTotalPages = computed(() => Math.ceil(activeEewList.length / eventsPerPage.value))
const currentEewInfoPage = computed(() => Math.floor(infoPageCounter.value / 10) % eewInfoTotalPages.value)
const currentEewInfoItems = computed(() => activeEewList.slice(eventsPerPage.value * currentEewInfoPage.value, eventsPerPage.value * (currentEewInfoPage.value + 1)))
const eqlistInfoTotalPages = computed(() => Math.ceil(displayEqlistList.value.length / eventsPerPage.value))
const currentEqlistInfoPage = computed(() => Math.floor(infoPageCounter.value / 10) % eqlistInfoTotalPages.value)
const currentEqlistInfoItems = computed(() => displayEqlistList.value.slice(eventsPerPage.value * currentEqlistInfoPage.value, eventsPerPage.value * (currentEqlistInfoPage.value + 1)))
const handleManual = ()=>{
    isAutoZoom.value = false
    clearTimeout(autoZoomTimer)
    autoZoomTimer = setTimeout(() => {
        handleHome()
    }, 60 * 1000);
}
const handleHome = ()=>{
    isAutoZoom.value = true
    setView()
}
const handleMenu = (index)=>{
    const shouldHandleHome = menuId.value == index
    if(shouldHandleHome && index == 'eqlists' && isAutoZoom.value) settingsStore.mainSettings.hideDrawer = !settingsStore.mainSettings.hideDrawer
    menuId.value = index
    setTimeout(() => {
        map.invalidateSize()
        if(shouldHandleHome || isAutoZoom.value) handleHome()
    }, 0);  //语句推迟到容器大小变化后再执行
}
provide('handleHome', handleHome)
const drawer = ref(null)
const wolfxRS = ref(4)
const fanRS = ref(4)
const p2pquakeRS = ref(4)
const gqRS = ref(4)
const wolfxUrlIndex = ref(0)
const fanUrlIndex = ref(0)
const p2pquakeUrlIndex = ref(0)
const gqUrlIndex = ref(0)
const niedUpdateTime = ref('1970-01-01 09:00:00')
const niedMaxShindo = ref('?')
const niedPeriodMaxShindo = ref('?')
const niedPeriodBarClass = ref('gray')
const isNiedDelayed = ref(true)
provide('niedUpdateTime', niedUpdateTime)
provide('niedMaxShindo', niedMaxShindo)
provide('niedPeriodMaxShindo', niedPeriodMaxShindo)
provide('niedPeriodBarClass', niedPeriodBarClass)
const tremUpdateTime = ref('1970-01-01 08:00:00')
const tremMaxShindo = ref('?')
const tremPeriodMaxShindo = ref('?')
const tremPeriodBarClass = ref('gray')
const isTremDelayed = ref(true)
provide('tremUpdateTime', tremUpdateTime)
provide('tremMaxShindo', tremMaxShindo)
provide('tremPeriodMaxShindo', tremPeriodMaxShindo)
provide('tremPeriodBarClass', tremPeriodBarClass)
const kmaUpdateTime = ref('1970-01-01 09:00:00')
const kmaMaxInt = ref('?')
const kmaPeriodMaxInt = ref('?')
const kmaPeriodBarClass = ref('gray')
const isKmaDelayed = ref(true)
provide('kmaUpdateTime', kmaUpdateTime)
provide('kmaMaxInt', kmaMaxInt)
provide('kmaPeriodMaxInt', kmaPeriodMaxInt)
provide('kmaPeriodBarClass', kmaPeriodBarClass)
const msilUpdateTime = ref('1970-01-01 09:00:00')
const msilMaxShindo = ref('?')
const msilPeriodMaxShindo = ref('?')
const msilPeriodBarClass = ref('gray')
const isMsilDelayed = ref(true)
provide('msilUpdateTime', msilUpdateTime)
provide('msilMaxShindo', msilMaxShindo)
provide('msilPeriodMaxShindo', msilPeriodMaxShindo)
provide('msilPeriodBarClass', msilPeriodBarClass)
const isAutoZoom = ref(true)
const activeEewList = reactive([])
const eqlistList = reactive([])
const historyList = reactive([])
const activeEqlistList = computed(() => eqlistList.filter(event => event.isActive))
const displayEqlistList = computed(() => historyList.length > 0 ? historyList : eqlistList.filter(event => settingsStore.mainSettings.alwaysDisplayLatestInfo ? event.isActive || event.isLatest : event.isActive))
provide('activeEewList', activeEewList)
provide('eqlistList', eqlistList)
provide('historyList', historyList)
const clearHistoryList = () => {
    while(historyList.length > 0) historyList[0].deactivate()
}
watch(() => `${activeEewList.length}|${displayEqlistList.value.length}|${menuId.value}`, () => {
    infoPageCounter.value = 0
})
const jmaTsunamiWarnArea = computed(() => {
    const warnArea = JSON.parse(statusStore.tsunamiMessage.jmaTsunami.warnArea)
    const jmaTsunamiWarnArea = {}
    warnArea.forEach(item => {
        jmaTsunamiWarnArea[item.name] = item
    })
    return jmaTsunamiWarnArea
})
const nmefcTsunamiWarnArea = computed(() => {
    const warnArea = JSON.parse(statusStore.tsunamiMessage.nmefcTsunami.warnArea)
    const nmefcTsunamiWarnArea = {}
    warnArea.forEach(item => {
        nmefcTsunamiWarnArea[item.name] = item
    })
    return nmefcTsunamiWarnArea
})
const activeSources = computed(() =>
    new Set([...activeEewList.map(event => event.eqMessage.source), ...activeEqlistList.value.map(event => event.eqMessage.source)])
)
watch(activeSources, newVal => {
    [...eewSources, ...eqlistSources, 'mockEew'].forEach(source => {
        statusStore.isActive[source] = newVal.has(source)
    })
})
const getBarClass = (event)=>{
    const eqMessage = event.eqMessage
    if(eqMessage.isEew){
        if(eqMessage.isCanceled) return 'dark-gray'
        else if(eqMessage.isWarn) return 'red'
        else return 'orange'
    }
    else {
        if(event.isActive) return 'gray'
        else return 'dark-gray'
    }
}
let mainInterval, terminatorInterval
onMounted(() => {
    msilWorker = new Worker(new URL('../workers/msil-decoder.js', import.meta.url), { type: 'module' });
    msilWorker.onmessage = (event) => {
        const { type, data, y, uid } = event.data;
        if (type === 'decoded') {
            handleMsilData(data, y, uid);
        }
    };

    map = L.map('mainMap', {
        attributionControl: false,
        center: defaultLatLng,
        zoom: 4,
        minZoom: 2,
        maxZoom: 12,
        worldCopyJump: true
    })
    //傻逼Leaflet
    L.Marker.prototype._animateZoom = function (opt) {
        if (!this._map) {
            return;
        }
        const pos = this._map._latLngToNewLayerPoint(this._latlng, opt.zoom, opt.center).round();
        this._setPos(pos);
    }
    L.Tooltip.prototype._animateZoom = function (e) {
        if (!this._map) {
            return;
        }
        const pos = this._map._latLngToNewLayerPoint(this._latlng, e.zoom, e.center).round();
        this._setPosition(pos);
    }
    L.Tooltip.prototype._updatePosition = function () {
        if (!this._map) {
            return;
        }
        const pos = this._map.latLngToLayerPoint(this._latlng);
        this._setPosition(pos);
    }
    statusStore.map = map
    map.removeControl(map.zoomControl)
    map.createPane('basePane')
    map.getPane('basePane').style.zIndex = 0
    map.createPane('terminatorFillPane')
    map.getPane('terminatorFillPane').style.zIndex = 9
    map.createPane('waveFillPane')
    waveFillPane = map.getPane('waveFillPane')
    waveFillPane.style.zIndex = 10
    map.createPane('eewBasePane')
    eewBasePane = map.getPane('eewBasePane')
    eewBasePane.style.zIndex = 20
    map.createPane('faultBasePane')
    map.getPane('faultBasePane').style.zIndex = 30
    map.createPane('tsunamiBasePane')
    tsunamiBasePane = map.getPane('tsunamiBasePane')
    tsunamiBasePane.style.zIndex = 40
    for(let i = -1; i <= 20; i++){
        map.createPane(`niedStationPane${i}`)
        map.getPane(`niedStationPane${i}`).style.zIndex = i + 50
        map.createPane(`tremStationPane${i}`)
        map.getPane(`tremStationPane${i}`).style.zIndex = i + 50
    }
    for(let i = -1; i <= 13; i++){
        map.createPane(`kmaStationPane${i}`)
        map.getPane(`kmaStationPane${i}`).style.zIndex = i + 50
    }

    map.createPane('jpSeedlinkPane')
    map.getPane('jpSeedlinkPane').style.zIndex = 95
    jpSeedlinkStationsLayer = L.layerGroup().addTo(map)

    map.createPane('userPane')
    map.getPane('userPane').style.zIndex = 100
    kanameishiMarker = L.circleMarker(kanameishiLatLng, {
        radius: 6,
        pane: 'userPane',
        interactive: true
    }).addTo(map)
    kanameishiMarker.on('click', openKanameishiWindow)

    // JP network (SeedLink/IRIS) station markers (except JCJ)
    loadJpSeedlinkStations()
    map.createPane('terminatorPane')
    map.getPane('terminatorPane').style.zIndex = 130
    map.createPane('niedGridPane')
    niedGridPane = map.getPane('niedGridPane')
    niedGridPane.style.zIndex = 140
    map.createPane('tremGridPane')
    tremGridPane = map.getPane('tremGridPane')
    tremGridPane.style.zIndex = 140
    map.createPane('tremRtsPane')
    map.getPane('tremRtsPane').style.zIndex = 142;
    tremRtsLayer = L.layerGroup()
    map.createPane('kmaGridPane')
    kmaGridPane = map.getPane('kmaGridPane')
    kmaGridPane.style.zIndex = 140
    map.createPane('msilNetPane')
    msilNetPane = map.getPane('msilNetPane')
    msilNetPane.style.zIndex = 141
    msilNetLayer = L.layerGroup()
    map.createPane('wavePane')
    wavePane = map.getPane('wavePane')
    wavePane.style.zIndex = 150
    map.createPane('labelPane1')
    labelPane1 = map.getPane('labelPane1')
    labelPane1.style.zIndex = 190
    map.createPane('labelPane2')
    labelPane2 = map.getPane('labelPane2')
    labelPane2.style.zIndex = 190
    map.createPane('eqlistMarkerPane')
    eqlistMarkerPane = map.getPane('eqlistMarkerPane')
    eqlistMarkerPane.style.zIndex = 198
    map.createPane('historyMarkerPane')
    historyMarkerPane = map.getPane('historyMarkerPane')
    historyMarkerPane.style.zIndex = 199
    map.createPane('eewMarkerPane')
    eewMarkerPane = map.getPane('eewMarkerPane')
    eewMarkerPane.style.zIndex = 200
    map.on('dragstart', handleManual)
    map.on('zoomend', () => zoomLevel.value = map.getZoom())
    map.on('zoomend', () => {
        // Keep MSIL markers scaled like NIED even without new frames.
        if (settingsStore.mainSettings.displaySeisNet.msilNet) refreshMsilMarkerStyleForZoom()
    })
    if(settingsStore.advancedSettings.preventFlickerMode){
        map.on('zoomstart', ()=>{setMapHeight('calc(100% - 1px)');})
        map.on('zoomend', ()=>{setMapHeight('100%');})
    }
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && pendingSetView) {
            pendingSetView = false
            setView()
        }
    })
    watchEffect(()=>{
        if(userMarker && map.hasLayer(userMarker)) map.removeLayer(userMarker)
        if(isDisplayUser.value){
            userMarker = L.circleMarker(userLatLng.value, {
                radius: 8,
                fillOpacity: 0.5,
                weight: 2,
                pane: 'userPane',
                interactive: false
            }).addTo(map)
        }
        nearestJmaLoc.value
    })
    watchEffect(() => {
        waveFillPane.style.display = settingsStore.mainSettings.fillSWave ? 'block' : 'none'
    })
    watchEffect(() => {
        eqlistMarkerPane.style.display = historyList.length > 0 ? 'none' : 'block'
        historyMarkerPane.style.display = historyList.length > 0 ? 'block' : 'none'
    })
    watchEffect(() => {
        if(activeEqlistList.value.length > 0) {
            if(settingsStore.mainSettings.cinemaMode && tempEqlists.value.endsWith('Eqlist')) {
                eqlistList.forEach(event => {
                    event.hypoMarker?.setOpacity(tempEqlists.value == event.eqMessage.source ? 1 : 0.3)
                })
            }
            else {
                eqlistList.forEach(event => {
                    event.hypoMarker?.setOpacity(event.isActive ? 1 : 0.3)
                })
            }
        }
        else {
            eqlistList.forEach(event => {
                event.hypoMarker?.setOpacity(1)
            })
        }
    })
    labelLayer1 = L.layerGroup().addTo(map);
    labelLayer2 = L.layerGroup().addTo(map);
    loadMaps()
    loadMsilNet()
    loadTremRts()

    watch(
        () => settingsStore.mainSettings.displaySeisNet.tremNet,
        (newVal) => {
            if (newVal) map.addLayer(tremRtsLayer)
            else map.removeLayer(tremRtsLayer)
        },
        { immediate: true }
    )

    watch(
        () => settingsStore.mainSettings.displaySeisNet.msilNet,
        (newVal) => {
            if (newVal) map.addLayer(msilNetLayer)
            else map.removeLayer(msilNetLayer)
        },
        { immediate: true }
    )

    watch(() => settingsStore.mainSettings.displayTerminator, newVal => {
        if(terminatorLayer && map.hasLayer(terminatorLayer)) map.removeLayer(terminatorLayer)
        if(terminatorFillLayer && map.hasLayer(terminatorFillLayer)) map.removeLayer(terminatorFillLayer)
        clearInterval(terminatorInterval)
        if(newVal) {
            const update = () => {
                const time = new Date(timeStore.getTimeStamp())
                terminatorLayer?.setTime(time)
                terminatorFillLayer?.setTime(time)
            }
            const time = new Date(timeStore.getTimeStamp())
            terminatorLayer = terminator({
                color: 'black',
                opacity: 0.5,
                weight: 2,
                fill: false,
                pane: 'terminatorPane',
                interactive: false,
                time
            }).addTo(map)
            terminatorFillLayer = terminator({
                fillColor: 'black',
                fillOpacity: 0.25,
                stroke: false,
                pane: 'terminatorFillPane',
                interactive: false,
                time
            }).addTo(map)
            setTimeout(update, 6000);
            terminatorInterval = setInterval(update, 30000);
        }
    }, { immediate: true })
    if(settingsStore.mainSettings.cinemaMode) {
        watch(defaultMenuId, newVal => {
            if(menuId.value != 'settings' && isAutoZoom.value) {
                menuId.value = newVal
                setTimeout(() => {
                    map.invalidateSize()
                    setView()
                }, 0);
            }
        }, { immediate: true })
    }
    watchEffect(()=>{
        document.removeEventListener('mousemove', resetDefaultMenuTimer)
        if(menuId.value == defaultMenuId.value){
            clearTimeout(defaultMenuTimer)
        }
        else{
            resetDefaultMenuTimer()
            document.addEventListener('mousemove', resetDefaultMenuTimer)
        }
    })

  watch(menuId, (newVal) => {
    drawer.value.scrollTop = 0
    clearHistoryList()
    if(newVal == 'eews'){
        eqlistMarkerPane.style.opacity = 0.3
        tsunamiBasePane.style.opacity = 0.3 * (tsunamiFlickerCounter ? 1 : 0)
    }
    else{
        eqlistMarkerPane.style.opacity = 1
        tsunamiBasePane.style.opacity = 1 * (tsunamiFlickerCounter ? 1 : 0)
    }
    if(newVal == 'eqlists'){
        eewMarkerPane.style.opacity = 0.3 * (blinkStatus.value ? 1 : 0)
        wavePane.style.opacity = 0.3
        waveFillPane.style.opacity = 0.3
        niedGridPane.style.opacity = 0.3 * (blinkStatus.value && !statusStore.isActive.jmaEew ? 1 : 0)
        tremGridPane.style.opacity = 0.3 * (blinkStatus.value && !statusStore.isActive.cwaEew ? 1 : 0)
        kmaGridPane.style.opacity = 0.3 * (blinkStatus.value ? 1 : 0)
        msilNetPane.style.opacity = 0.3
    }
    else{
        eewMarkerPane.style.opacity = 1 * (blinkStatus.value ? 1 : 0)
        wavePane.style.opacity = 1
        waveFillPane.style.opacity = 1
        niedGridPane.style.opacity = 1 * (blinkStatus.value && !statusStore.isActive.jmaEew ? 1 : 0)
        tremGridPane.style.opacity = 1 * (blinkStatus.value && !statusStore.isActive.cwaEew ? 1 : 0)
        kmaGridPane.style.opacity = 1 * (blinkStatus.value ? 1 : 0)
        msilNetPane.style.opacity = 1
    }
    tsunamiBasePane.style.opacity = (tsunamiFlickerCounter ? 1 : 0) * (menuId.value == 'eews' ? 0.3 : 1)
    isNiedDelayed.value = !verifyUpToDate(niedUpdateTime.value, 9, 10000)
    isTremDelayed.value = !verifyUpToDate(tremUpdateTime.value, 8, 10000)
    isKmaDelayed.value = !verifyUpToDate(kmaUpdateTime.value, 9, 10000)
    isMsilDelayed.value = !verifyUpToDate(msilUpdateTime.value, 9, 10000)
    wolfxRS.value = statusStore.wolfxSocket?.socket.readyState ?? 4
    fanRS.value = statusStore.fanSocket?.socket.readyState ?? 4
    p2pquakeRS.value = statusStore.p2pquakeSocket?.socket.readyState ?? 4
    gqRS.value = statusStore.gqSocket?.socket.readyState ?? 4
    wolfxUrlIndex.value = statusStore.wolfxSocket?.urlIndex
    fanUrlIndex.value = statusStore.fanSocket?.urlIndex
    p2pquakeUrlIndex.value = statusStore.p2pquakeSocket?.urlIndex
    gqUrlIndex.value = statusStore.gqSocket?.urlIndex
  }, { immediate: true })
    watchEffect(() => {
        document.removeEventListener('mousemove', resetDefaultMenuTimer)
        if(menuId.value == defaultMenuId.value){
            clearTimeout(defaultMenuTimer)
        }
        else{
            resetDefaultMenuTimer()
            document.addEventListener('mousemove', resetDefaultMenuTimer)
        }
    })

  watch(menuId, (newVal) => {
    drawer.value.scrollTop = 0
    clearHistoryList()
    if(newVal == 'eews'){
        eqlistMarkerPane.style.opacity = 0.3
        tsunamiBasePane.style.opacity = 0.3 * (tsunamiFlickerCounter ? 1 : 0)
    }
    else{
        eqlistMarkerPane.style.opacity = 1
        tsunamiBasePane.style.opacity = 1 * (tsunamiFlickerCounter ? 1 : 0)
    }
    if(newVal == 'eqlists'){
        eewMarkerPane.style.opacity = 0.3 * (blinkStatus.value ? 1 : 0)
        wavePane.style.opacity = 0.3
        waveFillPane.style.opacity = 0.3
        niedGridPane.style.opacity = 0.3 * (blinkStatus.value && !statusStore.isActive.jmaEew ? 1 : 0)
        tremGridPane.style.opacity = 0.3 * (blinkStatus.value && !statusStore.isActive.cwaEew ? 1 : 0)
        kmaGridPane.style.opacity = 0.3 * (blinkStatus.value ? 1 : 0)
        msilNetPane.style.opacity = 0.3
    }
    else{
        eewMarkerPane.style.opacity = 1 * (blinkStatus.value ? 1 : 0)
        wavePane.style.opacity = 1
        waveFillPane.style.opacity = 1
        niedGridPane.style.opacity = 1 * (blinkStatus.value && !statusStore.isActive.jmaEew ? 1 : 0)
        tremGridPane.style.opacity = 1 * (blinkStatus.value && !statusStore.isActive.cwaEew ? 1 : 0)
        kmaGridPane.style.opacity = 1 * (blinkStatus.value ? 1 : 0)
        msilNetPane.style.opacity = 1
    }
    tsunamiBasePane.style.opacity = (tsunamiFlickerCounter ? 1 : 0) * (menuId.value == 'eews' ? 0.3 : 1)
    isNiedDelayed.value = !verifyUpToDate(niedUpdateTime.value, 9, 10000)
    isTremDelayed.value = !verifyUpToDate(tremUpdateTime.value, 8, 10000)
    isKmaDelayed.value = !verifyUpToDate(kmaUpdateTime.value, 9, 10000)
    isMsilDelayed.value = !verifyUpToDate(msilUpdateTime.value, 9, 10000)
    wolfxRS.value = statusStore.wolfxSocket?.socket.readyState ?? 4
    fanRS.value = statusStore.fanSocket?.socket.readyState ?? 4
    p2pquakeRS.value = statusStore.p2pquakeSocket?.socket.readyState ?? 4
    gqRS.value = statusStore.gqSocket?.socket.readyState ?? 4
    wolfxUrlIndex.value = statusStore.wolfxSocket?.urlIndex
    fanUrlIndex.value = statusStore.fanSocket?.urlIndex
    p2pquakeUrlIndex.value = statusStore.p2pquakeSocket?.urlIndex
    gqUrlIndex.value = statusStore.gqSocket?.urlIndex
  }, { immediate: true })
    intervalEvents()
    mainInterval = setInterval(() => {
        intervalEvents()
    }, 500);
    document.addEventListener('keydown', handleKeydown)
})
function handleKeydown(event) {
    const target = event.target
    const tag = target.tagName.toLowerCase()
    const isInput = tag === 'input' || tag === 'textarea' || target.isContentEditable || tag === 'select'
    if (!isInput) {
        switch (event.key) {
            case 'd':
            case 'D':
                settingsStore.mainSettings.hideDrawer = !settingsStore.mainSettings.hideDrawer
                setTimeout(() => {
                    map.invalidateSize()
                }, 0);
                break
            case 'ArrowUp': case 'ArrowDown': case 'ArrowLeft': case 'ArrowRight':
                handleManual()
                break
            case 'Tab':
                event.preventDefault()
                const menuArr = ['main', 'eews', 'eqlists']
                const length = menuArr.length
                const currIndex = menuArr.findIndex(id => id == menuId.value) ?? length
                const nextIndex = event.shiftKey ? (currIndex + length - 1) % length : (currIndex + 1) % length
                const nextMenu = menuArr[nextIndex]
                handleMenu(nextMenu)
                break
            case 'a':
            case 'A':
                if(isAutoZoom.value) {
                    handleManual()
                }
                else {
                    isAutoZoom.value = true
                    setView()
                }
                break
            case 'x':
            case 'X':
                statusStore.showStatusPanel = !statusStore.showStatusPanel
                break
            case 'm':
            case 'M':
                if(settingsStore.advancedSettings.mockEew) {
                    statusStore.showMockDialog = !statusStore.showMockDialog
                }
                break
            case 'c':
            case 'C':
                if(menuId.value == 'eqlists') {
                    clearHistoryList()
                }
                break
            case 'f':
            case 'F':
                handleMenu('main')
                break
            case 'e':
            case 'E':
                handleMenu('eews')
                break
            case 'l':
            case 'L':
                handleMenu('eqlists')
                break
            case 's':
            case 'S':
                handleMenu('settings')
                break
            case ',':
            case '<':
                infoPageCounter.value = (infoPageCounter.value - infoPageCounter.value % 10 + 25200 - 10) % 25200
                break
            case '.':
            case '>':
                infoPageCounter.value = (infoPageCounter.value - infoPageCounter.value % 10 + 10) % 25200
                break
        }
    }
}
const renderers = {}
const panes = ['basePane', 'eewBasePane', 'tsunamiBasePane', 'faultBasePane']
settingsStore.mainSettings.useCanvasRenderer && panes.forEach(pane => renderers[pane] = L.canvas({ pane }))
const loadMaps = async (retries = 0) => {
    let msgTimer
    if(!firstMsg){
        msgTimer = setTimeout(() => {
            ElMessage({
                message: '正在加载地图，请稍候…',
                duration: 5000
            })
            firstMsg = true
        }, 1000);
    }
    let promises, shouldRetry = false
    if(!isTauri() && ('caches' in window)){
        const cache = await caches.open('topojson')
        promises = Object.keys(topojsonUrls).map(key=>cache.match(topojsonUrls[key]).then(res=>res?.json()))
    }
    else{
        promises = Object.keys(topojsonUrls).map(key=>fetch(topojsonUrls[key]).then(res=>res?.json()))
    }
    const resps = await Promise.all(promises)
    const [global, cn, cn_eew, cn_fault, jp, jp_eew, jp_tsunami, cn_tsunami] = resps
    if(global && cn && cn_eew && cn_fault && jp && jp_eew && jp_tsunami){
        clearTimeout(msgTimer)
        loadBaseMap(global, 'basePane')
        loadBaseMap(jp, 'basePane')
        loadBaseMap(cn, 'basePane')
        jpEewBaseMap = settingsStore.mainSettings.disableEewBaseMap 
        ? null : loadBaseMap(jp_eew, 'eewBasePane', false, {
            color: '#bbbbbb00',
            opacity: 1,
            fillColor: '#39393900',
            fillOpacity: 1,
            weight: 1,
        })
        cnEewBaseMap = settingsStore.mainSettings.disableEewBaseMap 
        ? null : loadBaseMap(cn_eew, 'eewBasePane', false, {
            color: '#bbbbbb00',
            opacity: 1,
            fillColor: '#39393900',
            fillOpacity: 1,
            weight: 1,
        })
        watch(()=>settingsStore.mainSettings.displayCnFault, newVal => {
            if(cnFaultBaseMap && map.hasLayer(cnFaultBaseMap)) map.removeLayer(cnFaultBaseMap)
            if(newVal) {
                cnFaultBaseMap = loadBaseMap(cn_fault, 'faultBasePane', true, {
                    color: 'red',
                    opacity: 0.5,
                    weight: 1,
                })
            }
        }, { immediate: true })
        if(settingsStore.advancedSettings.forceCalcInt){
            watch(cnEewInfoList, newVal=>{
                const newCsisList = {}
                const areaClass = {}
                cnEewBaseMap?.eachLayer(layer=>{
                    let maxInt = 0
                    newVal.forEach(info=>{
                        const dist = pointDistToCnArea([info.lng, info.lat], layer.feature)
                        const int = Number(calcCsisLevel(info.magnitude, info.depth, dist))
                        if(int > maxInt) maxInt = int
                    })
                    if(maxInt > 0){
                        const className = setClassName(maxInt, false)
                        const layerName = layer.feature.properties.name
                        areaClass[layerName] = className
                        if(!(maxInt in newCsisList)) newCsisList[maxInt] = []
                        newCsisList[maxInt].push(layerName)
                    }
                })
                cnEwBaseMap?.setStyle(feature => {
                    const className = areaClass[feature.properties.name]
                    return ({
                        color: className ? '#bbbbbb' : '#bbbbbb00',
                        fillColor: classNameColors[className] || '#39393900'
                    })
                })
                const newNewCsisList = []
                for(let int = 12; int > 0; int--) {
                    if(newNewCsisList.length >= 50) break
                    newCsisList[int]?.forEach(name => {
                        newNewCsisList.push({
                            name,
                            intensity: int.toString()
                        })
                    })
                }
                csisList.value = newNewCsisList.slice(0, 50)
            }, { deep: true, immediate: true })
        }
        if(settingsStore.mainSettings.source.jmaTsunami) {
            jpTsunamiBaseMap = loadBaseMap(jp_tsunami, 'tsunamiBasePane', false, {
                color: '#ffffff00',
                opacity: 1,
                weight: map.getZoom(),
            })
            map.on('zoomend', () => {
                jpTsunamiBaseMap.setStyle({
                    weight: map.getZoom()
                })
            })
            watch(jmaTsunamiWarnArea, newVal => {
                jpTsunamiBaseMap.setStyle(feature => ({
                    color: tsunamiColors[newVal[feature.properties.name]?.className] || '#ffffff00'
                }))
                smartSetView()
            }, { deep: true, immediate: true })
        }
        if(settingsStore.mainSettings.source.nmefcTsunami) {
            if(cn_tsunami) {
                cnTsunamiBaseMap = loadBaseMap(cn_tsunami, 'tsunamiBasePane', false, {
                    color: '#ffffff00',
                    opacity: 1,
                    weight: map.getZoom(),
                })
                map.on('zoomend', () => {
                    cnTsunamiBaseMap.setStyle({
                        weight: map.getZoom()
                    })
                })
                watch(nmefcTsunamiWarnArea, newVal => {
                    cnTsunamiBaseMap.setStyle(feature => ({
                        color: tsunamiColors[newVal[feature.properties.name]?.className] || '#ffffff00'
                    }))
                    smartSetView()
                }, { deep: true, immediate: true })
            }
            else {
                shouldRetry = true
            }
        }
    }
    else{
        shouldRetry = true
    }
    if(shouldRetry) {
        if(retries < 50) {
            setTimeout(() => {
                loadMaps(retries + 1)
            }, 2000);
        }
        else {
            ElMessage({
                message: '地图加载失败，请稍后重试！',
                type: 'error',
                duration: 5000
            })
        }
    }
}
const intervalEvents = ()=>{
    blinkStatus.value = !blinkStatus.value
    tsunamiFlickerCounter = (tsunamiFlickerCounter + 1) % 6
    infoPageCounter.value = (infoPageCounter.value + 1) % 25200
    eewMarkerPane.style.opacity = (blinkStatus.value ? 1 : 0) * (menuId.value == 'eqlists' ? 0.3 : 1)
    niedGridPane.style.opacity = (blinkStatus.value && !statusStore.isActive.jmaEew ? 1 : 0) * (menuId.value == 'eqlists' ? 0.3 : 1)
    tremGridPane.style.opacity = (blinkStatus.value && !statusStore.isActive.cwaEew ? 1 : 0) * (menuId.value == 'eqlists' ? 0.3 : 1)
    kmaGridPane.style.opacity = (blinkStatus.value ? 1 : 0) * (menuId.value == 'eqlists' ? 0.3 : 1)
    msilNetPane.style.opacity = (menuId.value == 'eqlists' ? 0.3 : 1)
    tsunamiBasePane.style.opacity = (tsunamiFlickerCounter ? 1 : 0) * (menuId.value == 'eews' ? 0.3 : 1)
    isNiedDelayed.value = !verifyUpToDate(niedUpdateTime.value, 9, 10000)
    isTremDelayed.value = !verifyUpToDate(tremUpdateTime.value, 8, 10000)
    isKmaDelayed.value = !verifyUpToDate(kmaUpdateTime.value, 9, 10000)
    isMsilDelayed.value = !verifyUpToDate(msilUpdateTime.value, 9, 10000)
    wolfxRS.value = statusStore.wolfxSocket?.socket.readyState ?? 4
    fanRS.value = statusStore.fanSocket?.socket.readyState ?? 4
    p2pquakeRS.value = statusStore.p2pquakeSocket?.socket.readyState ?? 4
    gqRS.value = statusStore.gqSocket?.socket.readyState ?? 4
    wolfxUrlIndex.value = statusStore.wolfxSocket?.urlIndex
    fanUrlIndex.value = statusStore.fanSocket?.urlIndex
    p2pquakeUrlIndex.value = statusStore.p2pquakeSocket?.urlIndex
    gqUrlIndex.value = statusStore.gqSocket?.urlIndex
}
const setMapHeight = (height) => {
    const mapElement = map.getContainer()
    mapElement.style.height = height
    setTimeout(() => {
        map.invalidateSize()
    }, 0);
}
let pendingSetView = false
const setView = () => {
  if (!map) return

  if (document.visibilityState !== 'visible') {
    pendingSetView = true
    return
  }

  const bounds = L.latLngBounds([])
  const candidates = [] // Eew/SeisNet 用の候補

  // 临时Eqlist
  if(settingsStore.mainSettings.cinemaMode && tempEqlists.value && menuId.value == 'eqlists' && historyList.length == 0) {
    if(tempEqlists.value == 'jmaTsunami') {
        statusStore.isActive.jmaTsunami && jpTsunamiBaseMap?.eachLayer(layer => {
            if(layer.options.color && layer.options.color != '#ffffff00') {
                if(layer.getBounds){
                    bounds.extend(layer.getBounds())
                }
                else if(layer.getLatLng){
                    bounds.extend(layer.getLatLng())
                }
            }
        })
        if(!bounds.isValid()) {
            bounds.extend(jpTsunamiBaseMap?.getBounds())
        }
    }
    else if(tempEqlists.value == 'nmefcTsunami') {
        statusStore.isActive.nmefcTsunami && cnTsunamiBaseMap?.eachLayer(layer => {
            if(layer.options.color && layer.options.color != '#ffffff00') {
                if(layer.getBounds){
                    bounds.extend(layer.getBounds())
                }
                else if(layer.getLatLng){
                    bounds.extend(layer.getLatLng())
                }
            }
        })
        if(!bounds.isValid()) {
            bounds.extend(cnTsunamiBaseMap?.getBounds())
        }
    }
    else if(activeEqlistList.value.length > 0) {
        activeEqlistList.value.forEach(event=>{
            if(event.eqMessage.source == tempEqlists.value && event.isValidHypo) {
                bounds.extend(event.hypoLatLng)
            }
        })
        jpEewBaseMap?.eachLayer(layer => {
            if(layer.options.fillColor && layer.options.fillColor != '#39393900') {
                if(layer.getBounds){
                    bounds.extend(layer.getBounds())
                }
                else if(layer.getLatLng){
                    bounds.extend(layer.getLatLng())
                }
            }
        })
        cnEewBaseMap?.eachLayer(layer => {
            if(layer.options.fillColor && layer.options.fillColor != '#39393900') {
                if(layer.getBounds){
                    bounds.extend(layer.getBounds())
                }
                else if(layer.getLatLng){
                    bounds.extend(layer.getLatLng())
                }
            }
        })
    }
  }
  else {
    // EewとSeisNet
    if (menuId.value != 'eqlists') {
      map.eachLayer(layer => {
        let shouldExtend = false
        switch(layer.options.pane) {
          case 'eewMarkerPane':
          case 'waveFillPane':
            shouldExtend = true
            break
          case 'niedGridPane':
            if(!statusStore.isActive.jmaEew) {
                shouldExtend = true
            }
            break
          case 'tremGridPane':
            if(!statusStore.isActive.cwaEew) {
                shouldExtend = true
            }
            break
          case 'kmaGridPane':
            shouldExtend = true
            break
        }
        if(shouldExtend) {
          if (layer.getBounds) {
            bounds.extend(layer.getBounds())
          } else if (layer.getLatLng) {
            const latLng = layer.getLatLng()
            const { lat, lng } = latLng
            if (
              (lat >= 18 && lat <= 54 && lng >= 73 && lng <= 149) ||
              (lat >= 3 && lat <= 18 && lng >= 107 && lng <= 120)
            ) {
              bounds.extend(latLng)
            } else {
              candidates.push(latLng)
            }
          }
        }
      })

      if (!bounds.isValid() && candidates.length) {
        candidates.forEach(latLng => bounds.extend(latLng))
      }
    }
    // 历史地震
    if(!bounds.isValid() && menuId.value == 'eqlists' && historyList.length > 0) {
        historyList.forEach(event => {
            if(event.isValidHypo){
                bounds.extend(event.hypoLatLng)
            }
        })
        jpEewBaseMap?.eachLayer(layer => {
            if(layer.options.fillColor && layer.options.fillColor != '#39393900') {
                if(layer.getBounds){
                    bounds.extend(layer.getBounds())
                }
                else if(layer.getLatLng){
                    bounds.extend(layer.getLatLng())
                }
            }
        })
        cnEewBaseMap?.eachLayer(layer => {
            if(layer.options.fillColor && layer.options.fillColor != '#39393900') {
                if(layer.getBounds){
                    bounds.extend(layer.getBounds())
                }
                else if(layer.getLatLng){
                    bounds.extend(layer.getLatLng())
                }
            }
        })
    }
    // 活跃的Eqlist和Tsunami
    if(!bounds.isValid() && menuId.value != 'eews') {
        statusStore.isActive.jmaTsunami && jpTsunamiBaseMap?.eachLayer(layer => {
            if(layer.options.color && layer.options.color != '#ffffff00') {
                if(layer.getBounds){
                    bounds.extend(layer.getBounds())
                }
                else if(layer.getLatLng){
                    bounds.extend(layer.getLatLng())
                }
            }
        })
        statusStore.isActive.nmefcTsunami && cnTsunamiBaseMap?.eachLayer(layer => {
            if(layer.options.color && layer.options.color != '#ffffff00') {
                if(layer.getBounds){
                    bounds.extend(layer.getBounds())
                }
                else if(layer.getLatLng){
                    bounds.extend(layer.getLatLng())
                }
            }
        })
        if(activeEqlistList.value.length > 0) {
            activeEqlistList.value.forEach(event=>{
                if(event.isValidHypo){
                    bounds.extend(event.hypoLatLng)
                }
            })
            jpEewBaseMap?.eachLayer(layer => {
                if(layer.options.fillColor && layer.options.fillColor != '#39393900') {
                    if(layer.getBounds){
                        bounds.extend(layer.getBounds())
                    }
                    else if(layer.getLatLng){
                        bounds.extend(layer.getLatLng())
                    }
                }
            })
            cnEewBaseMap?.eachLayer(layer => {
                if(layer.options.fillColor && layer.options.fillColor != '#39393900') {
                    if(layer.getBounds){
                        bounds.extend(layer.getBounds())
                    }
                    else if(layer.getLatLng){
                        bounds.extend(layer.getLatLng())
                    }
                }
            })
        }
    }
    // 不活跃的Eqlist（※ここで candidates を再宣言しない）
    if(!bounds.isValid() && menuId.value == 'eqlists') {
      const eqlistCandidates = []
      map.eachLayer(layer => {
        if(layer.options.pane == 'eqlistMarkerPane' || 
        layer.options.pane == 'eewBasePane' && layer.options.fillColor && layer.options.fillColor != '#39393900'){
            if(layer.getBounds){
                bounds.extend(layer.getBounds())
            }
            else if(layer.getLatLng){
                const latLng = layer.getLatLng()
                const { lat, lng } = latLng
                if(
                    lat >= 18 && lat <= 54 && lng >= 73 && lng <= 149
                    ||
                    lat >= 3 && lat <= 18 && lng >= 107 && lng <= 120
                ) {
                    bounds.extend(latLng)
                }
                else {
                    eqlistCandidates.push(latLng)
                }
            }
        }
      })
      if(!bounds.isValid()) {
        eqlistCandidates.forEach(latLng => bounds.extend(latLng))
      }
    }
  }

  // bounds適用 / デフォルト視野（このブロックを if-else の外に置く）
  let targetCenter, targetZoom
  if (bounds.isValid()) {
    const target = map._getBoundsCenterZoom(bounds, { padding: [50, 50], maxZoom: 8 })
    targetCenter = target.center
    targetZoom = target.zoom
  } else {
    let centerArr
    if (isValidViewLatLng.value) centerArr = viewLatLng.value
    else if (isValidUserLatLng.value) centerArr = userLatLng.value
    else centerArr = defaultLatLng
    const [lat, lng] = centerArr
    targetCenter = { lat, lng }
    targetZoom = settingsStore.mainSettings.defaultZoom
  }

  const currCenter = map.getCenter()
  const currZoom = map.getZoom()
  const err = 1 / 2 ** targetZoom
  if (
    currZoom != targetZoom ||
    Math.abs(currCenter.lat - targetCenter.lat) >= err ||
    Math.abs(currCenter.lng - targetCenter.lng) >= err
  ) {
    map.setView(targetCenter, targetZoom, { animate: true })
  }
}

const smartSetView = () => {
    setTimeout(() => {
        if(isAutoZoom.value) setView()
    }, 0);
}
provide('smartSetView', smartSetView)
const loadBaseMap = (topojson, pane, isBaseMap = true, style = {
        color: '#ccc',
        fillColor: '#393939',
        fillOpacity: 1,
        weight: 1,
        fill: true
    })=>{
    if(Object.keys(topojson).length != 0){
        try {
            if(isBaseMap && !settingsStore.advancedSettings.useClassicMapLoader) {
                const geojson = feature(topojson, topojson.objects.region)
                const vectorGrid = L.vectorGrid.slicer(geojson, {
                    pane,
                    rendererFactory: L.canvas.tile,
                    vectorTileLayerStyles: {
                        sliced: style
                    },
                    interactive: false
                });
                vectorGrid.addTo(map);
                return vectorGrid;
            }
            else {
                const factor = isBaseMap ? 0 : settingsStore.mainSettings.mapSimplifyFactor
                const simplified = simplifyTopoJson(topojson, factor)
                const geojson = feature(simplified, simplified.objects.region)
                const baseMap = L.geoJson(geojson, {
                    pane,
                    renderer: settingsStore.mainSettings.useCanvasRenderer && renderers[pane],
                    style,
                    interactive: settingsStore.mainSettings.placeNameOnHover && !settingsStore.mainSettings.useCanvasRenderer,
                    onEachFeature: settingsStore.mainSettings.placeNameOnHover && !settingsStore.mainSettings.useCanvasRenderer && onEachFeature
                })
                baseMap.addTo(map)
                return baseMap
            }
        } catch (e) {
            console.log(e);
        }
    }
}
const onEachFeature = (feature, layer)=>{
    layer.bindTooltip(feature.properties.name, {
        permanent: false,
        direction: 'top'
    })
}
let defaultMenuTimer
const resetDefaultMenuTimer = ()=>{
    clearTimeout(defaultMenuTimer)
    defaultMenuTimer = setTimeout(() => {
        menuId.value = defaultMenuId.value
        setTimeout(() => {
            map.invalidateSize()
            if(isAutoZoom.value) setView()
        }, 0);
    }, 60 * 1000);
}
let autoZoomInterval
watch(isAutoZoom, (newVal)=>{
    clearInterval(autoZoomInterval)
    if(newVal){
        autoZoomInterval = setInterval(() => {
            setView()
        }, 1000);
    }
}, { immediate: true })

watch(
    () => `${settingsStore.mainSettings.viewLatLng[0]}|${settingsStore.mainSettings.viewLatLng[1]}|${settingsStore.mainSettings.defaultZoom}`,
    () => {
        if(isAutoZoom.value) smartSetView()
    }
)
const jmaWarnArea = computed(()=>{
    const jmaWarnArea = {}
    if(menuId.value != 'eqlists') {
        const jmaEewList = activeEewList.filter(event=>event.eqMessage.source == 'jmaEew' && !event.eqMessage.isCanceled)
        jmaEewList.forEach(event=>{
            const warnArea = JSON.parse(event.eqMessage.warnArea)
            warnArea.forEach(item=>{
                if(!jmaWarnArea[item.name] || getClassLevel(item.className) > getClassLevel(jmaWarnArea[item.name].className)){
                    jmaWarnArea[item.name] = item
                }
            })
        })
        if(settingsStore.advancedSettings.forceCalcInt) {
            for(let id in jmaSeisIntLoc) {
                for(let eew of jpEewInfoList.value) {
                    const { magnitude, depth, lat, lng } = eew
                    if(depth > 150) continue
                    const intensity = calcJmaShindoLevel(magnitude, depth, lat, lng, jmaSeisIntLoc[id], false)
                    if(intensity < '1') continue
                    const name = jmaSeisIntLoc[id].sect
                    const className = setClassName(intensity, true)
                    if(!jmaWarnArea[name] || getClassLevel(className) > getClassLevel(jmaWarnArea[name].className)) {
                        jmaWarnArea[name] = {
                            name,
                            intensity,
                            className
                        }
                    }
                }
            }
        }
    }
    else {
        const jmaEqlistEvent = historyList.length > 0
        ? null
        : activeEqlistList.value.length > 0
        ? settingsStore.mainSettings.cinemaMode && tempEqlists.value.endsWith('Eqlist')
        ? tempEqlists.value == 'jmaEqlist'
        : activeEqlistList.value.find(event => event.eqMessage.source == 'jmaEqlist')
        : eqlistList.find(event => event.eqMessage.source == 'jmaEqlist')
        if(!jmaEqlistEvent) return {}
        if(settingsStore.mainSettings.eqlistsDisplayMode == 1 && !jmaEqlistEvent.isLatest && !jmaEqlistEvent.isActive) return {}
        const warnArea = JSON.parse(jmaEqlistEvent.eqMessage.warnArea)
        warnArea.forEach(point => {
            const { name, className } = point
            if(!name) return
            if(!jmaWarnArea[name] || getClassLevel(className) > getClassLevel(jmaWarnArea[name].className)) {
                jmaWarnArea[name] = point
            }
        })
    }
    return jmaWarnArea
})
const csisList = ref([])
const shindoList = computed(() => {
    const shindoList = {}
    for(let name in jmaWarnArea.value) {
        const intensity = formatShindo(jmaWarnArea.value[name].intensity)
        if(!(intensity in shindoList)) shindoList[intensity] = []
        shindoList[intensity].push(name)
    }
    const newShindoList = []
    const order = ['7', '6+', '6-', '5+', '5-', '4', '3', '2', '1']
    for(let int of order) {
        if(newShindoList.length >= 50) break
        shindoList[int]?.forEach(name => {
            newShindoList.push({
                name,
                intensity: int
            })
        })
    }
    return newShindoList.slice(0, 50)
})
const jpEewInfoList = computed(()=>{
    const jpEewList = activeEewList.filter(event=>!(event.eqMessage.isCanceled || event.eqMessage.isAssumption))
    const jpEewInfoList = jpEewList.map(event=>{
        const { magnitude, depth, lat, lng } = event.eqMessage
        return { magnitude, depth, lat, lng }
    })
    return jpEewInfoList
})
const cnEewInfoList = computed(() => {
    const sourceList = menuId.value === 'eqlists'
        ? (historyList.length > 0
            ? historyList
            : (activeEqlistList.value.length > 0
                ? (settingsStore.mainSettings.cinemaMode && tempEqlists.value.endsWith('Eqlist')
                    ? activeEqlistList.value.filter(event => event.eqMessage.source === tempEqlists.value)
                    : activeEqlistList.value)
                : eqlistList))
        : [];

    return sourceList
        .filter(event => event.hypoMarker && !event.eqMessage.isCanceled)
        .map(event => {
            const { magnitude, depth, lat, lng } = event.eqMessage;
            return { magnitude, depth, lat, lng };
        });
});

const tremStations = ref({});
let tremStationInfo = {};
let tremTimeout;

const tremStationProxyBase = computed(() => {
    const selected = settingsStore.mainSettings.displaySeisNet.tremApi;
    const isDev = import.meta.env.DEV

    // station APIは api-1/api-2
    if (selected === 'api-2') return isDev ? '/exptech-api-2' : 'https://api-2.exptech.dev'

    // lb-* が選ばれても、stationは api-1 を使う（Zero-Quakeもフェイルオーバーあり）
    return isDev ? '/exptech-api-1' : 'https://api-1.exptech.dev'
})

const tremRtsProxyBase = computed(() => {
    const selected = settingsStore.mainSettings.displaySeisNet.tremApi;
    const isDev = import.meta.env.DEV

    // rts APIは lb-1..lb-4
    if (selected?.startsWith('lb-')) {
        return isDev ? `/exptech-${selected}` : `https://${selected}.exptech.dev`
    }
    // api-1/api-2 の場合は対応する lb-1/lb-2
    if (selected === 'api-2') return isDev ? '/exptech-lb-2' : 'https://lb-2.exptech.dev'
    return isDev ? '/exptech-lb-1' : 'https://lb-1.exptech.dev'
})

const tremRtsMaxInst = ref(null)
const tremRtsCurrentBin = computed(() => instToShindoBin(tremRtsMaxInst.value))
const tremRtsShakeFlags = reactive({ shake1Notified: false, shake2Notified: false, focused: false })
const tremRtsPrevBins = reactive({})
const tremRtsRisingCount = ref(0)
const tremRtsRisingCountThreshold = 3

watch(
    () => settingsStore.mainSettings.displaySeisNet.tremNet,
    (newVal) => {
        if(!newVal) {
            tremRtsMaxInst.value = null
            for(const k in tremRtsPrevBins) delete tremRtsPrevBins[k]
            tremRtsRisingCount.value = 0
            tremRtsShakeFlags.shake1Notified = false
            tremRtsShakeFlags.shake2Notified = false
            tremRtsShakeFlags.focused = false
        }
    }
)

const _getTremRtsNiedStyle = (instShindo) => {
    const zoom = map?.getZoom?.() ?? settingsStore.mainSettings.defaultZoom
    const level = getLevelFromInstShindo(Number.isFinite(instShindo) ? instShindo : -3.1)
    return computeNiedStyleColorRadius(level, zoom)
}

const updateTremMarkers = (data) => {
    let max = null
    let risingCount = 0
    for (const id in tremStations.value) {
        const station = tremStations.value[id];
        const stationData = data[id];
        if (station.marker && stationData) {
            const shindo = stationData.i;
            if (shindo !== null && shindo !== undefined) {
                max = (max === null) ? shindo : Math.max(max, shindo)
            }
            const newBin = instToShindoBin(shindo)
            const oldBin = (id in tremRtsPrevBins) ? tremRtsPrevBins[id] : -1
            if (newBin > oldBin) risingCount += 1
            tremRtsPrevBins[id] = newBin
            const { color, radius } = _getTremRtsNiedStyle(shindo)
            station.marker.setStyle({
                color,
                fillColor: color,
                opacity: 1,
                fillOpacity: 1,
                weight: 0,
            });
            station.marker.setRadius(radius)
        } else if (station.marker) {
            const { color, radius } = _getTremRtsNiedStyle(null)
            station.marker.setStyle({
                color,
                fillColor: color,
                opacity: 1,
                fillOpacity: 1,
                weight: 0,
            })
            station.marker.setRadius(radius)
        }
    }
    tremRtsMaxInst.value = max
    tremRtsRisingCount.value = risingCount
    tremMaxShindo.value = (max === null) ? '?' : getShindoFromInstShindo(max)
};

const loadTremRts = async () => {
    clearTimeout(tremTimeout);

    if (Object.keys(tremStationInfo).length === 0) {
        try {
            const res = await fetch(`${tremStationProxyBase.value}/api/v1/trem/station?_=${Date.now()}`);
            tremStationInfo = await res.json();

            tremRtsLayer.clearLayers();
            const stations = {};
            for (const id in tremStationInfo) {
                const info = tremStationInfo[id].info[0];
                const { color, radius } = _getTremRtsNiedStyle(null)
                const marker = L.circleMarker([info.lat, info.lon], {
                    radius,
                    color,
                    weight: 0,
                    fillColor: color,
                    opacity: 1,
                    fillOpacity: 1,
                    pane: 'tremRtsPane'
                });
                marker.bindPopup(`<b>${id}</b>`);
                tremRtsLayer.addLayer(marker);
                stations[id] = { marker, info };
            }
            tremStations.value = stations;
            console.log('TREM-RTS stations initialized.');
        } catch (e) {
            console.error('Failed to load TREM-RTS station data:', e);
        }
    }

    if (settingsStore.mainSettings.displaySeisNet.tremNet) {
        try {
            const res = await fetch(`${tremRtsProxyBase.value}/api/v1/trem/rts?_=${Date.now()}`);
            const data = await res.json();
            if (data && data.station) {
                updateTremMarkers(data.station);
                tremUpdateTime.value = stampToTime(data.time, 8);
            }
        } catch (e) {
            console.error('Failed to load TREM-RTS data:', e);
        }
    }

    tremTimeout = setTimeout(loadTremRts, 1000);
};

watch(
    () => settingsStore.mainSettings.displaySeisNet.tremApi,
    () => {
        // API切替時は観測点キャッシュ/レイヤーを作り直す
        tremStationInfo = {}
        tremStations.value = {}
        tremRtsLayer?.clearLayers()
        loadTremRts()
    }
)

const msilStations = ref({});
const msil_latest = {};
const msilLatestByCode = {};
let msil_lastTime = '';
let msilTimeout;

const msilMaxInst = ref(null)
const msilCurrentBin = computed(() => instToShindoBin(msilMaxInst.value))
const msilShakeFlags = reactive({ shake1Notified: false, shake2Notified: false, focused: false })
const msilPrevBins = reactive({})
const msilRisingCount = ref(0)
const msilRisingCountThreshold = 2

watch(
    () => settingsStore.mainSettings.displaySeisNet.msilNet,
    (newVal) => {
        if(!newVal) {
            msilMaxInst.value = null
            for(const k in msilPrevBins) delete msilPrevBins[k]
            msilRisingCount.value = 0
            msilShakeFlags.shake1Notified = false
            msilShakeFlags.shake2Notified = false
            msilShakeFlags.focused = false
        }
    }
)

const _getMsilNiedStyle = (instShindo) => {
    const zoom = map?.getZoom?.() ?? settingsStore.mainSettings.defaultZoom
    const level = getLevelFromInstShindo(Number.isFinite(instShindo) ? instShindo : -3.1)
    return computeNiedStyleColorRadius(level, zoom)
}

const refreshMsilMarkerStyleForZoom = () => {
    if (!msilStations?.value) return
    for (const code in msilStations.value) {
        const station = msilStations.value[code]
        const marker = station?.marker
        if (!marker) continue
        const shindo = msilLatestByCode[code]
        const { color, radius } = _getMsilNiedStyle(shindo)
        marker.setStyle({
            color,
            fillColor: color,
            opacity: 1,
            fillOpacity: 1,
            weight: 0,
        })
        marker.setRadius(radius)
    }
}

const formatUtcToBasetime = (timestampMs) => {
    const d = new Date(timestampMs);
    const yyyy = d.getUTCFullYear();
    const MM = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    return `${yyyy}${MM}${dd}${hh}${mm}${ss}`;
};

const basetimeToUnixMs = (basetime) => {
    const yyyy = Number(basetime.slice(0, 4));
    const MM = Number(basetime.slice(4, 6));
    const dd = Number(basetime.slice(6, 8));
    const hh = Number(basetime.slice(8, 10));
    const mm = Number(basetime.slice(10, 12));
    const ss = Number(basetime.slice(12, 14));
    return Date.UTC(yyyy, MM - 1, dd, hh, mm, ss);
};

const updateMsilMarkers = (data) => {
    let max = null;
    let risingCount = 0
    for (const code in data) {
        const station = msilStations.value[code];
        if (!station?.marker) continue;
        const shindo = data[code]?.shindo;
        msilLatestByCode[code] = shindo
        if (shindo !== null && shindo !== undefined) {
            max = (max === null) ? shindo : Math.max(max, shindo);
        }
        const newBin = instToShindoBin(shindo)
        const oldBin = (code in msilPrevBins) ? msilPrevBins[code] : -1
        if (newBin > oldBin) risingCount += 1
        msilPrevBins[code] = newBin
        const { color, radius } = _getMsilNiedStyle(shindo)
        station.marker.setStyle({
            color,
            fillColor: color,
            opacity: 1,
            fillOpacity: 1,
            weight: 0,
        });
        station.marker.setRadius(radius)
    }
    msilMaxInst.value = max
    msilRisingCount.value = risingCount
    msilMaxShindo.value = (max === null) ? '?' : getShindoFromInstShindo(max);
};

watch(tremRtsCurrentBin, (newVal, oldVal) => {
    if(!settingsStore.mainSettings.displaySeisNet.tremNet) return
    if(newVal > oldVal && tremRtsRisingCount.value >= tremRtsRisingCountThreshold) {
        triggerShakeIfRising(newVal, oldVal, tremRtsShakeFlags)
    }
    else {
        triggerShakeIfRising(oldVal, oldVal, tremRtsShakeFlags)
    }
})

watch(msilCurrentBin, (newVal, oldVal) => {
    if(!settingsStore.mainSettings.displaySeisNet.msilNet) return
    if(newVal > oldVal && msilRisingCount.value >= msilRisingCountThreshold) {
        triggerShakeIfRising(newVal, oldVal, msilShakeFlags)
    }
    else {
        triggerShakeIfRising(oldVal, oldVal, msilShakeFlags)
    }
})

const handleMsilData = (data, y, uid) => {
    msil_latest[y] = { uid, data };
    const another = (y === 11) ? 12 : 11;
    if (msil_latest[another] && msil_latest[another].uid === uid) {
        const merged = { ...msil_latest[11].data, ...msil_latest[12].data };
        updateMsilMarkers(merged);
    }
};

const loadMsilNet = async () => {
    clearTimeout(msilTimeout);

    // 観測点（マーカー）の初期化：msilNet のON/OFFに関係なく一度だけ生成
    if (Object.keys(msilStations.value).length === 0) {
        try {
            const response = await fetch(`${import.meta.env.BASE_URL}resources/Snet_Points.json`);
            const points = await response.json();
            msilNetLayer.clearLayers();
            const { color, radius } = _getMsilNiedStyle(null)
            const stations = {};
            points.forEach(point => {
                if (!point.Point || point.IsSuspended) return;
                const { Latitude: lat, Longitude: lon } = point.Location;
                const code = point.Code;
                const marker = L.circleMarker([lat, lon], {
                    radius,
                    color,
                    weight: 0,
                    fillColor: color,
                    opacity: 1,
                    fillOpacity: 1,
                    pane: 'msilNetPane'
                });
                marker.bindPopup(`<b>${code}</b>`);
                msilNetLayer.addLayer(marker);
                stations[code] = { marker };
            });
            msilStations.value = stations;
            refreshMsilMarkerStyleForZoom()
        } catch (e) {
            console.error('Failed to initialize MSIL stations:', e);
        }
    }

    // 変更：msilNet がOFFならデータ取得はしない（マーカーは msilStations の設定で表示/非表示）
    if (!settingsStore.mainSettings.displaySeisNet.msilNet) {
        msilTimeout = setTimeout(loadMsilNet, 10000);
        return;
    }

    try {
        const msilBase = import.meta.env.DEV ? '/msil' : 'https://www.msil.go.jp'
        const targetTimesRes = await fetch(`${msilBase}/tiles/smoni/targetTimes.json?_=${Date.now()}`);
        const targetTimes = await targetTimesRes.json();
        if (!Array.isArray(targetTimes)) throw new Error('Invalid targetTimes format');

        const nowKey = formatUtcToBasetime(timeStore.getTimeStamp());
        let basetime = '';
        targetTimes.forEach(elm => {
            const bt = String(elm.basetime || '');
            if (bt && bt <= nowKey && bt > basetime) basetime = bt;
        });
        if (!basetime) throw new Error('No valid basetime found');

        // 更新時刻表示
        msilUpdateTime.value = stampToTime(basetimeToUnixMs(basetime), 9);

        if (msil_lastTime !== basetime) {
            msil_lastTime = basetime;
            const unique_id = Date.now();
            const urls = [
                { url: `${msilBase}/tiles/smoni/${basetime}/${basetime}/5/28/11.png?_=${unique_id}`, y: 11 },
                { url: `${msilBase}/tiles/smoni/${basetime}/${basetime}/5/28/12.png?_=${unique_id}`, y: 12 }
            ];

            urls.forEach(async ({ url, y }) => {
                try {
                    const response = await fetch(url);
                    const blob = await response.blob();
                    const imageBitmap = await createImageBitmap(blob);
                    if (msilWorker) {
                        msilWorker.postMessage({ imageBitmap, y, uid: unique_id }, [imageBitmap]);
                    }
                } catch (e) {
                    console.error(`Failed to fetch or process MSIL tile ${url}`, e);
                }
            });
        }
    } catch (e) {
        console.error('Failed to load MSIL data:', e);
    }

    msilTimeout = setTimeout(loadMsilNet, settingsStore.mainSettings.displaySeisNet.msilInterval * 1000);
};

onBeforeUnmount(() => {
    clearInterval(mainInterval)
    clearInterval(terminatorInterval)
    clearInterval(autoZoomInterval)
    clearTimeout(autoZoomTimer)
    clearTimeout(defaultMenuTimer)
    clearTimeout(tempEqlistsTimer)
    clearTimeout(tremTimeout)
    clearTimeout(msilTimeout)
    document.removeEventListener('mousemove', resetDefaultMenuTimer)
    if(msilWorker) msilWorker.terminate()
    document.removeEventListener('keydown', handleKeydown)
    activeEewList.length = 0
    eqlistList.length = 0
})
</script>

<style lang="scss" scoped>
.outer{
    width: 100%;
    height: 100%;
    .container{
        width: 100%;
        height: 100%;
        display: grid;
        grid-template-columns: 1fr auto;
        .mapContainer{
            height: 100%;
            position: relative;
            background-color: #282828;
            #mainMap{
                width: 100%;
                height: 100%;
                *{
                    cursor: default;
                }
            }
            .leaflet-container{
                background-color: #282828;
            }
            .leaflet-grab{
                cursor: default;
            }
            .eewList{
                display: flex;
                flex-direction: column;
                position: absolute;
                top: 0;
                left: 0;
                z-index: 500;   // >=400才会显示在地图上方？
                pointer-events: none;
                .event{
                    display: flex;
                }
                .eew{
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    margin: 5px 0 0 5px;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 0 10px 2px #0000003f;
                    user-select: none;
                    .bar{
                        width: 100%;
                        height: 30px;
                        border-bottom: #00000020 1px solid;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        font-size: 18px;
                        font-weight: 700;
                        padding: 0 0.25em;
                        div{
                            display: flex;
                            justify-content: center;
                            align-items: center;
                        }
                    }
                    .shindo-bar{
                        width: 100px;
                        height: 30px;
                        border-bottom: #00000020 1px solid;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        font-size: 18px;
                        font-weight: 700;
                    }
                    .info{
                        height: 100px;
                        display: flex;
                        gap: 10px;
                        align-items: center;
                        background-color: #ffffff9f;
                        backdrop-filter: blur(1px);
                        pointer-events: auto;
                        position: relative;
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
                            width: 100px;
                            height: 100%;
                            display: flex;
                            flex-direction: column;
                            justify-content: center;
                            align-items: center;
                            position: relative;
                            pointer-events: none;
                            .intensity-title{
                                height: 20px;
                                font-size: 16px;
                                line-height: 1;
                                position: absolute;
                                top: 2px;
                                display: flex;
                                justify-content: center;
                                align-items: center;
                            }
                            .shindo,.csis{
                                height: 80px;
                                text-align: center;
                                letter-spacing: -5px;
                                padding-right: 5px;
                                position: absolute;
                                bottom: 8px;
                            }
                            .shindo{
                                font-size: 55px;
                            }
                            .shindo::first-letter{
                                font-size: 80px;
                                vertical-align: top;
                            }
                            .csis{
                                font-size: 80px;
                            }
                        }
                        .right{
                            width: 305px;
                            height: 100%;
                            display: flex;
                            flex-direction: column;
                            justify-content: space-evenly;
                            line-height: 1;
                            vertical-align: middle;
                            padding-top: 4px;
                            .location{
                                width: 100%;
                                font-size: 28px;
                                white-space: nowrap;
                                text-overflow: ellipsis;
                                overflow: hidden;
                            }
                            .time{
                                width: 100%;
                                font-size: 24px;
                                white-space: nowrap;
                                text-overflow: ellipsis;
                                overflow: hidden;
                            }
                            .bottom{
                                width: 100%;
                                display: flex;
                                align-items: center;
                                gap: 15px;
                                overflow: hidden;
                                white-space: nowrap;
                                .magnitude{
                                    font-size: 24px;
                                }
                                .depth{
                                    font-size: 22px;
                                }
                                .type {
                                    margin-left: auto;
                                    margin-right: 4px;
                                    font-size: 16px;
                                    color: #7f7f7f;
                                    align-self: flex-end;
                                }
                            }
                        }
                        .eew-buttons {
                            width: 100%;
                            height: 100%;
                            position: absolute;
                            background-color: #ffffff9f;
                            backdrop-filter: blur(1px);
                            display: flex;
                            justify-content: space-evenly;
                            align-items: center;
                            z-index: 2;
                            .eew-button {
                                width: 88px;
                                height: 36px;
                            }
                        }
                    }
                    .tsunami-info {
                        width: 415px;
                        height: 100px;
                        padding: 1px 0;
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        column-gap: 50px;
                        align-content: space-evenly;
                        align-items: center;
                        background-color: #ffffff9f;
                        backdrop-filter: blur(1px);
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
                        .legend {
                            width: 90px;
                            height: 5px;
                            justify-self: end;
                        }
                        .text {
                            justify-self: start;
                            text-align: left;
                            font-size: 18px;
                        }
                        .tsunami-purple {
                            background-color: var(--tsunami-purple);
                        }
                        .tsunami-red {
                            background-color: var(--tsunami-red);
                        }
                        .tsunami-yellow {
                            background-color: var(--tsunami-yellow);
                        }
                    }
                }
                .countdown .shindo-bar{
                    pointer-events: auto;
                }
                .realtime{
                    width: 100px;
                }
            }
            .left-bottom{
                display: flex;
                flex-direction: column;
                position: absolute;
                bottom: 0;
                left: 0;
                z-index: 499;
                font-size: 18px;
                color: #ffffff;
                pointer-events: none;
                user-select: none;
                .legend{
                    width: 90px;
                    font-size: 16px;
                    display: flex;
                    flex-direction: column-reverse;
                    justify-content: flex-start;
                    padding: 5px 0px;
                    border-radius: 10px;
                    overflow: hidden;
                    box-shadow: inset 0 0 10px #ffffff3f, 0 0 10px #0000003f;
                    backdrop-filter: blur(1px);
                    .align-right{
                        text-align: right;
                        padding-right: 2px;
                    }
                    .align-left{
                        text-align: left;
                        padding-left: 2px;
                    }
                    .color{
                        height: 20px;
                    }
                    .single-legend{
                        display: grid;
                        grid-template-columns: 1fr 0.15fr 1fr;
                        justify-content: center;
                        align-items: center;
                        div{
                            line-height: 1em;
                        }
                    }
                    .legend-title{
                        width: 100%;
                        display: flex;
                        justify-content: center;
                        font-size: 18px;
                        margin-bottom: 5px;
                    }
                }
                .ws-status{
                    display: flex;
                    align-items: center;
                    column-gap: 0.5em;
                    margin-top: 0.25rem;
                    .s0{
                        color: yellow;
                    }
                    .s1{
                        color: green;
                    }
                    .s2,.s3{
                        color: red;
                    }
                    .s4{
                        color: white;
                    }
                }
                .update-time{
                    pointer-events: auto;
                    cursor: default;
                }
                .delayed{
                    color: red;
                }
                .replay{
                    color: yellow;
                }
            }
            .int-list{
                position: absolute;
                right: 1px;
                top: 236px;
                z-index: 599;
                display: flex;
                flex-direction: column;
                justify-content: center;
                gap: 10px;
                height: calc(100% - 280px);
                user-select: none;
                pointer-events: none;
                .csis-list,.shindo-list{
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    overflow: hidden;
                    padding: 5px;
                    border-radius: 10px;
                    box-shadow: inset 0 0 10px #ffffff3f, 0 0 10px #0000003f;
                    backdrop-filter: blur(1px);
                    .row{
                        display: flex;
                        justify-content: space-between;
                        gap: 3px;
                        align-items: center;
                        .name{
                            color: #ffffff;
                            width: 120px;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            line-height: 1em;
                        }
                        .int{
                            width: 22px;
                            height: 22px;
                            border-radius: 5px;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            pointer-events: none;
                            user-select: none;
                            .csis {
                                font-size: 16px;
                            }
                            .shindo {
                                font-size: 11px;
                                letter-spacing: -1px;
                                padding-right: 1px;
                            }
                            .shindo::first-letter {
                                font-size: 16px;
                                vertical-align: top;
                            }
                        }
                    }
                }
            }
            .bottom-right{
                position: absolute;
                right: 1px;
                bottom: 1px;
                z-index: 600;
                display: flex;
                align-items: center;
                gap: 0.25rem;
                .mocking{
                    font-size: 24px;
                    color: yellow;
                }
                .mock-1{
                    opacity: 1;
                }
                .mock-0{
                    opacity: 0;
                }
                .home{
                    border-radius: 8px;
                    overflow: hidden;
                    width: 32px;
                    height: 32px;
                    padding: 0;
                }
            }
            .menu{
                position: absolute;
                right: 1px;
                top: 1px;
                z-index: 600;
                border-radius: 10px 0 0 10px;
                overflow: hidden;
                background-color: #ffffff9f;
                backdrop-filter: blur(4px);
            }
        }
        .drawer{
            height: 100%;
            width: 400px;
            overflow: auto;
            z-index: 600;
            background-color: #fff;
        }
        
        .dialog-fade-enter-active {
            transition: all 0.5s ease-out;
        }
        .dialog-fade-leave-active {
            transition: all 0.75s ease-out;
        }

        .dialog-fade-enter-from,
        .dialog-fade-leave-to {
            opacity: 0;
            transform: scale(0.7);
        }

        .dialog-fade-enter-to,
        .dialog-fade-leave-from {
            opacity: 1;
            transform: scale(1);
        }

        .statusContainer {
            z-index: 10000;
            position: fixed;
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .roman.scale-9{
            transform: scaleX(0.9);
        }
        .roman.scale-75{
            transform: scaleX(0.75);
        }
    }
}
</style>