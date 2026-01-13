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

                    <div class="event" v-if="settingsStore.mainSettings.displaySeisNet.niedNet && niedDetectActive">
                        <div class="eew" v-show="menuId != 'eqlists'">
                            <div class="bar gray">
                                <div>
                                    <WarnTriangleFilled style="width: 1em; height: 1em; margin-right: 0.25em;" />
                                    {{ settingsStore.mainSettings.displaySeisNet.niedSource === 'kmoni_image'
                                        ? $t('mainMap.shake.niedkmoni_title')
                                        : $t('mainMap.shake.nied_title') }}
                                </div>
                            </div>
                            <div class="info">
                                <div class="background gray"></div>
                                <div class="right">
                                    <div class="location">{{ niedEpicenterName }}</div>
                                    <div class="time">{{ niedDetectOriginTime }} (UTC+9)</div>
                                    <div class="bottom">
                                        <div class="magnitude" v-if="Number.isFinite(niedDetectMagnitude)">M{{ niedDetectMagnitude.toFixed(2) }}</div>
                                        <div class="depth">{{ $t('mainMap.shake.depth') }}{{ Number.isFinite(niedDetectDepthKm) ? `${Math.round(niedDetectDepthKm)}km` : '-' }}</div>
                                        <div class="type">{{ $t('mainMap.shake.obs_count', { count: niedDetectObsCount }) }}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="event" v-if="settingsStore.mainSettings.displaySeisNet.palertNet && palertDetectActive">
                        <div class="eew" v-show="menuId != 'eqlists'">
                            <div class="bar gray">
                                <div>
                                    <WarnTriangleFilled style="width: 1em; height: 1em; margin-right: 0.25em;" />
                                    {{ $t('mainMap.shake.palert_title') }}
                                </div>
                            </div>
                            <div class="info">
                                <div class="background gray"></div>
                                <div class="right">
                                    <div class="location">{{ palertDetectEpicenterName }}</div>
                                    <div class="time">{{ palertDetectOriginTime }} (UTC+8)</div>
                                    <div class="bottom">
                                        <div class="depth">{{ $t('mainMap.shake.depth') }}{{ Number.isFinite(palertDetectDepthKm) ? `${Math.round(palertDetectDepthKm)}km` : '-' }}</div>
                                        <div class="type">{{ $t('mainMap.shake.obs_count', { count: palertDetectObsCount }) }}</div>
                                    </div>
                                </div>
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
                                    <div class="nied-max-pga-corner" v-if="niedMaxPgaGal != '?'">
                                        {{ niedMaxPgaGal }} gal
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
                        <div class="eew realtime" v-if="settingsStore.mainSettings.displaySeisNet.palertNet">
                            <div class="shindo-bar gray">{{ $t('mainMap.realtime.palert_realtime') }}</div>
                            <div class="info">
                                <div class="intensity" :class="setClassName(palertMaxShindo, true)">
                                    <div class="intensity-title">{{ $t('mainMap.eew.max_intensity') }}</div>
                                    <div :class="palertMaxShindo != '?'?'shindo':'csis'">
                                        {{ palertMaxShindo }}
                                    </div>
                                    <div class="palert-max-pga-corner" v-if="palertMaxPgaGal != '?'">
                                        {{ palertMaxPgaGal }} gal
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="eew realtime" v-if="settingsStore.mainSettings.displaySeisNet.emsdNet">
                            <div class="shindo-bar gray">{{ $t('mainMap.realtime.emsd_realtime') }}</div>
                            <div class="info">
                                <div class="intensity" :class="setClassName(emsdMaxShindo, true)">
                                    <div class="intensity-title">{{ $t('mainMap.eew.max_intensity') }}</div>
                                    <div :class="emsdMaxShindo != '?'?'shindo':'csis'">
                                        {{ emsdMaxShindo }}
                                    </div>
                                    <div class="palert-max-pga-corner" v-if="emsdMaxPgaGal != '?'">
                                        {{ emsdMaxPgaGal }} gal
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="eew realtime" v-if="settingsStore.mainSettings.displaySeisNet.palertNet && palertPeriodMaxShindo != '?'">
                            <div class="shindo-bar" :class="palertPeriodBarClass">{{ $t('mainMap.realtime.palert_period') }}</div>
                            <div class="info">
                                <div class="intensity" :class="setClassName(palertPeriodMaxShindo, true)">
                                    <div class="intensity-title">{{ $t('mainMap.eew.max_intensity') }}</div>
                                    <div :class="palertPeriodMaxShindo != '?'?'shindo':'csis'">
                                        {{ palertPeriodMaxShindo }}
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
                    <div class="update-time" :class="settingsStore.mainSettings.displaySeisNet.delay > 0 ? 'replay' : isPalertDelayed ? 'delayed' : ''" v-if="settingsStore.mainSettings.displaySeisNet.palertNet" @dblclick="resetSeisNetDelay">
                        {{ $t('mainMap.palert_net') }} {{ palertUpdateTime }} (UTC+8)
                    </div>
                    <div class="update-time" :class="settingsStore.mainSettings.displaySeisNet.delay > 0 ? 'replay' : isRshakeDelayed ? 'delayed' : ''" v-if="settingsStore.mainSettings.displaySeisNet.rshakeNet" @dblclick="resetSeisNetDelay">
                        RaspberryShake {{ rshakeUpdateTime }} (UTC+0)
                    </div>
                    <div class="update-time" :class="settingsStore.mainSettings.displaySeisNet.delay > 0 ? 'replay' : isEmsdDelayed ? 'delayed' : ''" v-if="settingsStore.mainSettings.displaySeisNet.emsdNet" @dblclick="resetSeisNetDelay">
                        {{ $t('settings.seisNet.emsd_net') }} {{ emsdUpdateTime }} (UTC+0)
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
                    <el-menu-item index="shake">
                        <el-icon>
                            <BellFilled />
                        </el-icon>
                    </el-menu-item>
                    <el-menu-item index="settings">
                        <el-icon>
                            <Setting />
                        </el-icon>
                    </el-menu-item>
                </el-menu>
            </div>
            <div class="drawer" ref="drawer" v-show="(menuId == 'eqlists' && !settingsStore.mainSettings.hideDrawer) || menuId == 'settings' || menuId == 'shake'">
                <EqlistComponent v-show="menuId == 'eqlists'" />
                <ShakeDetectComponent v-show="menuId == 'shake'" />
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
import { HomeFilled, FullScreen, WarnTriangleFilled, InfoFilled, Setting, BellFilled } from '@element-plus/icons-vue';
import { eewSources, eqlistSources, seisNetSources, sourceTypes, tsunamiSources, useStatusStore } from '@/stores/status';
import { useSettingsStore } from '@/stores/settings';
import { useTimeStore } from '@/stores/time';
import { useShakeDetectionsStore } from '@/stores/shakeDetections';
import EqlistComponent from './EqlistComponent.vue';
import ShakeDetectComponent from './ShakeDetectComponent.vue';
import SettingsComponent from './SettingsComponent.vue';
import { verifyUpToDate, setClassName, getClassLevel, classNameArray, pointDistToCnArea, pointDistToKrArea, csisArray, shindoArray, calcCsisLevel, calcJmaShindoLevel, formatTimeZone, simplifyTopoJson, formatCsis, csisRomanArray, formatShindo, getLevelFromInstShindo, getShindoFromInstShindo, stampToTime, playSound, sendMyNotification, focusWindow, getShindoFromLevel } from '@/utils/Utils';
import { topojsonUrls, iconUrls } from '@/utils/Urls';
import { jmaSeisIntLoc } from '@/utils/JmaSeisIntLoc';
import { isTauri } from '@tauri-apps/api/core';
import { storeToRefs } from 'pinia';
import { simpleIcon, computeNiedStyleColorRadius, TremStation } from '@/classes/StationClasses';
import { safeRemoveLayer, safeAddToMap } from '@/utils/leafletHelpers'
import { feature } from 'topojson-client';
import { cnCityLabels, cnProvinceLabels, jpPrefLabels } from '@/utils/Labels';
import terminator from '@joergdietrich/leaflet.terminator';
import StatusComponent from './StatusComponent.vue';
import eqlistCross from '@/assets/icon/hypocenter/eqlistCross.svg';
import { startMemoryMonitor } from '@/utils/memoryMonitor';

const style = window.getComputedStyle(document.body)
const classNameColors = {}, tsunamiColors = {}
classNameArray.forEach(color => classNameColors[color] = style.getPropertyValue(`--${color}`).trim())
classNameArray.forEach(color => tsunamiColors[color] = style.getPropertyValue(`--tsunami-${color}`).trim())

const _hypoIconRadius = 20
const cwaLatestCrossIcon = L.icon({
    iconUrl: eqlistCross,
    iconSize: [_hypoIconRadius * 2, _hypoIconRadius * 2],
    iconAnchor: [_hypoIconRadius, _hypoIconRadius]
})
const statusStore = useStatusStore()
const settingsStore = useSettingsStore()
const timeStore = useTimeStore()
const shakeDetectionsStore = useShakeDetectionsStore()
let map, jpEewBaseMap, krEewBaseMap, cnEewBaseMap, jpTsunamiBaseMap, cnTsunamiBaseMap, labelLayer1, labelLayer2, terminatorLayer, terminatorFillLayer, cnFaultBaseMap, tileBaseLayer
let eewMarkerPane, eqlistMarkerPane, historyMarkerPane, wavePane, waveFillPane, niedGridPane, tremGridPane, palertGridPane, kmaGridPane, msilNetPane, msilNetLayer, tremRtsLayer, eewBasePane, tsunamiBasePane, labelPane1, labelPane2
let msilWorker
let userMarker
let kanameishiMarker
let jpSeedlinkStationsLayer
let cwaLatestHypoMarker
let gqYuzhnoMarker
let gqYuzhnoEventSource
let gqYuzhnoIdentifier = ''
let gqYuzhnoWaveformPackets = 0
let gqYuzhnoLastWaveform = ''
let gqYuzhnoLastPeakCounts = null
let gqYuzhnoMaxPeakCounts = null
let gqYuzhnoLastPgaGal = null
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

const applyGqPeakCountsToMarker = (marker, peakCounts) => {
    if (!marker || typeof marker.setStyle !== 'function') return
    const v = Number(peakCounts)
    let className = 'dark-gray'
    if (Number.isFinite(v) && v > 0) {
        const log = Math.log10(v)
        // Use existing palette (roughly similar to GlobalQuake's visual severity ramp)
        if (log < 1.5) className = 'gray'          // ~ < 32
        else if (log < 2.2) className = 'blue'     // ~ < 160
        else if (log < 2.7) className = 'green'    // ~ < 500
        else if (log < 3.1) className = 'yellow'   // ~ < 1250
        else if (log < 3.5) className = 'orange'   // ~ < 3200
        else if (log < 3.9) className = 'dark-orange' // ~ < 8000
        else if (log < 4.5) className = 'red'      // ~ < 31600
        else if (log < 5.1) className = 'dark-red' // ~ < 125k
        else className = 'purple'
    }
    const cssColor = classNameColors[className] || classNameColors['dark-gray']
    marker.setStyle({
        color: cssColor,
        fillColor: cssColor,
        opacity: 0.9,
        fillOpacity: 0.35,
        weight: 2,
    })
}

const applyGlobalQuakeMmiToMarker = (marker, pgaGal) => {
    if (!marker || typeof marker.setStyle !== 'function') return
    const v = Number(pgaGal)
    if (!Number.isFinite(v) || v < 0) return

    // GlobalQuake default palette (MMIIntensityScale) keyed by PGA (gal)
    // levels are in ascending PGA order
    let rgb = [170, 170, 170] // I
    if (v >= 0.5) rgb = [170, 170, 170] // I
    if (v >= 1.0) rgb = [200, 190, 240] // II
    if (v >= 2.1) rgb = [132, 162, 232] // III
    if (v >= 5.0) rgb = [130, 214, 255] // IV
    if (v >= 11.0) rgb = [85, 242, 15] // V
    if (v >= 26.0) rgb = [255, 255, 0] // VI
    if (v >= 60.0) rgb = [255, 200, 0] // VII
    if (v >= 140.0) rgb = [255, 120, 0] // VIII
    if (v >= 321.8) rgb = [255, 0, 0] // IX
    if (v >= 740.0) rgb = [190, 0, 0] // X
    if (v >= 1702.0) rgb = [130, 0, 0] // XI
    if (v >= 3000.0) rgb = [65, 0, 0] // XII

    const cssColor = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
    marker.setStyle({
        color: cssColor,
        fillColor: cssColor,
        opacity: 0.9,
        fillOpacity: 0.35,
        weight: 2,
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

// Start memory monitor (auto-reload) — controlled by settings
let _memoryMonitorHandle = null
function startOrRestartMemoryMonitor() {
    try {
        // stop existing
        try { _memoryMonitorHandle?.stop() } catch (e) {}

        const ms = settingsStore.mainSettings
        if (!ms?.memoryAutoReloadEnabled) {
            _memoryMonitorHandle = null
            return
        }

        _memoryMonitorHandle = startMemoryMonitor({
            thresholdMB: Number(ms.memoryAutoReloadThresholdMB) || 2000,
            checkIntervalMs: Number(ms.memoryAutoReloadCheckIntervalMs) || 5000,
            onBeforeReload: ({ usedMB, limitMB, ratio }) => {
                console.warn('Auto memory reload triggered', usedMB, limitMB, ratio)
            },
            enabled: true,
        })
        // expose handle for debugging
        try {
            window._kanameishiDebug = window._kanameishiDebug || {}
            window._kanameishiDebug.memoryMonitor = {
                isRunning: true,
                thresholdMB: Number(ms.memoryAutoReloadThresholdMB) || 2000,
                checkIntervalMs: Number(ms.memoryAutoReloadCheckIntervalMs) || 5000,
                stop: () => { try { _memoryMonitorHandle?.stop(); window._kanameishiDebug.memoryMonitor.isRunning = false; console.info('memoryMonitor: stopped via window handle') } catch (e) { console.error(e) } }
            }
            console.info('memoryMonitor: started', window._kanameishiDebug.memoryMonitor)
        } catch (e) {
            console.error('memoryMonitor: expose failed', e)
        }
    } catch (e) {
        console.error('Failed to start memory monitor', e)
    }
}

onMounted(() => startOrRestartMemoryMonitor())
onBeforeUnmount(() => { try { _memoryMonitorHandle?.stop() } catch (e) {} })

// restart monitor when relevant settings change
watch(() => settingsStore.mainSettings.memoryAutoReloadEnabled, startOrRestartMemoryMonitor)
watch(() => settingsStore.mainSettings.memoryAutoReloadThresholdMB, () => startOrRestartMemoryMonitor())
watch(() => settingsStore.mainSettings.memoryAutoReloadCheckIntervalMs, () => startOrRestartMemoryMonitor())

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
        if(newVal < 1){
            flags.shake1Notified = false
            flags.shake2Notified = false
            flags.focused = false
        }
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
const niedMaxPgaGal = ref('?')
const niedPeriodMaxShindo = ref('?')
const niedPeriodBarClass = ref('gray')
const isNiedDelayed = ref(true)
const niedEpicenterName = ref('')
const niedDetectActive = ref(false)
const niedDetectOriginTime = ref('')
const niedDetectDepthKm = ref(NaN)
const niedDetectObsCount = ref(0)
const niedDetectMagnitude = ref(NaN)
const niedDetectMagnitudeUsed = ref(0)
provide('niedUpdateTime', niedUpdateTime)
provide('niedMaxShindo', niedMaxShindo)
provide('niedMaxPgaGal', niedMaxPgaGal)
provide('niedPeriodMaxShindo', niedPeriodMaxShindo)
provide('niedPeriodBarClass', niedPeriodBarClass)
provide('niedEpicenterName', niedEpicenterName)
provide('niedDetectActive', niedDetectActive)
provide('niedDetectOriginTime', niedDetectOriginTime)
provide('niedDetectDepthKm', niedDetectDepthKm)
provide('niedDetectObsCount', niedDetectObsCount)
provide('niedDetectMagnitude', niedDetectMagnitude)
provide('niedDetectMagnitudeUsed', niedDetectMagnitudeUsed)

const niedMarkerCount = ref(0)
provide('niedMarkerCount', niedMarkerCount)
const tremUpdateTime = ref('1970-01-01 08:00:00')
const tremMaxShindo = ref('?')
const tremPeriodMaxShindo = ref('?')
const tremPeriodBarClass = ref('gray')
const isTremDelayed = ref(true)
provide('tremUpdateTime', tremUpdateTime)
provide('tremMaxShindo', tremMaxShindo)
provide('tremPeriodMaxShindo', tremPeriodMaxShindo)
provide('tremPeriodBarClass', tremPeriodBarClass)

const tremMarkerCount = ref(0)
provide('tremMarkerCount', tremMarkerCount)
const palertUpdateTime = ref('1970-01-01 08:00:00')
const palertMaxShindo = ref('?')
const palertMaxPgaGal = ref('?')
const palertPeriodMaxShindo = ref('?')
const palertPeriodBarClass = ref('gray')
const isPalertDelayed = ref(true)
const palertDetectActive = ref(false)
const palertDetectOriginTime = ref('')
const palertDetectDepthKm = ref(NaN)
const palertDetectObsCount = ref(0)
const palertDetectEpicenterName = ref('')
provide('palertUpdateTime', palertUpdateTime)
provide('palertMaxShindo', palertMaxShindo)
provide('palertMaxPgaGal', palertMaxPgaGal)
provide('palertPeriodMaxShindo', palertPeriodMaxShindo)
provide('palertPeriodBarClass', palertPeriodBarClass)
provide('palertDetectActive', palertDetectActive)
provide('palertDetectOriginTime', palertDetectOriginTime)
provide('palertDetectDepthKm', palertDetectDepthKm)
provide('palertDetectObsCount', palertDetectObsCount)
provide('palertDetectEpicenterName', palertDetectEpicenterName)

const rshakeUpdateTime = ref('1970-01-01 00:00:00')
const isRshakeDelayed = ref(true)
provide('rshakeUpdateTime', rshakeUpdateTime)

const emsdUpdateTime = ref('1970-01-01 00:00:00')
const emsdMaxShindo = ref('?')
const emsdMaxPgaGal = ref('?')
const isEmsdDelayed = ref(true)
provide('emsdUpdateTime', emsdUpdateTime)
provide('emsdMaxShindo', emsdMaxShindo)
provide('emsdMaxPgaGal', emsdMaxPgaGal)

const niedShakeSessionId = ref('')
const palertShakeSessionId = ref('')

const _parseOriginTimeTextToUtcMs = (originTimeText, timeZone) => {
    // originTimeText: 'YYYY-MM-DD HH:mm:ss' (local in given UTC offset)
    if (!originTimeText || !Number.isInteger(timeZone)) return NaN
    const m = String(originTimeText).trim().match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/)
    if (!m) return NaN
    const yyyy = Number(m[1])
    const MM = Number(m[2])
    const dd = Number(m[3])
    const hh = Number(m[4])
    const mm = Number(m[5])
    const ss = Number(m[6])
    if (![yyyy, MM, dd, hh, mm, ss].every(Number.isFinite)) return NaN
    // Convert local(UTC+timeZone) -> UTC
    return Date.UTC(yyyy, MM - 1, dd, hh - timeZone, mm, ss)
}

const niedShakeSessionOriginMs = ref(NaN)
const palertShakeSessionOriginMs = ref(NaN)

const niedShakePrevObsCount = ref(0)
const palertShakePrevObsCount = ref(0)

watch(
    [
        niedDetectActive,
        niedDetectOriginTime,
        niedEpicenterName,
        niedDetectDepthKm,
        niedDetectObsCount,
        niedPeriodMaxShindo,
        () => settingsStore.mainSettings.displaySeisNet.niedSource,
    ],
    ([active, originTimeText, epicenterName, depthKm, obsCount, periodMaxShindo, niedSource]) => {
        if (!originTimeText || (!active && !(Number.isInteger(obsCount) && obsCount > 0))) return;
        const source = niedSource === 'kmoni_image' ? 'niedkmoni' : 'nied';

        const prevObsCount = Number(niedShakePrevObsCount.value) || 0
        const startedByObs = Number.isInteger(obsCount) && obsCount > 0 && prevObsCount <= 0

        const originMs = _parseOriginTimeTextToUtcMs(originTimeText, 9)
        const sessionOriginMs = Number(niedShakeSessionOriginMs.value)
        const shouldRotateSession = (
            niedShakeSessionId.value &&
            Number.isFinite(originMs) &&
            Number.isFinite(sessionOriginMs) &&
            // New event heuristic: origin jumps more than 30s (or goes backwards)
            (Math.abs(originMs - sessionOriginMs) > 30 * 1000 || originMs < sessionOriginMs - 5 * 1000)
        )

        if ((startedByObs || active) && !niedShakeSessionId.value) {
            niedShakeSessionId.value = `shake:${source}:${Date.now()}`
            niedShakeSessionOriginMs.value = originMs
        } else if ((startedByObs || active) && shouldRotateSession) {
            niedShakeSessionId.value = `shake:${source}:${Date.now()}`
            niedShakeSessionOriginMs.value = originMs
        }
        if (!active && (!Number.isInteger(obsCount) || obsCount <= 0)) {
            niedShakeSessionId.value = ''
            niedShakeSessionOriginMs.value = NaN
        }

        niedShakePrevObsCount.value = Number.isInteger(obsCount) ? obsCount : prevObsCount

        shakeDetectionsStore.upsertShake({
            id: niedShakeSessionId.value || undefined,
            source,
            epicenterName,
            originTimeText,
            timeZone: 9,
            depthKm,
            obsCount,
            maxShindo: periodMaxShindo,
        });
    },
    { immediate: true }
)

watch(
    [
        palertDetectActive,
        palertDetectOriginTime,
        palertDetectEpicenterName,
        palertDetectDepthKm,
        palertDetectObsCount,
        palertPeriodMaxShindo,
    ],
    ([active, originTimeText, epicenterName, depthKm, obsCount, periodMaxShindo]) => {
        if (!originTimeText || (!active && !(Number.isInteger(obsCount) && obsCount > 0))) return;

        const prevObsCount = Number(palertShakePrevObsCount.value) || 0
        const startedByObs = Number.isInteger(obsCount) && obsCount > 0 && prevObsCount <= 0

        const originMs = _parseOriginTimeTextToUtcMs(originTimeText, 8)
        const sessionOriginMs = Number(palertShakeSessionOriginMs.value)
        const shouldRotateSession = (
            palertShakeSessionId.value &&
            Number.isFinite(originMs) &&
            Number.isFinite(sessionOriginMs) &&
            (Math.abs(originMs - sessionOriginMs) > 30 * 1000 || originMs < sessionOriginMs - 5 * 1000)
        )

        if ((startedByObs || active) && !palertShakeSessionId.value) {
            palertShakeSessionId.value = `shake:palert:${Date.now()}`
            palertShakeSessionOriginMs.value = originMs
        } else if ((startedByObs || active) && shouldRotateSession) {
            palertShakeSessionId.value = `shake:palert:${Date.now()}`
            palertShakeSessionOriginMs.value = originMs
        }
        if (!active && (!Number.isInteger(obsCount) || obsCount <= 0)) {
            palertShakeSessionId.value = ''
            palertShakeSessionOriginMs.value = NaN
        }

        palertShakePrevObsCount.value = Number.isInteger(obsCount) ? obsCount : prevObsCount

        shakeDetectionsStore.upsertShake({
            id: palertShakeSessionId.value || undefined,
            source: 'palert',
            epicenterName,
            originTimeText,
            timeZone: 8,
            depthKm,
            obsCount,
            maxShindo: periodMaxShindo,
        });
    },
    { immediate: true }
)

watch(
    () => (statusStore.isActive.jmaTsunami ? statusStore.tsunamiMessage.jmaTsunami : null),
    (msg) => {
        if (!msg) return;
        shakeDetectionsStore.upsertTsunami({
            source: 'jmaTsunami',
            id: msg.id,
            titleText: msg.titleText,
            reportTime: msg.reportTime,
            timeZone: msg.timeZone,
            status: msg.status,
        });
    },
    { deep: true, immediate: true }
)

watch(
    () => (statusStore.isActive.nmefcTsunami ? statusStore.tsunamiMessage.nmefcTsunami : null),
    (msg) => {
        if (!msg) return;
        shakeDetectionsStore.upsertTsunami({
            source: 'nmefcTsunami',
            id: msg.id,
            titleText: msg.titleText,
            reportTime: msg.reportTime,
            timeZone: msg.timeZone,
            status: msg.status,
        });
    },
    { deep: true, immediate: true }
)

const palertMarkerCount = ref(0)
provide('palertMarkerCount', palertMarkerCount)

const emsdMarkerCount = ref(0)
provide('emsdMarkerCount', emsdMarkerCount)
const kmaUpdateTime = ref('1970-01-01 09:00:00')
const kmaMaxInt = ref('?')
const kmaPeriodMaxInt = ref('?')
const kmaPeriodBarClass = ref('gray')
const isKmaDelayed = ref(true)
provide('kmaUpdateTime', kmaUpdateTime)
provide('kmaMaxInt', kmaMaxInt)
provide('kmaPeriodMaxInt', kmaPeriodMaxInt)
provide('kmaPeriodBarClass', kmaPeriodBarClass)

const kmaMarkerCount = ref(0)
provide('kmaMarkerCount', kmaMarkerCount)
const msilUpdateTime = ref('1970-01-01 09:00:00')
const msilMaxShindo = ref('?')
const msilPeriodMaxShindo = ref('?')
const msilPeriodBarClass = ref('gray')
const isMsilDelayed = ref(true)
provide('msilUpdateTime', msilUpdateTime)
provide('msilMaxShindo', msilMaxShindo)
provide('msilPeriodMaxShindo', msilPeriodMaxShindo)
provide('msilPeriodBarClass', msilPeriodBarClass)

const msilMarkerCount = ref(0)
provide('msilMarkerCount', msilMarkerCount)
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
    try {
        window._kanameishiWorkers = window._kanameishiWorkers || [];
        window._kanameishiWorkers.push(msilWorker);
    } catch (e) { /* ignore */ }

    map = L.map('mainMap', {
        attributionControl: false,
        center: defaultLatLng,
        zoom: 4,
        minZoom: 2,
        maxZoom: 12,
        zoomSnap: Number(settingsStore.mainSettings.zoomSnap) || 1,
        zoomDelta: Number(settingsStore.mainSettings.zoomDelta) || 1,
        worldCopyJump: true
    })
    // Debug helper: expose lightweight runtime stats and helpers
    try {
        window._kanameishiDebug = window._kanameishiDebug || {}
        // expose map reference for debugging
        try { window._kanameishiDebug.map = map } catch(e) {}
        window._kanameishiDebug.getStats = function () {
            try {
                return {
                    layerCount: map ? Object.keys(map._layers || {}).length : 0,
                    paneCount: map ? Object.keys(map._panes || {}).length : 0,
                    canvasCount: document.querySelectorAll('canvas').length,
                    imgCount: document.querySelectorAll('img').length,
                    usedJSHeapSize: (performance && performance.memory) ? performance.memory.usedJSHeapSize : null,
                    // quick list of worker urls if any were stored on window by the app
                    workerCount: (window._kanameishiWorkers && Array.isArray(window._kanameishiWorkers)) ? window._kanameishiWorkers.length : 0
                }
            }
            catch (e) { return { error: String(e) } }
        }
        window._kanameishiDebug.log = function () { console.log('kanameishiDebug', window._kanameishiDebug.getStats()) }
        window._kanameishiDebug.clearTopoLikeLayers = function () {
            if (!map) return 0
            let removed = 0
            for (const id in map._layers) {
                try {
                    const l = map._layers[id]
                    // heuristic: many topo layers are GeoJSON/vectorGrid and have a featureCount or _vectorTiles
                    if (!l) continue
                    if (l.featureCount || l._vectorTiles || (l instanceof L.GeoJSON) || (l.options && l.options.topojson)) {
                        safeRemoveLayer(map, l)
                        removed++
                    }
                }
                catch (e) { /* ignore per-layer errors */ }
            }
            console.log('kanameishiDebug: removed topo-like layers', removed)
            return removed
        }
    }
    catch (e) { console.warn('kanameishiDebug init failed', e) }
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
    map.createPane('adminBoundaryPane')
    // 行政境界線（県/道など）は塗りやグリッドより前面に出す（ただしラベルよりは下）
    map.getPane('adminBoundaryPane').style.zIndex = 160
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
        map.createPane(`palertStationPane${i}`)
        map.getPane(`palertStationPane${i}`).style.zIndex = i + 50
        map.createPane(`emsdStationPane${i}`)
        map.getPane(`emsdStationPane${i}`).style.zIndex = i + 50
    }
    for(let i = -1; i <= 13; i++){
        map.createPane(`kmaStationPane${i}`)
        map.getPane(`kmaStationPane${i}`).style.zIndex = i + 50
    }

    // JP SeedLink station markers disabled
    jpSeedlinkStationsLayer = null

    // GlobalQuake (port 38000) test: Yuzhno-Sakhalinsk nearest station marker via SSE proxy
    // NOTE: Disabled by default because EventSource auto-retries and spams the console if the proxy is down.
    // Enable by setting: VITE_GQ_YUZHNO_SSE_URL=http://localhost:8788/gq/yuzhno/stream
    map.createPane('gqYuzhnoPane')
    map.getPane('gqYuzhnoPane').style.zIndex = 96
    try {
        const sseUrl = String(import.meta.env.VITE_GQ_YUZHNO_SSE_URL || '').trim()
        if (!sseUrl) throw new Error('gqYuzhno SSE disabled')
        gqYuzhnoEventSource = new EventSource(sseUrl)

        const updateGqPopup = () => {
            if(!gqYuzhnoMarker) return
            const parts = [
                'GQ: ユジノサハリンスク',
                gqYuzhnoIdentifier ? `Station: ${gqYuzhnoIdentifier}` : 'Station: -',
                (gqYuzhnoLastPeakCounts != null) ? `Peak counts: ${Number(gqYuzhnoLastPeakCounts)}` : 'Peak counts: -',
                (gqYuzhnoMaxPeakCounts != null) ? `Peak max: ${Number(gqYuzhnoMaxPeakCounts)}` : 'Peak max: -',
                `Wave packets: ${gqYuzhnoWaveformPackets}`,
                gqYuzhnoLastWaveform ? `Last: ${gqYuzhnoLastWaveform}` : 'Last: -',
            ]
            gqYuzhnoMarker.bindPopup(parts.join('<br/>'))
        }

        gqYuzhnoEventSource.onmessage = (ev) => {
            const line = String(ev?.data || '').trim()
            if(!line) return
            let obj
            try { obj = JSON.parse(line) } catch { return }
            if(!obj || typeof obj !== 'object') return

            if(obj.type === 'nearest') {
                const lat = Number(obj.lat)
                const lon = Number(obj.lon)
                if(Number.isFinite(lat) && Number.isFinite(lon)) {
                    gqYuzhnoIdentifier = String(obj.identifier || '')
                    const color = classNameColors['dark-gray'] || '#333'
                    if(!gqYuzhnoMarker) {
                        gqYuzhnoMarker = L.circleMarker([lat, lon], {
                            radius: 8,
                            weight: 2,
                            color,
                            fillColor: color,
                            opacity: 0.9,
                            fillOpacity: 0.35,
                            pane: 'gqYuzhnoPane',
                            interactive: true,
                        })
                        safeAddToMap(map, gqYuzhnoMarker)
                        gqYuzhnoMarker.bindTooltip('GQ: ユジノサハリンスク', { direction: 'top', className: 'custom-tooltip' })
                    }
                    else {
                        gqYuzhnoMarker.setLatLng([lat, lon])
                    }
                    updateGqPopup()
                }
            }

            if(obj.type === 'waveform') {
                gqYuzhnoWaveformPackets++
                gqYuzhnoLastWaveform = `${obj.bytes || ''}B ${obj.time || ''}`.trim()

                const peakCounts = Number(obj.peakCounts)
                if(Number.isFinite(peakCounts)) {
                    gqYuzhnoLastPeakCounts = peakCounts
                    gqYuzhnoMaxPeakCounts = Math.max(Number(gqYuzhnoMaxPeakCounts || 0), peakCounts)
                    // fallback coloring until station_intensity arrives
                    if (gqYuzhnoLastPgaGal == null) applyGqPeakCountsToMarker(gqYuzhnoMarker, peakCounts)
                }
                updateGqPopup()
            }

            if(obj.type === 'station_intensity') {
                if(gqYuzhnoIdentifier && String(obj.identifier || '') !== gqYuzhnoIdentifier) return
                const pgaGal = Number(obj.maxIntensity)
                if(Number.isFinite(pgaGal)) {
                    gqYuzhnoLastPgaGal = pgaGal
                    applyGlobalQuakeMmiToMarker(gqYuzhnoMarker, pgaGal)
                }
            }

            if(obj.type === 'hypocenter') {
                // Treat GlobalQuake detected earthquakes like EEW (same handling as emergency alerts)
                if(!settingsStore.mainSettings.source?.gqDetectedEew) return

                const originMs = Number(obj.origin)
                const lat = Number(obj.lat)
                const lng = Number(obj.lon)
                const depth = Number(obj.depth)
                const magnitude = Number(obj.mag)
                const revision = Number(obj.rev)
                if(!Number.isFinite(originMs)) return

                const originTime = stampToTime(originMs, 8)
                const maxIntensity = (Number.isFinite(magnitude) && Number.isFinite(depth))
                    ? calcCsisLevel(magnitude, depth)
                    : '不明'
                const isCanceled = false

                const uuid = String(obj.uuid || '')
                const id = uuid ? `gqdet_${uuid}` : `gqdet_${originMs}`
                const hypoName = String(obj.region || '') || 'GlobalQuake'
                const magVal = Number.isFinite(magnitude) ? magnitude : 0
                const depthVal = Number.isFinite(depth) ? depth : 0
                const isWarn = magVal >= 6.0

                const reportNum = Number.isFinite(revision) ? Math.max(1, Math.trunc(revision)) : 1

                const msg = statusStore.eqMessage.gqDetectedEew
                // Ignore out-of-order older revisions
                if (Number.isFinite(msg?.reportNum) && msg.id === id && msg.reportNum > reportNum) return
                Object.assign(msg, {
                    source: 'gqDetectedEew',
                    type: 0,
                    id,
                    isEew: true,
                    timeZone: 8,
                    reportNum,
                    reportNumText: reportNum > 0 ? `第${reportNum}報` : '',
                    reportTime: originTime,
                    isAssumption: false,
                    isWarn,
                    isFinal: false,
                    isCanceled,
                    title: 'GlobalQuake detected',
                    titleText: 'GlobalQuake 検知',
                    hypocenter: hypoName,
                    hypocenterText: hypoName,
                    lat: Number.isFinite(lat) ? lat : 0,
                    lng: Number.isFinite(lng) ? lng : 0,
                    depth: depthVal,
                    depthText: `${depthVal.toFixed(0)} km`,
                    originTime,
                    originTimeText: originTime,
                    magnitude: magVal,
                    magnitudeText: `M${magVal.toFixed(1)}`,
                    useShindo: false,
                    maxIntensity,
                    maxIntensityText: `推定最大烈度 ${maxIntensity}`,
                    warnArea: '[]',
                    className: setClassName(maxIntensity, false, isCanceled),
                })
                statusStore.isActive.gqDetectedEew = true
            }
        }

        gqYuzhnoEventSource.onerror = () => {
            // Stop EventSource auto-retry to prevent console spam & resource growth.
            try { gqYuzhnoEventSource?.close?.() } catch {}
            gqYuzhnoEventSource = null
        }
    } catch {
        // ignore SSE setup errors
    }

    map.createPane('userPane')
    map.getPane('userPane').style.zIndex = 100
    // Ogasawara (kanameishi) marker disabled
    kanameishiMarker = null

    // JP network (SeedLink/IRIS) station markers disabled
    map.createPane('terminatorPane')
    map.getPane('terminatorPane').style.zIndex = 130
    map.createPane('niedGridPane')
    niedGridPane = map.getPane('niedGridPane')
    niedGridPane.style.zIndex = 140
    map.createPane('tremGridPane')
    tremGridPane = map.getPane('tremGridPane')
    tremGridPane.style.zIndex = 140
    map.createPane('palertGridPane')
    palertGridPane = map.getPane('palertGridPane')
    palertGridPane.style.zIndex = 140
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
    // expose common layers for debugging / manual clearing
            try {
        window._kanameishiDebug = window._kanameishiDebug || {}
        window._kanameishiDebug.layers = {
            msilNetLayer,
            tremRtsLayer,
            jpEewBaseMap,
            cnFaultBaseMap,
            jpTsunamiBaseMap,
            tileBaseLayer
        }
        window._kanameishiDebug.clearLayerGroups = function(){
            const list = [];
            try { if (msilNetLayer && msilNetLayer.clearLayers) { msilNetLayer.clearLayers(); list.push('msilNetLayer'); } } catch(e){}
            try { if (tremRtsLayer && tremRtsLayer.clearLayers) { tremRtsLayer.clearLayers(); list.push('tremRtsLayer'); } } catch(e){}
            try { if (jpEewBaseMap && jpEewBaseMap.remove) { safeRemoveLayer(map, jpEewBaseMap); jpEewBaseMap = null; list.push('jpEewBaseMap'); } } catch(e){}
            try { if (cnFaultBaseMap && cnFaultBaseMap.remove) { safeRemoveLayer(map, cnFaultBaseMap); cnFaultBaseMap = null; list.push('cnFaultBaseMap'); } } catch(e){}
            try { if (jpTsunamiBaseMap && jpTsunamiBaseMap.remove) { safeRemoveLayer(map, jpTsunamiBaseMap); jpTsunamiBaseMap = null; list.push('jpTsunamiBaseMap'); } } catch(e){}
            try { if (tileBaseLayer && tileBaseLayer.remove) { safeRemoveLayer(map, tileBaseLayer); tileBaseLayer = null; list.push('tileBaseLayer'); } } catch(e){}
            console.log('kanameishiDebug cleared:', list);
            return list;
        }
    } catch(e) { /* ignore */ }
    if(settingsStore.advancedSettings.preventFlickerMode){
        map.on('zoomstart', ()=>{setMapHeight('calc(100% - 1px)');})
        map.on('zoomend', ()=>{setMapHeight('100%');})
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    watchEffect(()=>{
        if(userMarker) safeRemoveLayer(map, userMarker)
        if(isDisplayUser.value){
            userMarker = L.circleMarker(userLatLng.value, {
                radius: 8,
                fillOpacity: 0.5,
                weight: 2,
                pane: 'userPane',
                interactive: false
            })
            safeAddToMap(map, userMarker)
        }
        nearestJmaLoc.value
    })

    // react to zoomSnap/zoomDelta changes at runtime
    watch(
        () => [settingsStore.mainSettings.zoomSnap, settingsStore.mainSettings.zoomDelta],
        ([snap, delta]) => {
            if (!map) return
            const newSnap = Number(snap)
            const newDelta = Number(delta)
            if (Number.isFinite(newSnap)) map.options.zoomSnap = newSnap
            if (Number.isFinite(newDelta)) map.options.zoomDelta = newDelta
            // reapply current zoom to respect new snap
            try {
                map.setZoom(map.getZoom(), { animate: false })
            } catch(e) {}
        }
    )
    watchEffect(() => {
        waveFillPane.style.display = settingsStore.mainSettings.fillSWave ? 'block' : 'none'
    })
    watchEffect(() => {
        eqlistMarkerPane.style.display = historyList.length > 0 ? 'none' : 'block'
        historyMarkerPane.style.display = historyList.length > 0 ? 'block' : 'none'
    })

    const updateCwaLatestHypoMarker = () => {
        const isEnabled = !!settingsStore.mainSettings.source?.cwaOpendataEqlist
        const latest = statusStore.history?.cwaOpendataEqlist?.[0]

        if(!map || !isEnabled || !latest) {
            if(cwaLatestHypoMarker) safeRemoveLayer(map, cwaLatestHypoMarker)
            cwaLatestHypoMarker = null
            return
        }

        const lat = Number(latest.lat)
        const lng = Number(latest.lng)
        if(!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
            if(cwaLatestHypoMarker) safeRemoveLayer(map, cwaLatestHypoMarker)
            cwaLatestHypoMarker = null
            return
        }

        const latLng = [lat, lng]
        if(!cwaLatestHypoMarker) {
            cwaLatestHypoMarker = L.marker(latLng, {
                icon: cwaLatestCrossIcon,
                pane: 'eqlistMarkerPane',
                interactive: false,
            })
            safeAddToMap(map, cwaLatestHypoMarker)
        }
        else {
            cwaLatestHypoMarker.setLatLng(latLng)
        }
    }

    watch(
        () => {
            const latest = statusStore.history?.cwaOpendataEqlist?.[0]
            return `${settingsStore.mainSettings.source?.cwaOpendataEqlist ? 1 : 0}|${latest?.id || ''}|${latest?.lat || ''}|${latest?.lng || ''}|${latest?.maxIntensity || ''}`
        },
        () => updateCwaLatestHypoMarker(),
        { immediate: true }
    )
    watchEffect(() => {
        if(activeEqlistList.value.length > 0) {
            if(settingsStore.mainSettings.cinemaMode && tempEqlists.value.endsWith('Eqlist')) {
                eqlistList.forEach(event => {
                    event.hypoMarker?.setOpacity(tempEqlists.value == event.eqMessage.source ? 1 : 0.3)
                })

                if(cwaLatestHypoMarker) {
                    cwaLatestHypoMarker.setOpacity(tempEqlists.value == 'cwaOpendataEqlist' ? 1 : 0.3)
                }
            }
            else {
                eqlistList.forEach(event => {
                    event.hypoMarker?.setOpacity(event.isActive ? 1 : 0.3)
                })

                if(cwaLatestHypoMarker) {
                    // CWA最新は「常時最新表示」枠扱い（=非アクティブ相当）
                    cwaLatestHypoMarker.setOpacity(0.3)
                }
            }
        }
        else {
            eqlistList.forEach(event => {
                event.hypoMarker?.setOpacity(1)
            })

            if(cwaLatestHypoMarker) {
                cwaLatestHypoMarker.setOpacity(1)
            }
        }
    })
    labelLayer1 = L.layerGroup()
    safeAddToMap(map, labelLayer1)
    labelLayer2 = L.layerGroup()
    safeAddToMap(map, labelLayer2)
    loadMaps()
    loadMsilNet()
    loadTremRts()

    // React to base map preference changes (tile vs vector)
    watch(
        () => [settingsStore.mainSettings.useTileBaseMap, settingsStore.mainSettings.tileProviderUrl],
        async () => {
            // force reload of base maps
            mapsLoaded = false
            try { if (tileBaseLayer) { safeRemoveLayer(map, tileBaseLayer); tileBaseLayer = null } } catch(_){}
            tileBaseLayer = null
            try { if (jpEewBaseMap) { safeRemoveLayer(map, jpEewBaseMap); jpEewBaseMap = null } } catch(_){}
            try { if (krEewBaseMap) { safeRemoveLayer(map, krEewBaseMap); krEewBaseMap = null } } catch(_){ }
            try { if (cnEewBaseMap) { safeRemoveLayer(map, cnEewBaseMap); cnEewBaseMap = null } } catch(_){ }
            try { if (jpTsunamiBaseMap) { safeRemoveLayer(map, jpTsunamiBaseMap); jpTsunamiBaseMap = null } } catch(_){ }
            await loadMaps()
        }
    )

    watch(
        () => settingsStore.mainSettings.displaySeisNet.tremNet,
        (newVal) => {
            if (newVal) safeAddToMap(map, tremRtsLayer)
            else safeRemoveLayer(map, tremRtsLayer)
        },
        { immediate: true }
    )

    watch(
        () => settingsStore.mainSettings.displaySeisNet.msilNet,
        (newVal) => {
            if (newVal) safeAddToMap(map, msilNetLayer)
            else safeRemoveLayer(map, msilNetLayer)
        },
        { immediate: true }
    )

    watch(() => settingsStore.mainSettings.displayTerminator, newVal => {
        if(terminatorLayer) safeRemoveLayer(map, terminatorLayer)
        if(terminatorFillLayer) safeRemoveLayer(map, terminatorFillLayer)
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
            })
            safeAddToMap(map, terminatorLayer)
            terminatorFillLayer = terminator({
                fillColor: 'black',
                fillOpacity: 0.25,
                stroke: false,
                pane: 'terminatorFillPane',
                interactive: false,
                time
            })
            safeAddToMap(map, terminatorFillLayer)
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
        kmaGridPane.style.opacity = 0.3 * (blinkStatus.value && !statusStore.isActive.kmaEew ? 1 : 0)
        palertGridPane.style.opacity = 0.3
        msilNetPane.style.opacity = 0.3
    }
    else{
        eewMarkerPane.style.opacity = 1 * (blinkStatus.value ? 1 : 0)
        wavePane.style.opacity = 1
        waveFillPane.style.opacity = 1
        niedGridPane.style.opacity = 1 * (blinkStatus.value && !statusStore.isActive.jmaEew ? 1 : 0)
        tremGridPane.style.opacity = 1 * (blinkStatus.value && !statusStore.isActive.cwaEew ? 1 : 0)
        kmaGridPane.style.opacity = 1 * (blinkStatus.value && !statusStore.isActive.kmaEew ? 1 : 0)
        palertGridPane.style.opacity = 1
        msilNetPane.style.opacity = 1
    }
    tsunamiBasePane.style.opacity = (tsunamiFlickerCounter ? 1 : 0) * (menuId.value == 'eews' ? 0.3 : 1)
    isNiedDelayed.value = !verifyUpToDate(niedUpdateTime.value, 9, 10000)
    isTremDelayed.value = !verifyUpToDate(tremUpdateTime.value, 8, 10000)
    isPalertDelayed.value = !verifyUpToDate(palertUpdateTime.value, 8, 10000)
    isEmsdDelayed.value = !verifyUpToDate(emsdUpdateTime.value, 0, 10000)
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
const panes = ['basePane', 'adminBoundaryPane', 'eewBasePane', 'tsunamiBasePane', 'faultBasePane']
settingsStore.mainSettings.useCanvasRenderer && panes.forEach(pane => renderers[pane] = L.canvas({ pane }))
let mapsLoaded = false
const loadMaps = async (retries = 0) => {
    if (mapsLoaded) return
    // If user prefers tile base map, add tile layer and skip topojson loading
    try {
        if (settingsStore.mainSettings.useTileBaseMap) {
            const url = settingsStore.mainSettings.tileProviderUrl || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            if (tileBaseLayer) {
                // update URL by removing old and creating new
                try { safeRemoveLayer(map, tileBaseLayer) } catch {}
                tileBaseLayer = null
            }
            tileBaseLayer = L.tileLayer(url, { pane: 'basePane', attribution: '&copy; OpenStreetMap contributors' })
            safeAddToMap(map, tileBaseLayer)
            mapsLoaded = true
            return
        }
    } catch (e) {
        console.log('tile base map load failed', e)
    }
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
    let shouldRetry = false

    const getTopoJson = async (key) => {
        const url = topojsonUrls[key]
        if(!url) return null
        try {
            if(!isTauri() && ('caches' in window)){
                const cache = await caches.open('topojson')
                const cached = await cache.match(url)
                if(cached) return await cached.json()
            }
            const resp = await fetch(url)
            if(!resp?.ok) return null
            return await resp.json()
        } catch (_) {
            return null
        }
    }

    // Load only what we actually need to render at startup.
    // This keeps parsed topojson objects out of memory when features are disabled.
    const shouldLoadEewBaseMaps = !!(settingsStore.advancedSettings.forceCalcInt && !settingsStore.mainSettings.disableEewBaseMap)
    const shouldLoadJpTsunami = !!settingsStore.mainSettings.source.jmaTsunami

    const [global, jp, countries10m] = await Promise.all([
        getTopoJson('global'),
        getTopoJson('jp'),
        getTopoJson('countries10m'),
    ])

    // Admin boundaries: prefer internal versions, fallback to non-internal.
    const cn_adm1_internal = await getTopoJson('cn_adm1_internal')
    const cn_adm1 = cn_adm1_internal?.type ? null : await getTopoJson('cn_adm1')
    const kr_adm1_internal = await getTopoJson('kr_adm1_internal')
    const kr_adm1 = kr_adm1_internal?.type ? null : await getTopoJson('kr_adm1')
    const tw_adm1_internal = await getTopoJson('tw_adm1_internal')
    const tw_adm1 = tw_adm1_internal?.type ? null : await getTopoJson('tw_adm1')

    const [cn_eew, jp_eew, kr_eew, jp_tsunami] = await Promise.all([
        shouldLoadEewBaseMaps ? getTopoJson('cn_eew') : Promise.resolve(null),
        shouldLoadEewBaseMaps ? getTopoJson('jp_eew') : Promise.resolve(null),
        shouldLoadEewBaseMaps ? getTopoJson('kr_eew') : Promise.resolve(null),
        shouldLoadJpTsunami ? getTopoJson('jp_tsunami') : Promise.resolve(null),
    ])

    if(global && jp && (!shouldLoadEewBaseMaps || (cn_eew && jp_eew && kr_eew)) && (!shouldLoadJpTsunami || jp_tsunami)){
        clearTimeout(msgTimer)
        loadBaseMap(global, 'basePane', true, undefined, { filterFeature: _isTaiwanOrKoreaByBboxCenter })
        loadBaseMap(jp, 'basePane')

        // 台湾・韓国・中国(大陸部)の輪郭をより高精度(10m)の国境データで上書き
        if(countries10m && countries10m.objects?.countries){
            try {
                const countriesGeo = feature(countries10m, countries10m.objects.countries)
                const wanted = new Set([158, 410, 408, 156]) // TW, KR, KP, CN
                const overlayGeo = {
                    type: 'FeatureCollection',
                    features: (countriesGeo?.features || []).filter(f => wanted.has(Number(f.id)))
                }
                safeAddToMap(map, L.geoJson(overlayGeo, {
                    pane: 'basePane',
                    renderer: settingsStore.mainSettings.useCanvasRenderer && renderers['basePane'],
                    style: {
                        color: '#ccc',
                        fillColor: '#393939',
                        fillOpacity: 1,
                        weight: 1,
                        fill: true
                    },
                    interactive: false
                }))
            } catch (e) {
                console.log(e)
            }
        }

        // 国際GeoJSON由来の行政境界（線のみ・最前面）
        const adminLineStyle = {
            // 日本のベース地図（loadBaseMap のデフォルト）と線の見た目を統一
            color: '#ccc',
            opacity: 1,
            weight: 1,
            fill: false,
            fillOpacity: 0
        }
        if(cn_adm1_internal?.type) {
            loadBaseMap(cn_adm1_internal, 'adminBoundaryPane', false, adminLineStyle, { simplifyFactor: 0 })
        }
        else if(cn_adm1?.type) {
            // internal が無い場合はポリゴンの輪郭で代用
            loadBaseMap(cn_adm1, 'adminBoundaryPane', false, adminLineStyle, { simplifyFactor: 0 })
        }

        if(kr_adm1_internal?.type) {
            loadBaseMap(kr_adm1_internal, 'adminBoundaryPane', false, adminLineStyle, { simplifyFactor: 0 })
        }
        else if(kr_adm1?.type) {
            loadBaseMap(kr_adm1, 'adminBoundaryPane', false, adminLineStyle, { simplifyFactor: 0 })
        }
        if(tw_adm1_internal?.type) {
            loadBaseMap(tw_adm1_internal, 'adminBoundaryPane', false, adminLineStyle, { simplifyFactor: 0 })
        }
        else if(tw_adm1?.type) {
            loadBaseMap(tw_adm1, 'adminBoundaryPane', false, adminLineStyle, { simplifyFactor: 0 })
        }

        // EEW base maps are only needed for forceCalcInt (area-based intensity estimation).
        // Keep them out of memory otherwise.
        jpEewBaseMap = null
        krEewBaseMap = null
        cnEewBaseMap = null
        if(shouldLoadEewBaseMaps) {
            jpEewBaseMap = loadBaseMap(jp_eew, 'eewBasePane', false, {
                color: '#bbbbbb00',
                opacity: 1,
                fillColor: '#39393900',
                fillOpacity: 1,
                weight: 1,
            })
            krEewBaseMap = loadBaseMap(kr_eew, 'eewBasePane', false, {
                color: '#bbbbbb00',
                opacity: 1,
                fillColor: '#39393900',
                fillOpacity: 1,
                weight: 1,
            }, { simplifyFactor: 0 })
            cnEewBaseMap = loadBaseMap(cn_eew, 'eewBasePane', false, {
                color: '#bbbbbb00',
                opacity: 1,
                fillColor: '#39393900',
                fillOpacity: 1,
                weight: 1,
            })
        }

        // CN fault layer can be large; load on-demand to reduce memory when disabled.
        watch(()=>settingsStore.mainSettings.displayCnFault, async newVal => {
            if(cnFaultBaseMap) safeRemoveLayer(map, cnFaultBaseMap)
            cnFaultBaseMap = null
            if(newVal) {
                const cn_fault = await getTopoJson('cn_fault')
                if(cn_fault) {
                    cnFaultBaseMap = loadBaseMap(cn_fault, 'faultBasePane', true, {
                        color: 'red',
                        opacity: 0.5,
                        weight: 1,
                    })
                }
            }
        }, { immediate: true })
        if(settingsStore.advancedSettings.forceCalcInt){
            watch(eewInfoList, newVal=>{
                const newCsisList = {}
                const cnAreaClass = {}, krAreaClass = {}
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
                         cnAreaClass[layerName] = className
                        if(!(maxInt in newCsisList)) newCsisList[maxInt] = []
                        newCsisList[maxInt].push(layerName)
                    }
                })
                krEewBaseMap?.eachLayer(layer=>{
                    let maxInt = 0
                    newVal.forEach(info=>{
                        const dist = pointDistToKrArea([info.lng, info.lat], layer.feature)
                        const int = Number(calcCsisLevel(info.magnitude, info.depth, dist))
                        if(int > maxInt) maxInt = int
                    })
                    if(maxInt > 0){
                        const className = setClassName(maxInt, false)
                        const layerName = layer.feature.properties.name
                        krAreaClass[layerName] = className
                        if(!(maxInt in newCsisList)) newCsisList[maxInt] = []
                        newCsisList[maxInt].push(layerName)
                    }
                })
                cnEewBaseMap?.setStyle(feature => {
                    const className = cnAreaClass[feature.properties.name]
                    return ({
                        color: className ? '#bbbbbb' : '#bbbbbb00',
                        fillColor: classNameColors[className] || '#39393900'
                    })
                })
                krEewBaseMap?.setStyle(feature => {
                    const className = krAreaClass[feature.properties.name]
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
        if(settingsStore.mainSettings.source.jmaTsunami && jp_tsunami) {
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
        // cn_tsunami is optional and may not exist in this build.
        if(settingsStore.mainSettings.source.nmefcTsunami) {
            // no-op unless cn_tsunami topojson is provided
        }

        mapsLoaded = true
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
    palertGridPane.style.opacity = (menuId.value == 'eqlists' ? 0.3 : 1)
    kmaGridPane.style.opacity = (blinkStatus.value && !statusStore.isActive.kmaEew ? 1 : 0) * (menuId.value == 'eqlists' ? 0.3 : 1)
    msilNetPane.style.opacity = (menuId.value == 'eqlists' ? 0.3 : 1)
    tsunamiBasePane.style.opacity = (tsunamiFlickerCounter ? 1 : 0) * (menuId.value == 'eews' ? 0.3 : 1)
    isNiedDelayed.value = !verifyUpToDate(niedUpdateTime.value, 9, 10000)
    isTremDelayed.value = !verifyUpToDate(tremUpdateTime.value, 8, 10000)
    isPalertDelayed.value = !verifyUpToDate(palertUpdateTime.value, 8, 10000)
    isEmsdDelayed.value = !verifyUpToDate(emsdUpdateTime.value, 0, 10000)
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
function handleVisibilityChange() {
    if (document.visibilityState === 'visible' && pendingSetView) {
        pendingSetView = false
        setView()
    }
}
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
        krEewBaseMap?.eachLayer(layer => {
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
                    case 'palertGridPane':
                        shouldExtend = true
                        break
          case 'kmaGridPane':
            if(!statusStore.isActive.kmaEew) {
                                shouldExtend = true
                            }
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
        krEewBaseMap?.eachLayer(layer => {
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
            krEewBaseMap?.eachLayer(layer => {
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
let lastSetViewMs = 0

const _walkCoords = (coords, cb) => {
    if(!coords) return
    if(typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        cb(coords)
        return
    }
    for(const c of coords) _walkCoords(c, cb)
}
const _bboxCenterLngLat = (feature) => {
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
    _walkCoords(feature?.geometry?.coordinates, ([lng, lat]) => {
        if(lng < minLng) minLng = lng
        if(lat < minLat) minLat = lat
        if(lng > maxLng) maxLng = lng
        if(lat > maxLat) maxLat = lat
    })
    if(!Number.isFinite(minLng) || !Number.isFinite(minLat) || !Number.isFinite(maxLng) || !Number.isFinite(maxLat)) return null
    return [(minLng + maxLng) / 2, (minLat + maxLat) / 2]
}
const _isInBox = ([lng, lat], box) => {
    const [minLng, minLat, maxLng, maxLat] = box
    return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat
}
const _isTaiwanOrKoreaByBboxCenter = (feature) => {
    const center = _bboxCenterLngLat(feature)
    if(!center) return false
    const taiwanBox = [119.0, 20.8, 122.3, 26.6]
    const koreaBox = [124.0, 33.0, 131.5, 43.8]
    return _isInBox(center, taiwanBox) || _isInBox(center, koreaBox)
}
const _isTaiwanByBboxCenter = (feature) => {
    const center = _bboxCenterLngLat(feature)
    if(!center) return false
    const taiwanBox = [119.0, 20.8, 122.3, 26.6]
    return _isInBox(center, taiwanBox)
}

// Feature を落とさずに、特定のbbox内にあるサブポリゴンだけ除外する（中国の MultiPolygon に台湾が含まれるケース対策）
const _stripPolygonsInBox = (geojson, box) => {
    if(!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) return geojson
    const out = {
        ...geojson,
        features: geojson.features.map((f) => {
            const g = f?.geometry
            if(!g || !g.type) return f

            // Polygon: coords = [ring[]]
            // MultiPolygon: coords = [[ring[]]]
            if(g.type === 'Polygon') {
                const center = _bboxCenterLngLat(f)
                if(center && _isInBox(center, box)) return null
                return f
            }
            if(g.type === 'MultiPolygon' && Array.isArray(g.coordinates)) {
                const kept = []
                for(const poly of g.coordinates) {
                    // poly is [ring[]]
                    const tmpFeature = { type: 'Feature', geometry: { type: 'Polygon', coordinates: poly }, properties: f.properties }
                    const center = _bboxCenterLngLat(tmpFeature)
                    if(center && _isInBox(center, box)) continue
                    kept.push(poly)
                }
                if(kept.length === 0) return null
                return { ...f, geometry: { ...g, coordinates: kept } }
            }
            return f
        }).filter(Boolean)
    }
    return out
}
const loadBaseMap = (geoData, pane, isBaseMap = true, style = {
        color: '#ccc',
        fillColor: '#393939',
        fillOpacity: 1,
        weight: 1,
        fill: true
    }, options = {})=>{
    if(geoData && Object.keys(geoData).length != 0){
        try {
            const isTopo = geoData?.type === 'Topology' && geoData?.objects?.region
            const isGeo = geoData?.type === 'FeatureCollection' || geoData?.type === 'Feature'

            if(isBaseMap && !settingsStore.advancedSettings.useClassicMapLoader) {
                let geojson = isTopo ? feature(geoData, geoData.objects.region) : geoData
                // ベース世界地図の MultiPolygon に台湾が混ざっている場合、台湾部分だけ落とす
                if(pane === 'basePane') {
                    const taiwanBox = [119.0, 20.8, 122.3, 26.6]
                    geojson = _stripPolygonsInBox(geojson, taiwanBox)
                }
                if(typeof options?.filterFeature === 'function') {
                    geojson.features = (geojson.features || []).filter(f => !options.filterFeature(f))
                }
                const vectorGrid = L.vectorGrid.slicer(geojson, {
                    pane,
                    rendererFactory: L.canvas.tile,
                    vectorTileLayerStyles: {
                        sliced: style
                    },
                    interactive: false
                });
                safeAddToMap(map, vectorGrid)
                return vectorGrid;
            }
            else {
                const factor = isBaseMap ? 0 : (options?.simplifyFactor ?? settingsStore.mainSettings.mapSimplifyFactor)
                const simplified = isTopo ? simplifyTopoJson(geoData, factor) : geoData
                let geojson = isTopo ? feature(simplified, simplified.objects.region) : simplified
                if(pane === 'basePane') {
                    const taiwanBox = [119.0, 20.8, 122.3, 26.6]
                    geojson = _stripPolygonsInBox(geojson, taiwanBox)
                }
                if(typeof options?.filterFeature === 'function') {
                    geojson.features = (geojson.features || []).filter(f => !options.filterFeature(f))
                }
                const baseMap = L.geoJson(geojson, {
                    pane,
                    renderer: settingsStore.mainSettings.useCanvasRenderer && renderers[pane],
                    style,
                    interactive: settingsStore.mainSettings.placeNameOnHover && !settingsStore.mainSettings.useCanvasRenderer,
                    onEachFeature: settingsStore.mainSettings.placeNameOnHover && !settingsStore.mainSettings.useCanvasRenderer && onEachFeature
                })
                safeAddToMap(map, baseMap)
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
const eewInfoList = computed(()=>{
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
let tremRtsInFlight = false
let tremRtsAbortController = null
let tremRtsZoomHandlerAttached = false
const tremRtsZoomHandler = () => {
    for (const id in tremStations.value) {
        tremStations.value[id]?.render?.()
    }
}
let tremRtsGridDecimal = [0, 0]
const tremRtsGridRects = {}
let tremRtsPeriodMaxLevel = -1

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
const tremRtsLatchedBin = ref(-1)
const tremRtsLatchUntilMs = ref(0)
const tremRtsLatchHoldMs = 10000

const tremRtsMaxWindowMs = 60000
let tremRtsFrameMaxHistory = []

const _clearTremRtsMaxWindow = () => {
    tremRtsFrameMaxHistory = []
}

const _updateTremRtsMaxWindow = (frameTimeMs, frameMaxInst) => {
    const t = Number(frameTimeMs)
    const timeMs = Number.isFinite(t) ? t : Date.now()
    const v = Number(frameMaxInst)
    tremRtsFrameMaxHistory.push({ t: timeMs, v: Number.isFinite(v) ? v : null })

    const cutoff = timeMs - tremRtsMaxWindowMs
    while (tremRtsFrameMaxHistory.length && tremRtsFrameMaxHistory[0].t < cutoff) {
        tremRtsFrameMaxHistory.shift()
    }

    let max = null
    for (const item of tremRtsFrameMaxHistory) {
        if (item?.v === null || item?.v === undefined) continue
        max = (max === null) ? item.v : Math.max(max, item.v)
    }
    tremRtsMaxInst.value = max
}

const tremRtsStationWindowMs = 60000
const tremRtsStationWindowSize = 60
let tremRtsStationWindows = {}

const _clearTremRtsStationWindows = () => {
    tremRtsStationWindows = {}
}

const _getTremRtsStationMax60s = (id, frameTimeMs, instValue) => {
    const t = Number(frameTimeMs)
    const timeMs = Number.isFinite(t) ? t : Date.now()

    let w = tremRtsStationWindows[id]
    if (!w) {
        w = {
            times: new Float64Array(tremRtsStationWindowSize),
            vals: new Float64Array(tremRtsStationWindowSize),
            idx: 0,
        }
        w.vals.fill(Number.NaN)
        tremRtsStationWindows[id] = w
    }

    const v = Number(instValue)
    w.times[w.idx] = timeMs
    w.vals[w.idx] = Number.isFinite(v) ? v : Number.NaN
    w.idx = (w.idx + 1) % tremRtsStationWindowSize

    const cutoff = timeMs - tremRtsStationWindowMs
    let max = Number.NaN
    for (let i = 0; i < tremRtsStationWindowSize; i += 1) {
        const tt = w.times[i]
        if (tt >= cutoff) {
            const vv = w.vals[i]
            if (!Number.isNaN(vv)) max = Number.isNaN(max) ? vv : Math.max(max, vv)
        }
    }
    return Number.isNaN(max) ? null : max
}

const _updateTremRtsLatchedBin = (rawBin) => {
    const now = Date.now()
    const current = Number.isFinite(rawBin) ? rawBin : -1
    const prev = tremRtsLatchedBin.value

    // If it rises, update immediately and extend the hold window.
    if (current > prev) {
        tremRtsLatchedBin.value = current
        tremRtsLatchUntilMs.value = now + tremRtsLatchHoldMs
        return
    }

    // If it's stable at >=1, keep extending the hold window (sliding).
    if (current === prev && current >= 1) {
        tremRtsLatchUntilMs.value = now + tremRtsLatchHoldMs
        return
    }

    // If it drops, keep the previous value until the hold window expires.
    if (current < prev && now < tremRtsLatchUntilMs.value) {
        return
    }

    // Otherwise accept the new value (including drops after expiry).
    tremRtsLatchedBin.value = current
}

const tremRtsShakeFlags = reactive({ shake1Notified: false, shake2Notified: false, focused: false })
const tremRtsPrevBins = reactive({})
const tremRtsRisingCount = ref(0)
const tremRtsSensitivity = computed(() => settingsStore.mainSettings.displaySeisNet.tremSensitivity ?? 2)
const tremRtsRisingCountThreshold = computed(() => {
    switch (tremRtsSensitivity.value) {
        case 0: return Infinity
        case 1: return 5
        case 2: return 3
        case 3: return 2
        default: return 3
    }
})

const tremRtsActivateBinThreshold = computed(() => {
    const display0 = !!settingsStore.mainSettings.displaySeisNet.displayShindo0
    switch (tremRtsSensitivity.value) {
        case 0: return Infinity
        case 1: return 2
        case 2: return 1
        case 3: return display0 ? 0 : 1
        default: return 1
    }
})

const tremDelayMs = computed(() => settingsStore.mainSettings.displaySeisNet.delay * 60000)

watch(
    () => settingsStore.mainSettings.displaySeisNet.tremNet,
    (newVal) => {
        if(!newVal) {
            tremRtsMaxInst.value = null
            tremRtsLatchedBin.value = -1
            tremRtsLatchUntilMs.value = 0
            _clearTremRtsMaxWindow()
            _clearTremRtsStationWindows()
            for(const k in tremRtsPrevBins) delete tremRtsPrevBins[k]
            tremRtsRisingCount.value = 0
            tremRtsShakeFlags.shake1Notified = false
            tremRtsShakeFlags.shake2Notified = false
            tremRtsShakeFlags.focused = false
        }
    }
)

watch(tremRtsCurrentBin, (rawBin) => {
    if(!settingsStore.mainSettings.displaySeisNet.tremNet) return
    _updateTremRtsLatchedBin(rawBin)
})

const _getTremRtsNiedStyle = (instShindo) => {
    const zoom = map?.getZoom?.() ?? settingsStore.mainSettings.defaultZoom
    const level = getLevelFromInstShindo(Number.isFinite(instShindo) ? instShindo : -3.1)
    return computeNiedStyleColorRadius(level, zoom)
}

const _clearTremRtsGridRects = () => {
    for (const key in tremRtsGridRects) {
        const item = tremRtsGridRects[key]
        if (item?.layer) safeRemoveLayer(map, item.layer)
        delete tremRtsGridRects[key]
    }
}

const _updateTremRtsGridRectsFromStations = () => {
    if (!map) return
    // Throttle heavy view calculations to avoid excessive CPU when called frequently
    const nowMs = Date.now()
    const minIntervalMs = 800 // adjust as needed
    if (nowMs - lastSetViewMs < minIntervalMs) return
    lastSetViewMs = nowMs

    const active = []
    for (const id in tremStations.value) {
        const st = tremStations.value[id]
        if (st?.isActive) active.push(st)
    }

    // No active grids => clear.
    if (active.length === 0) {
        _clearTremRtsGridRects()
        tremRtsPeriodMaxLevel = -1
        tremPeriodMaxShindo.value = '?'
        tremPeriodBarClass.value = 'gray'
        statusStore.isActive.tremNet = false
        return
    }

    // Build per-cell max level.
    const grids = {}
    for (const st of active) {
        const latLng = st.latLng.map((l, index) => Math.round(l - tremRtsGridDecimal[index]) + tremRtsGridDecimal[index])
        const level = Number.isFinite(st.tremGridLevel) ? st.tremGridLevel : st.level
        const key = JSON.stringify(latLng)
        if (key in grids) {
            if (level > grids[key].level) grids[key].level = level
        } else {
            grids[key] = { latLng, level }
        }
    }

    let frameMaxLevel = -1
    let frameMaxColor = 'gray'

    for (const key in grids) {
        const item = grids[key]
        const color = item.level <= 7 ? 'green' : item.level <= 13 ? 'yellow' : 'red'
        if (item.level > frameMaxLevel) {
            frameMaxLevel = item.level
            frameMaxColor = color
        }

        if (!(key in tremRtsGridRects)) {
                const layer = L.rectangle(
                [item.latLng.map((l) => l - 0.495), item.latLng.map((l) => l + 0.495)],
                {
                    color,
                    weight: 2,
                    fill: false,
                    pane: 'tremGridPane',
                    interactive: false,
                }
            )
            safeAddToMap(map, layer)

            tremRtsGridRects[key] = { color, layer }
        } else if (tremRtsGridRects[key].color !== color) {
            tremRtsGridRects[key].color = color
            tremRtsGridRects[key].layer.setStyle({ color })
        }
    }

    for (const key in tremRtsGridRects) {
        if (!(key in grids)) {
            const layer = tremRtsGridRects[key]?.layer
            if (layer) safeRemoveLayer(map, layer)
            delete tremRtsGridRects[key]
        }
    }

    if (frameMaxLevel > tremRtsPeriodMaxLevel) tremRtsPeriodMaxLevel = frameMaxLevel
    tremPeriodMaxShindo.value = getShindoFromLevel(tremRtsPeriodMaxLevel)
    tremPeriodBarClass.value = frameMaxColor
    statusStore.isActive.tremNet = true
}

const updateTremMarkers = (data, frameTimeMs) => {
    const render = document.visibilityState === 'visible'
    let max = null
    let risingCount = 0
    const activateBinThres = tremRtsActivateBinThreshold.value

    let firstActive = null

    for (const id in tremStations.value) {
        const station = tremStations.value[id]
        const stationData = data?.[id]
        const shindo = stationData?.i

        // Per-station display value: rolling max of the last 60 seconds.
        const stationMax60 = _getTremRtsStationMax60s(id, frameTimeMs, shindo)

        // Grid / activity should remain instantaneous (pre-change behavior).
        const instBin = instToShindoBin(shindo)
        station.tremGridLevel = getLevelFromInstShindo(Number.isFinite(shindo) ? shindo : -3.1)

        if (shindo !== null && shindo !== undefined) {
            max = (max === null) ? shindo : Math.max(max, shindo)
        }

        const newBin = instBin
        const oldBin = (id in tremRtsPrevBins) ? tremRtsPrevBins[id] : -1
        if (newBin > oldBin) risingCount += 1
        tremRtsPrevBins[id] = newBin

        // Update marker style (includes number icons when enabled).
        station.update(Number.isFinite(stationMax60) ? stationMax60 : -3.1, render)

        // Mark station as active for grid squares (simple threshold).
        if (instBin >= activateBinThres) {
            station.setActive()
            if (!firstActive || station.tremGridLevel > firstActive.tremGridLevel) firstActive = station
        }
    }

    // Align grid to first active station (reduces grid jitter).
    if (firstActive && Object.keys(tremRtsGridRects).length === 0) {
        tremRtsGridDecimal = firstActive.latLng.map((val) => Math.round(((val + 180) % 1) * 10) / 10)
    }

    tremRtsRisingCount.value = risingCount
    return { frameMaxInst: max }

    _updateTremRtsGridRectsFromStations()
}

const loadTremRts = async () => {
    clearTimeout(tremTimeout);

    // 長時間運用でのメモリ増大を抑える：pollの重なりを禁止 + 古いfetchを中断
    if (tremRtsInFlight) {
        tremTimeout = setTimeout(loadTremRts, 500)
        return
    }
    tremRtsInFlight = true

    try { tremRtsAbortController?.abort?.() } catch {}
    tremRtsAbortController = new AbortController()
    const tremSignal = tremRtsAbortController.signal

    try {

    if (Object.keys(tremStationInfo).length === 0) {
        try {
            const res = await fetch(`${tremStationProxyBase.value}/api/v1/trem/station?_=${Date.now()}`, { signal: tremSignal });
            tremStationInfo = await res.json();

            tremRtsLayer.clearLayers();
            const stations = {};
            for (const id in tremStationInfo) {
                const info = tremStationInfo[id].info[0];
                const latLng = [info.lat, info.lon]
                const station = reactive(new TremStation(map, id, latLng, -3.1, 10, tremRtsLayer))
                stations[id] = station
            }
            tremStations.value = stations;
            console.log('TREM-RTS stations initialized.');

            if (!tremRtsZoomHandlerAttached) {
                tremRtsZoomHandlerAttached = true
                map.on('zoomend', tremRtsZoomHandler)
            }
        } catch (e) {
            console.error('Failed to load TREM-RTS station data:', e);
        }
    }

    if (settingsStore.mainSettings.displaySeisNet.tremNet) {
        try {
            const targetTime = timeStore.getTimeStamp() - tremDelayMs.value
            // NOTE: lb-* は /rts/<timestamp> を受けても最新を返す。
            // 履歴（リプレイ）は api-1/api-2 を使う。
            const url = tremDelayMs.value > 0
                ? `${tremStationProxyBase.value}/api/v1/trem/rts/${Math.round(targetTime)}`
                : `${tremRtsProxyBase.value}/api/v1/trem/rts?_=${Date.now()}`

            const res = await fetch(url, { signal: tremSignal })
            const data = await res.json()
            if (data && data.station) {
                const { frameMaxInst } = updateTremMarkers(data.station, data.time) || {}
                _updateTremRtsMaxWindow(data.time, frameMaxInst)
                tremMaxShindo.value = (tremRtsMaxInst.value === null) ? '?' : getShindoFromInstShindo(tremRtsMaxInst.value)
                tremUpdateTime.value = stampToTime(data.time, 8)
            }
        } catch (e) {
            console.error('Failed to load TREM-RTS data:', e)
        }
    }

    }
    finally {
        tremRtsInFlight = false
        tremTimeout = setTimeout(loadTremRts, 1000);
    }
};

watch(
    () => settingsStore.mainSettings.displaySeisNet.tremApi,
    () => {
        // API切替時は観測点キャッシュ/レイヤーを作り直す
        tremStationInfo = {}
        tremStations.value = {}
        tremRtsLayer?.clearLayers()
        _clearTremRtsMaxWindow()
        _clearTremRtsStationWindows()
        tremRtsMaxInst.value = null
        tremMaxShindo.value = '?'
        loadTremRts()
    }
)

const msilStations = ref({});
const msil_latest = {};
const msilLatestByCode = {};
let msil_lastTime = '';
let msilTimeout;
let msilInFlight = false
let msilAbortController = null

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

watch(
    () => settingsStore.mainSettings.displaySeisNet.delay,
    () => {
        // リプレイ時刻を変えたら、揺れ検知/期間最大用の蓄積をリセット
        // TREM-RTS
        tremRtsMaxInst.value = null
        tremRtsRisingCount.value = 0
        tremRtsShakeFlags.shake1Notified = false
        tremRtsShakeFlags.shake2Notified = false
        tremRtsShakeFlags.focused = false
        for(const k in tremRtsPrevBins) delete tremRtsPrevBins[k]
        tremRtsLatchedBin.value = -1
        _clearTremRtsMaxWindow()
        _clearTremRtsStationWindows()

        // MSIL
        msilMaxInst.value = null
        msilRisingCount.value = 0
        msilShakeFlags.shake1Notified = false
        msilShakeFlags.shake2Notified = false
        msilShakeFlags.focused = false
        for(const k in msilPrevBins) delete msilPrevBins[k]
        for(const k in msil_latest) delete msil_latest[k]
        for(const k in msilLatestByCode) delete msilLatestByCode[k]
        msil_lastTime = ''
    },
    { immediate: true }
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

watch(tremRtsLatchedBin, (newVal, oldVal) => {
    if(!settingsStore.mainSettings.displaySeisNet.tremNet) return
    if(tremRtsSensitivity.value === 0) {
        triggerShakeIfRising(newVal, newVal, tremRtsShakeFlags)
        return
    }
    if(newVal > oldVal) {
        const shouldTrigger = (newVal >= 4) || (tremRtsRisingCount.value >= tremRtsRisingCountThreshold.value)
        if(shouldTrigger) triggerShakeIfRising(newVal, oldVal, tremRtsShakeFlags)
    }
    else {
        triggerShakeIfRising(newVal, newVal, tremRtsShakeFlags)
    }
})

watch(msilCurrentBin, (newVal, oldVal) => {
    if(!settingsStore.mainSettings.displaySeisNet.msilNet) return
    if(newVal > oldVal && msilRisingCount.value >= msilRisingCountThreshold) {
        triggerShakeIfRising(newVal, oldVal, msilShakeFlags)
    }
    else {
        triggerShakeIfRising(newVal, newVal, msilShakeFlags)
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

    // 長時間運用でのメモリ増大を抑える：pollの重なりを禁止 + 古いfetchを中断
    if (msilInFlight) {
        msilTimeout = setTimeout(loadMsilNet, 500)
        return
    }
    msilInFlight = true

    try { msilAbortController?.abort?.() } catch {}
    msilAbortController = new AbortController()
    const msilSignal = msilAbortController.signal

    try {

    // 観測点（マーカー）の初期化：msilNet のON/OFFに関係なく一度だけ生成
    if (Object.keys(msilStations.value).length === 0) {
        try {
            const response = await fetch(`${import.meta.env.BASE_URL}resources/Snet_Points.json?_=${Date.now()}`, { cache: 'no-store', signal: msilSignal });
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
            msilMarkerCount.value = Object.keys(stations).length
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
        const edgeProxyBase = (import.meta.env.VITE_EDGE_PROXY_BASE || '').replace(/\/+$/, '')
        const msilBase = import.meta.env.DEV ? '/msil' : (edgeProxyBase ? `${edgeProxyBase}/msil` : 'https://www.msil.go.jp')
        const targetTimesRes = await fetch(`${msilBase}/tiles/smoni/targetTimes.json?_=${Date.now()}`, { signal: msilSignal });
        const targetTimes = await targetTimesRes.json();
        if (!Array.isArray(targetTimes)) throw new Error('Invalid targetTimes format');

        const delayMs = settingsStore.mainSettings.displaySeisNet.delay * 60000
        const nowKey = formatUtcToBasetime(timeStore.getTimeStamp() - delayMs);
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

            // NOTE: forEach + async はawaitされず重なりの原因になるので Promise.all で待つ
            await Promise.all(urls.map(async ({ url, y }) => {
                try {
                    const response = await fetch(url, { signal: msilSignal });
                    const blob = await response.blob();
                    const imageBitmap = await createImageBitmap(blob);
                    if (msilWorker) {
                        msilWorker.postMessage({ imageBitmap, y, uid: unique_id }, [imageBitmap]);
                    }
                    try { imageBitmap.close?.() } catch {}
                } catch (e) {
                    console.error(`Failed to fetch or process MSIL tile ${url}`, e);
                }
            }))
        }
    } catch (e) {
        console.error('Failed to load MSIL data:', e);
    }

    }
    finally {
        msilInFlight = false
        msilTimeout = setTimeout(loadMsilNet, settingsStore.mainSettings.displaySeisNet.msilInterval * 1000);
    }
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
    try { tremRtsAbortController?.abort?.() } catch {}
    try { msilAbortController?.abort?.() } catch {}
    msilMarkerCount.value = 0
    document.removeEventListener('mousemove', resetDefaultMenuTimer)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    if(msilWorker) msilWorker.terminate()
    try { map?.off?.('zoomend', tremRtsZoomHandler) } catch {}
    document.removeEventListener('keydown', handleKeydown)
    if(map && cwaLatestHypoMarker) safeRemoveLayer(map, cwaLatestHypoMarker)
    try { gqYuzhnoEventSource?.close?.() } catch {}
    try { if(map && gqYuzhnoMarker) safeRemoveLayer(map, gqYuzhnoMarker) } catch {}
    activeEewList.length = 0
    eqlistList.length = 0
})

// Extra cleanup: terminate any workers registered on window, close station windows, and fully remove map listeners
try {
    try {
        if (window._kanameishiWorkers && Array.isArray(window._kanameishiWorkers)) {
            window._kanameishiWorkers.forEach(w => { try { w.terminate && w.terminate() } catch(_){} })
            window._kanameishiWorkers.length = 0
        }
    } catch(_){}
    try {
        for (const [k, state] of jpStationWaveWindows.entries()) {
            try { if (state.intervalId) clearInterval(state.intervalId) } catch(_){}
            try { if (state.win && !state.win.closed) state.win.close() } catch(_){}
            jpStationWaveWindows.delete(k)
        }
    } catch(_){}
    try { if (map) { map.off(); map.remove && map.remove(); } } catch(_){}
} catch(_){}
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

                            .palert-max-pga-corner,
                            .nied-max-pga-corner{
                                position: absolute;
                                right: 6px;
                                bottom: 6px;
                                font-size: 12px;
                                line-height: 1;
                                font-weight: 700;
                                letter-spacing: 0;
                                padding-right: 0;
                                color: var(--white);
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