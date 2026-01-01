<template>
    <div class="outer1">
        <div class="container">
            <div class="title">{{ $t('settings.title') }}</div>
            <div class="settings">
                <span class="sub-title">{{ $t('settings.general.title') }}</span>
                <div class="group">
                    <div class="switch-group">
                        <div class="switch-full">
                            <span>{{ $t('settings.general.language') }}</span>
                            <el-select v-model="settingsStore.mainSettings.language" :placeholder="$t('settings.common.select')" style="width: 120px">
                                <el-option :label="$t('settings.general.lang_ja')" value="ja" />
                                <el-option :label="$t('settings.general.lang_zh')" value="zh" />
                            </el-select>
                        </div>
                    </div>
                </div>
                <span class="sub-title">
                    {{ $t('settings.dataSource.title') }}
                    <el-popover
                        placement="top"
                        :width="300"
                        trigger="hover"
                    >
                        <template #reference>
                            <question-filled width="1em" height="1em" />
                        </template>
                        <strong>
                            <p>{{ $t('settings.dataSource.reload_hint') }}</p>
                        </strong>
                    </el-popover>
                </span>
                <div class="group">
                    <div class="switch-group">
                        <span class="font-bold w-full">{{ $t('settings.dataSource.eew_title') }}</span>
                        <div class="switch-full">
                            <div>{{ $t('settings.dataSource.cea_eew') }}</div>
                            <el-switch v-model="settingsStore.mainSettings.source.ceaEew" @change="handleNeedReload" />
                        </div>
                        <div class="switch-full" v-if="settingsStore.advancedSettings.enableIclEew">
                            <div>{{ $t('settings.dataSource.icl_eew') }}</div>
                            <el-switch v-model="settingsStore.mainSettings.source.iclEew" @change="handleNeedReload" />
                        </div>
                        <div class="switch-full">
                            <div>{{ $t('settings.dataSource.sc_eew') }}</div>
                            <el-switch v-model="settingsStore.mainSettings.source.scEew" @change="handleNeedReload" />
                        </div>
                        <div class="switch-full">
                            <div>{{ $t('settings.dataSource.fj_eew') }}</div>
                            <el-switch v-model="settingsStore.mainSettings.source.fjEew" @change="handleNeedReload" />
                        </div>
                        <div class="switch-full">
                            <div>{{ $t('settings.dataSource.cwa_eew') }}</div>
                            <el-switch v-model="settingsStore.mainSettings.source.cwaEew" @change="handleNeedReload" />
                        </div>
                        <div class="switch-full">
                            <div>{{ $t('settings.dataSource.jma_eew') }}</div>
                            <el-switch v-model="settingsStore.mainSettings.source.jmaEew" @change="handleNeedReload" />
                        </div>
                        <div class="switch-full" v-if="settingsStore.advancedSettings.enableGqEew">
                            <div>{{ $t('settings.dataSource.gq_eew') }}</div>
                            <el-switch v-model="settingsStore.mainSettings.source.gqEew" @change="handleNeedReload" />
                        </div>
                        <div class="switch-full">
                            <div>{{ $t('settings.dataSource.gq_detected_eew') }}</div>
                            <el-switch v-model="settingsStore.mainSettings.source.gqDetectedEew" @change="handleNeedReload" />
                        </div>
                    </div>
                    <div class="switch-group">
                        <span class="font-bold w-full">{{ $t('settings.dataSource.eqlist_title') }}</span>
                        <div class="switch-full">
                            <div>{{ $t('settings.dataSource.cenc_eqlist') }}</div>
                            <el-switch v-model="settingsStore.mainSettings.source.cencEqlist" @change="handleNeedReload" />
                        </div>
                        <div class="switch-full" v-if="settingsStore.advancedSettings.enableTremFunctions">
                            <div>{{ $t('settings.dataSource.cwa_eqlist') }}</div>
                            <el-switch v-model="settingsStore.mainSettings.source.cwaEqlist" @change="handleNeedReload" />
                        </div>
                        <div class="switch-full">
                            <div>{{ $t('settings.dataSource.cwa_opendata_eqlist') }}</div>
                            <el-switch v-model="settingsStore.mainSettings.source.cwaOpendataEqlist" @change="handleNeedReload" />
                        </div>
                        <div class="switch-full" v-if="settingsStore.mainSettings.source.cwaOpendataEqlist">
                            <div>{{ $t('settings.dataSource.cwa_opendata_key') }}</div>
                            <el-input v-model="settingsStore.advancedSettings.tokens.cwa_opendata" show-password @change="handleNeedReload" />
                        </div>
                        <div class="switch-full">
                            <div>{{ $t('settings.dataSource.jma_eqlist') }}</div>
                            <el-switch v-model="settingsStore.mainSettings.source.jmaEqlist" @change="handleNeedReload" />
                        </div>
                        <div class="switch-full">
                            <div>{{ $t('settings.dataSource.kma_eqlist') }}</div>
                            <el-switch v-model="settingsStore.mainSettings.source.kmaEqlist" @change="handleNeedReload" />
                        </div>
                        <div class="switch-full">
                            <div>{{ $t('settings.dataSource.usgs_eqlist') }}</div>
                            <el-switch v-model="settingsStore.mainSettings.source.usgsEqlist" @change="handleNeedReload" />
                        </div>
                        <div class="switch-full">
                            <div>{{ $t('settings.dataSource.fssn_eqlist') }}</div>
                            <el-switch v-model="settingsStore.mainSettings.source.fssnEqlist" @change="handleFssnEqlist" />
                        </div>
                    </div>
                    <div class="switch-group">
                        <span class="font-bold w-full">{{ $t('settings.dataSource.tsunami_title') }}</span>
                        <div class="switch-full">
                            <div>{{ $t('settings.dataSource.jma_tsunami') }}</div>
                            <el-switch v-model="settingsStore.mainSettings.source.jmaTsunami" @change="handleNeedReload" />
                        </div>
                        <div class="switch-full" v-if="settingsStore.advancedSettings.enableNmefcTsunami">
                            <div>{{ $t('settings.dataSource.nmefc_tsunami') }}</div>
                            <el-switch v-model="settingsStore.mainSettings.source.nmefcTsunami" @change="handleNeedReload" />
                        </div>
                    </div>
                </div>
                <span class="sub-title">{{ $t('settings.seisNet.title') }}</span>
                <div class="group">
                    <span class="font-bold w-full">{{ $t('settings.seisNet.dataSource') }}</span>
                    <div class="switch-group">
                        <div class="switch-full">
                            <span>{{ $t('settings.seisNet.hypo_estimate_max_points') }}</span>
                            <el-input-number
                                v-model="settingsStore.mainSettings.displaySeisNet.hypoEstimateMaxPoints"
                                size="small"
                                :min="40"
                                :max="500"
                                :step="10"
                                controls-position="right"
                                style="width: 156px"
                            />
                        </div>
                    </div>
                    <div class="switch-group">
                        <div class="w-full">
                            <div class="switch-full">
                                <span>{{ $t('settings.seisNet.nied_net') }} ({{ $t('settings.seisNet.marker_count', { count: niedMarkerCountDisplay }) }})</span>
                                <el-switch v-model="settingsStore.mainSettings.displaySeisNet.niedNet" />
                            </div>
                            <div class="switch-full pl-4">
                                <span>{{ $t('settings.seisNet.nied_mode') }}</span>
                                <el-select
                                    v-model="settingsStore.mainSettings.displaySeisNet.niedSource"
                                    size="small"
                                    :disabled="!settingsStore.mainSettings.displaySeisNet.niedNet"
                                    style="width: 156px;"
                                >
                                    <el-option :label="$t('settings.seisNet.nied_mode_yahoo')" value="yahoo" />
                                    <el-option :label="$t('settings.seisNet.nied_mode_kmoni_image')" value="kmoni_image" />
                                </el-select>
                            </div>
                            <div class="switch-full pl-4">
                                <span>{{ $t('settings.seisNet.hypo_estimate_enable') }}</span>
                                <el-switch
                                    v-if="settingsStore.mainSettings.displaySeisNet.niedSource === 'yahoo'"
                                    v-model="settingsStore.mainSettings.displaySeisNet.niedYahooHypoEstimate"
                                    :disabled="!settingsStore.mainSettings.displaySeisNet.niedNet"
                                />
                                <el-switch
                                    v-else
                                    v-model="settingsStore.mainSettings.displaySeisNet.niedKmoniHypoEstimate"
                                    :disabled="!settingsStore.mainSettings.displaySeisNet.niedNet"
                                />
                            </div>
                            <div class="switch-full pl-4" v-if="settingsStore.mainSettings.displaySeisNet.niedSource === 'kmoni_image'">
                                <span>{{ $t('settings.seisNet.kmoni_mag_estimate_enable') }}</span>
                                <el-switch
                                    v-model="settingsStore.mainSettings.displaySeisNet.niedKmoniMagEstimate"
                                    :disabled="!settingsStore.mainSettings.displaySeisNet.niedNet || !settingsStore.mainSettings.displaySeisNet.niedKmoniHypoEstimate"
                                />
                            </div>
                            <div class="switch-full pl-4">
                                <span>{{ $t('settings.seisNet.analysis_shindo') }}</span>
                                <el-switch v-model="settingsStore.mainSettings.displaySeisNet.displayNiedShindo" :disabled="!settingsStore.mainSettings.displaySeisNet.niedNet" />
                            </div>
                            <div class="switch-full pl-4">
                                <span>{{ $t('settings.seisNet.sensitivity') }}</span>
                                <el-select 
                                    v-model="settingsStore.mainSettings.displaySeisNet.niedSensitivity"
                                    size="small"
                                    :disabled="!settingsStore.mainSettings.displaySeisNet.niedNet"
                                    style="width: 48px;"
                                >
                                    <el-option :label="$t('settings.seisNet.off')" :value=0 />
                                    <el-option :label="$t('settings.seisNet.low')" :value=1 />
                                    <el-option :label="$t('settings.seisNet.medium')" :value=2 />
                                    <el-option :label="$t('settings.seisNet.high')" :value=3 />
                                </el-select>
                            </div>
                        </div>
                        <div class="w-full">
                            <div class="switch-full">
                                <span>{{ $t('settings.seisNet.trem_net') }} ({{ $t('settings.seisNet.marker_count', { count: tremMarkerCountDisplay }) }})</span>
                                <el-switch v-model="settingsStore.mainSettings.displaySeisNet.tremNet" />
                            </div>
                            <div class="switch-full pl-4">
                                <span>{{ $t('settings.seisNet.analysis_shindo') }}</span>
                                <el-switch v-model="settingsStore.mainSettings.displaySeisNet.displayTremShindo" :disabled="!settingsStore.mainSettings.displaySeisNet.tremNet" />
                            </div>
                            <div class="switch-full pl-4">
                                <span>{{ $t('settings.seisNet.sensitivity') }}</span>
                                <el-select 
                                    v-model="settingsStore.mainSettings.displaySeisNet.tremSensitivity"
                                    size="small"
                                    :disabled="!settingsStore.mainSettings.displaySeisNet.tremNet"
                                    style="width: 48px;"
                                >
                                    <el-option :label="$t('settings.seisNet.off')" :value=0 />
                                    <el-option :label="$t('settings.seisNet.low')" :value=1 />
                                    <el-option :label="$t('settings.seisNet.medium')" :value=2 />
                                    <el-option :label="$t('settings.seisNet.high')" :value=3 />
                                </el-select>
                            </div>
                            <div class="switch-full pl-4">
                                <span>{{ $t('settings.seisNet.api') }}</span>
                                <el-select 
                                    v-model="settingsStore.mainSettings.displaySeisNet.tremApi"
                                    size="small"
                                    :disabled="!settingsStore.mainSettings.displaySeisNet.tremNet"
                                    style="width: 72px;"
                                >
                                    <el-option label="api-1" value="api-1" />
                                    <el-option label="api-2" value="api-2" />
                                    <el-option label="lb-1" value="lb-1" />
                                    <el-option label="lb-2" value="lb-2" />
                                    <el-option label="lb-3" value="lb-3" />
                                    <el-option label="lb-4" value="lb-4" />
                                </el-select>
                            </div>
                        </div>
                        <div class="w-full">
                            <div class="switch-full">
                                <span>{{ $t('settings.seisNet.palert_net') }} ({{ $t('settings.seisNet.marker_count', { count: palertMarkerCountDisplay }) }})</span>
                                <el-switch v-model="settingsStore.mainSettings.displaySeisNet.palertNet" />
                            </div>
                            <div class="switch-full pl-4">
                                <span>{{ $t('settings.seisNet.palert_quantize_deg') }}</span>
                                <el-select
                                    v-model="settingsStore.mainSettings.displaySeisNet.palertQuantizeDeg"
                                    size="small"
                                    :disabled="!settingsStore.mainSettings.displaySeisNet.palertNet"
                                    style="width: 120px;"
                                >
                                    <el-option :label="$t('settings.seisNet.off')" :value="0" />
                                    <el-option label="0.1°" :value="0.1" />
                                    <el-option label="0.15°" :value="0.15" />
                                    <el-option label="0.2°" :value="0.2" />
                                </el-select>
                            </div>
                            <div class="switch-full pl-4">
                                <span>{{ $t('settings.seisNet.hypo_estimate_enable') }}</span>
                                <el-switch
                                    v-model="settingsStore.mainSettings.displaySeisNet.palertHypoEstimate"
                                    :disabled="!settingsStore.mainSettings.displaySeisNet.palertNet"
                                />
                            </div>
                            <div class="switch-full pl-4">
                                <span>{{ $t('settings.seisNet.palert_color_by') }}</span>
                                <span class="opacity-60">NIED</span>
                            </div>
                        </div>
                        <div class="w-full">
                            <div class="switch-full">
                                <span>{{ $t('settings.seisNet.kma_net') }} ({{ $t('settings.seisNet.marker_count', { count: kmaMarkerCountDisplay }) }})</span>
                                <el-switch v-model="settingsStore.mainSettings.displaySeisNet.kmaNet" />
                            </div>
                            <div class="switch-full pl-4">
                                <span>{{ $t('settings.seisNet.convert_to_mmi') }}</span>
                                <el-switch v-model="settingsStore.mainSettings.displaySeisNet.displayKmaInt" :disabled="!settingsStore.mainSettings.displaySeisNet.kmaNet" />
                            </div>
                            <div class="switch-full pl-4">
                                <span>{{ $t('settings.seisNet.sensitivity') }}</span>
                                <el-select 
                                    v-model="settingsStore.mainSettings.displaySeisNet.kmaSensitivity"
                                    size="small"
                                    :disabled="!settingsStore.mainSettings.displaySeisNet.kmaNet"
                                    style="width: 48px;"
                                >
                                    <el-option :label="$t('settings.seisNet.off')" :value=0 />
                                    <el-option :label="$t('settings.seisNet.low')" :value=1 />
                                    <el-option :label="$t('settings.seisNet.medium')" :value=2 />
                                    <el-option :label="$t('settings.seisNet.high')" :value=3 />
                                </el-select>
                            </div>
                            <div class="switch-full pl-4">
                                <span>{{ $t('settings.seisNet.pga_hold_time') }}</span>
                                <el-select 
                                    v-model="settingsStore.mainSettings.displaySeisNet.kmaIntHold"
                                    size="small"
                                    :disabled="!settingsStore.mainSettings.displaySeisNet.kmaNet"
                                    style="width: 72px;"
                                >
                                    <el-option :label="$t('settings.common.off')" :value="1" />
                                    <el-option :label="$t('settings.common.seconds', { sec: 5 })" :value="5" />
                                    <el-option :label="$t('settings.common.seconds', { sec: 10 })" :value="10" />
                                    <el-option :label="$t('settings.common.seconds', { sec: 30 })" :value="30" />
                                    <el-option :label="$t('settings.common.seconds', { sec: 60 })" :value="60" />
                                </el-select>
                            </div>
                        </div>
                        <div class="w-full">
                            <div class="switch-full">
                                <span>{{ $t('settings.seisNet.msil_net') }} ({{ $t('settings.seisNet.marker_count', { count: msilMarkerCountDisplay }) }})</span>
                                <el-switch v-model="settingsStore.mainSettings.displaySeisNet.msilNet" />
                            </div>

                            <!-- 追加：観測点マーカー表示の切り替え -->
                            <div class="switch-full pl-4">
                                <span>{{ $t('settings.seisNet.msil_station_markers') }}</span>
                                <el-switch v-model="settingsStore.mainSettings.displaySeisNet.msilStations" />
                            </div>
                        </div>

                        <div class="w-full">
                            <div class="switch-full">
                                <span>{{ $t('settings.seisNet.emsd_net') }} ({{ $t('settings.seisNet.marker_count', { count: emsdMarkerCountDisplay }) }})</span>
                                <el-switch v-model="settingsStore.mainSettings.displaySeisNet.emsdNet" />
                            </div>
                        </div>
                    </div>
                    <div class="font-bold w-full">{{ $t('settings.generalSettings.title') }}</div>
                    <div class="switch-group">
                        <div class="w-full">
                            <div class="switch-full">
                                <span>{{ $t('settings.generalSettings.station_replay') }}</span>
                                <div class="flex gap-2">
                                    <el-input-number
                                        v-model="settingsStore.mainSettings.displaySeisNet.delay"
                                        size="small"
                                        :min="0"
                                        style="width: 108px;"
                                    />
                                    <el-button
                                        size="small"
                                        @click="settingsStore.mainSettings.displaySeisNet.delay = 0"
                                        :disabled="settingsStore.mainSettings.displaySeisNet.delay == 0"
                                    >{{ $t('settings.generalSettings.restore') }}</el-button>
                                </div>
                            </div>
                            <div class="switch-full pl-4">
                                <span>{{ $t('settings.generalSettings.replay_by_time') }}</span>
                                <div class="flex gap-2">
                                    <el-date-picker
                                        v-model="replayDateTime"
                                        type="datetime"
                                        size="small"
                                        style="width: 156px;"
                                        :placeholder="$t('settings.generalSettings.replay_placeholder')"
                                        format="YYYY-MM-DD HH:mm:ss"
                                        value-format="YYYY-MM-DD HH:mm:ss"
                                    />
                                    <el-button
                                        size="small"
                                        @click="setReplayDateTime"
                                        :disabled="!replayDateTime"
                                    >{{ $t('settings.generalSettings.replay') }}</el-button>
                                </div>
                            </div>
                        </div>
                        <div class="w-full">
                            <div class="switch-full">
                                <span>{{ $t('settings.generalSettings.station_style') }}</span>
                                <el-select
                                    style="width: 72px;"
                                    v-model="settingsStore.mainSettings.displaySeisNet.style"
                                    size="small"
                                >
                                    <el-option :label="$t('settings.generalSettings.nied_style')" value="nied" />
                                    <el-option :label="$t('settings.generalSettings.srev_style')" value="srev" />
                                    <el-option :label="$t('settings.generalSettings.mix_style')" value="mix" />
                                </el-select>
                            </div>
                            <div class="switch-full pl-4" v-show="settingsStore.mainSettings.displaySeisNet.style == 'nied'">
                                <span>{{ $t('settings.generalSettings.hide_no_data_stations') }}</span>
                                <el-switch v-model="settingsStore.mainSettings.displaySeisNet.hideNoData" />
                            </div>
                            <div class="switch-full">
                                <span>{{ $t('settings.generalSettings.display_shindo_0') }}</span>
                                <el-switch v-model="settingsStore.mainSettings.displaySeisNet.displayShindo0" />
                            </div>
                        </div>
                    </div>
                </div>
                <span class="sub-title">{{ $t('settings.behavior.title') }}</span>
                <div class="group">
                    <span class="font-bold w-full">
                        {{ $t('settings.behavior.filter_settings.title') }}
                        <el-popover
                            placement="top"
                            :width="200"
                            trigger="hover"
                        >
                            <template #reference>
                                <question-filled width="1em" height="1em" />
                            </template>
                            <p><strong>{{ $t('settings.behavior.filter_settings.hint1') }}</strong></p>
                            <p><strong>{{ $t('settings.behavior.filter_settings.hint2') }}</strong></p>
                        </el-popover>
                    </span>
                    <div class="switch-group">
                        <div class="switch-full">
                            <div class="justify-between" style="width: 10rem;">
                                <span>
                                    {{ $t('settings.behavior.filter_settings.mag_threshold') }}
                                    <el-popover
                                        placement="top"
                                        :width="310"
                                        trigger="hover"
                                    >
                                        <template #reference>
                                            <question-filled width="1em" height="1em" />
                                        </template>
                                        <p>{{ $t('settings.behavior.filter_settings.mag_threshold_hint1') }}</p>
                                        <p>{{ $t('settings.behavior.filter_settings.mag_threshold_hint2') }}</p>
                                    </el-popover>
                                </span>
                                <div class="mag" :class="setClassName(calcCsisLevel(settingsStore.mainSettings.actionMag, 10, 0), false)">
                                    {{ settingsStore.mainSettings.actionMag.toFixed(1) }}
                                </div>
                            </div>
                            <el-slider
                                v-model="settingsStore.mainSettings.actionMag"
                                :min="0" :max="9"
                                :step="0.1"
                                size="small"
                            />
                        </div>
                        <div class="switch-full" v-if="!settingsStore.nearestJmaLoc">
                            <div class="justify-between" style="width: 10rem;">
                                <span>
                                    {{ $t('settings.behavior.filter_settings.local_csis_threshold') }}
                                    <el-popover
                                        placement="top"
                                        :width="310"
                                        trigger="hover"
                                    >
                                        <template #reference>
                                            <question-filled width="1em" height="1em" />
                                        </template>
                                        <p><strong>{{ $t('settings.behavior.filter_settings.local_csis_threshold_hint1') }}</strong></p>
                                        <p>{{ $t('settings.behavior.filter_settings.local_csis_threshold_hint2') }}</p>
                                        <p>{{ $t('settings.behavior.filter_settings.local_csis_threshold_hint3') }}</p>
                                        <p>{{ $t('settings.behavior.filter_settings.local_csis_threshold_hint4') }}</p>
                                        <p>{{ $t('settings.behavior.filter_settings.local_csis_threshold_hint5') }}</p>
                                        <p>{{ $t('settings.behavior.filter_settings.local_csis_threshold_hint6') }}</p>
                                        <p>{{ $t('settings.behavior.filter_settings.local_csis_threshold_hint7') }}</p>
                                        <p>{{ $t('settings.behavior.filter_settings.local_csis_threshold_hint8') }}</p>
                                        <p>{{ $t('settings.behavior.filter_settings.local_csis_threshold_hint9') }}</p>
                                        <p>{{ $t('settings.behavior.filter_settings.local_csis_threshold_hint10') }}</p>
                                        <p>{{ $t('settings.behavior.filter_settings.local_csis_threshold_hint11') }}</p>
                                    </el-popover>
                                </span>
                                <div class="int" :class="setClassName(settingsStore.mainSettings.actionLocalCsis, false)">
                                    <div class="csis" :class="{
                                        'roman': settingsStore.mainSettings.useRomanCsis,
                                        'scale-9': settingsStore.mainSettings.actionLocalCsis == 8
                                    }">{{ formatCsis(settingsStore.mainSettings.actionLocalCsis.toString(), settingsStore.mainSettings.useRomanCsis) }}</div>
                                </div>
                            </div>
                            <el-slider
                                v-model="settingsStore.mainSettings.actionLocalCsis"
                                :disabled="!settingsStore.advancedSettings.forceCalcInt"
                                :min="0" :max="12"
                                :step="1"
                                size="small"
                                show-stops
                            />
                        </div>
                        <div class="switch-full" v-else>
                            <div class="justify-between" style="width: 10rem;">
                                <span>
                                    {{ $t('settings.behavior.filter_settings.local_shindo_threshold') }}
                                    <el-popover
                                        placement="top"
                                        :width="310"
                                        trigger="hover"
                                    >
                                        <template #reference>
                                            <question-filled width="1em" height="1em" />
                                        </template>
                                        <p><strong>{{ $t('settings.behavior.filter_settings.local_shindo_threshold_hint1') }}</strong></p>
                                        <p>{{ $t('settings.behavior.filter_settings.local_shindo_threshold_hint2') }}</p>
                                        <p>{{ $t('settings.behavior.filter_settings.local_shindo_threshold_hint3') }}</p>
                                        <p>{{ $t('settings.behavior.filter_settings.local_shindo_threshold_hint4') }}</p>
                                        <p>{{ $t('settings.behavior.filter_settings.local_shindo_threshold_hint5') }}</p>
                                        <p>{{ $t('settings.behavior.filter_settings.local_shindo_threshold_hint6') }}</p>
                                        <p>{{ $t('settings.behavior.filter_settings.local_shindo_threshold_hint7') }}</p>
                                        <p>{{ $t('settings.behavior.filter_settings.local_shindo_threshold_hint8') }}</p>
                                        <p>{{ $t('settings.behavior.filter_settings.local_shindo_threshold_hint9') }}</p>
                                        <p>{{ $t('settings.behavior.filter_settings.local_shindo_threshold_hint10') }}</p>
                                        <p>{{ $t('settings.behavior.filter_settings.local_shindo_threshold_hint11') }}</p>
                                        <p>{{ $t('settings.behavior.filter_settings.local_shindo_threshold_hint12') }}</p>
                                        <p>{{ $t('settings.behavior.filter_settings.local_shindo_threshold_hint13') }}</p>
                                    </el-popover>
                                </span>
                                <div class="int" :class="setClassName(shindoScale[settingsStore.mainSettings.actionLocalShindo], true)">
                                    <div class="shindo">{{ shindoScale[settingsStore.mainSettings.actionLocalShindo] }}</div>
                                </div>
                            </div>
                            <el-slider
                                v-model="settingsStore.mainSettings.actionLocalShindo"
                                :disabled="!settingsStore.advancedSettings.forceCalcInt"
                                :min="0" :max="9"
                                :step="1"
                                size="small"
                                show-stops
                                :format-tooltip="(value) => shindoScale[value]"
                            />
                        </div>
                        <div class="switch-full pl-4">
                            <div class="justify-between" style="width: 9rem;">
                                <el-checkbox 
                                    v-model="settingsStore.mainSettings.playIntenseSound" 
                                    :disabled="!settingsStore.advancedSettings.forceCalcInt"
                                >{{ $t('settings.behavior.filter_settings.strong_shaking_prompt') }}</el-checkbox>
                                <div v-if="!settingsStore.nearestJmaLoc" class="int" :class="setClassName(settingsStore.mainSettings.intenseLocalCsis, false)">
                                    <div class="csis" :class="{
                                        'roman': settingsStore.mainSettings.useRomanCsis,
                                        'scale-9': settingsStore.mainSettings.intenseLocalCsis == 8
                                    }">{{ formatCsis(settingsStore.mainSettings.intenseLocalCsis.toString(), settingsStore.mainSettings.useRomanCsis) }}</div>
                                </div>
                                <div v-else class="int" :class="setClassName(shindoScale[settingsStore.mainSettings.intenseLocalShindo], true)">
                                    <div class="shindo">{{ shindoScale[settingsStore.mainSettings.intenseLocalShindo] }}</div>
                                </div>
                            </div>
                            <el-slider
                                v-if="!settingsStore.nearestJmaLoc"
                                v-model="settingsStore.mainSettings.intenseLocalCsis"
                                :disabled="!settingsStore.advancedSettings.forceCalcInt || !settingsStore.mainSettings.playIntenseSound"
                                :min="0" :max="12"
                                :step="1"
                                size="small"
                                show-stops
                            />
                            <el-slider
                                v-else
                                v-model="settingsStore.mainSettings.intenseLocalShindo"
                                :disabled="!settingsStore.advancedSettings.forceCalcInt || !settingsStore.mainSettings.playIntenseSound"
                                :min="0" :max="9"
                                :step="1"
                                size="small"
                                show-stops
                                :format-tooltip="(value) => shindoScale[value]"
                            />
                        </div>
                        <div class="switch-full" v-if="settingsStore.advancedSettings.enableGqEew">
                            <div class="justify-between" style="width: 10rem;">
                                <span>{{ $t('settings.behavior.filter_settings.gq_mag_threshold') }}</span>
                                <div class="mag" :class="setClassName(calcCsisLevel(settingsStore.mainSettings.gqActionMag, 10, 0), false)">
                                    {{ settingsStore.mainSettings.gqActionMag.toFixed(1) }}
                                </div>
                            </div>
                            <el-slider
                                v-model="settingsStore.mainSettings.gqActionMag"
                                :min="0" :max="9"
                                :step="0.1"
                                size="small"
                            />
                        </div>
                        <div class="switch-full">
                            <div class="justify-between" style="width: 10rem;">
                                <span>{{ $t('settings.behavior.filter_settings.usgs_mag_threshold') }}</span>
                                <div class="mag" :class="setClassName(calcCsisLevel(settingsStore.mainSettings.usgsActionMag, 10, 0), false)">
                                    {{ settingsStore.mainSettings.usgsActionMag.toFixed(1) }}
                                </div>
                            </div>
                            <el-slider
                                v-model="settingsStore.mainSettings.usgsActionMag"
                                :min="0" :max="9"
                                :step="0.1"
                                size="small"
                            />
                        </div>
                        <div class="switch-full">
                            <span>{{ $t('settings.behavior.filter_settings.fssn_reception_type') }}</span>
                            <el-select
                                style="width: 120px;"
                                v-model="settingsStore.mainSettings.fssnActionType"
                                size="small"
                            >
                                <el-option :label="$t('settings.behavior.filter_settings.fssn_reception_type_auto')" :value=0 />
                                <el-option :label="$t('settings.behavior.filter_settings.fssn_reception_type_official')" :value=1 />
                            </el-select>
                        </div>
                        <div class="switch-full">
                            <div class="justify-between" style="width: 10rem;">
                                <span>{{ $t('settings.behavior.filter_settings.fssn_mag_threshold') }}</span>
                                <div class="mag" :class="setClassName(calcCsisLevel(settingsStore.mainSettings.fssnActionMag, 10, 0), false)">
                                    {{ settingsStore.mainSettings.fssnActionMag.toFixed(1) }}
                                </div>
                            </div>
                            <el-slider
                                v-model="settingsStore.mainSettings.fssnActionMag"
                                :min="0" :max="9"
                                :step="0.1"
                                size="small"
                            />
                        </div>
                        <div class="switch-full">
                            <span>
                                {{ $t('settings.behavior.filter_settings.location_whitelist') }}
                                <el-popover
                                    placement="top"
                                    :width="310"
                                    trigger="hover"
                                >
                                    <template #reference>
                                        <question-filled width="1em" height="1em" />
                                    </template>
                                    <p>{{ $t('settings.behavior.filter_settings.location_whitelist_hint1') }}</p>
                                    <p>{{ $t('settings.behavior.filter_settings.location_whitelist_hint2') }}</p>
                                </el-popover>
                            </span>
                            <el-input 
                                class="text-right"
                                v-model="settingsStore.mainSettings.actionWhiteList"
                                style="width: 180px;"
                                size="small"
                                :placeholder="$t('settings.behavior.filter_settings.location_whitelist_placeholder')"
                            />
                        </div>
                    </div>
                    <span class="font-bold w-full">{{ $t('settings.behavior.on_eew_warn.title') }}</span>
                    <div class="switch-group justify-between">
                        <div class="switch" v-if="showNotifButton">
                            <span>{{ $t('settings.behavior.on_eew_warn.send_notification') }}</span>
                            <el-switch v-model="settingsStore.mainSettings.onEewWarn.notification" :disabled="settingsStore.mainSettings.onEew.notification" />
                        </div>
                        <div class="switch">
                            <span>{{ $t('settings.behavior.on_eew_warn.play_sound') }}</span>
                            <el-switch v-model="settingsStore.mainSettings.onEewWarn.sound" :disabled="settingsStore.mainSettings.onEew.sound" />
                        </div>
                        <div class="switch" v-if="isTauri">
                            <span>{{ $t('settings.behavior.on_eew_warn.popup_window') }}</span>
                            <el-switch v-model="settingsStore.mainSettings.onEewWarn.focus" :disabled="settingsStore.mainSettings.onEew.focus" />
                        </div>
                    </div>
                    <span class="font-bold w-full">{{ $t('settings.behavior.on_any_eew.title') }}</span>
                    <div class="switch-group justify-between">
                        <div class="switch" v-if="showNotifButton">
                            <span>{{ $t('settings.behavior.on_eew_warn.send_notification') }}</span>
                            <el-switch v-model="settingsStore.mainSettings.onEew.notification" />
                        </div>
                        <div class="switch">
                            <span>{{ $t('settings.behavior.on_eew_warn.play_sound') }}</span>
                            <el-switch v-model="settingsStore.mainSettings.onEew.sound" />
                        </div>
                        <div class="switch" v-if="isTauri">
                            <span>{{ $t('settings.behavior.on_eew_warn.popup_window') }}</span>
                            <el-switch v-model="settingsStore.mainSettings.onEew.focus" />
                        </div>
                    </div>
                    <span class="font-bold w-full">{{ $t('settings.behavior.on_report.title') }}</span>
                    <div class="switch-group justify-between">
                        <div class="switch" v-if="showNotifButton">
                            <span>{{ $t('settings.behavior.on_eew_warn.send_notification') }}</span>
                            <el-switch v-model="settingsStore.mainSettings.onReport.notification" />
                        </div>
                        <div class="switch">
                            <span>{{ $t('settings.behavior.on_eew_warn.play_sound') }}</span>
                            <el-switch v-model="settingsStore.mainSettings.onReport.sound" />
                        </div>
                        <div class="switch" v-if="isTauri">
                            <span>{{ $t('settings.behavior.on_eew_warn.popup_window') }}</span>
                            <el-switch v-model="settingsStore.mainSettings.onReport.focus" />
                        </div>
                    </div>
                    <span class="font-bold w-full">{{ $t('settings.behavior.on_shake.title') }}</span>
                    <div class="switch-group justify-between">
                        <div class="switch" v-if="showNotifButton">
                            <span>{{ $t('settings.behavior.on_eew_warn.send_notification') }}</span>
                            <el-switch v-model="settingsStore.mainSettings.onShake.notification" />
                        </div>
                        <div class="switch">
                            <span>{{ $t('settings.behavior.on_eew_warn.play_sound') }}</span>
                            <el-switch v-model="settingsStore.mainSettings.onShake.sound" />
                        </div>
                        <div class="switch" v-if="isTauri">
                            <span>{{ $t('settings.behavior.on_eew_warn.popup_window') }}</span>
                            <el-switch v-model="settingsStore.mainSettings.onShake.focus" />
                        </div>
                    </div>
                    <span class="font-bold w-full">{{ $t('settings.behavior.on_tsunami.title') }}</span>
                    <div class="switch-group justify-between">
                        <div class="switch" v-if="showNotifButton">
                            <span>{{ $t('settings.behavior.on_eew_warn.send_notification') }}</span>
                            <el-switch v-model="settingsStore.mainSettings.onTsunami.notification" />
                        </div>
                        <div class="switch">
                            <span>{{ $t('settings.behavior.on_eew_warn.play_sound') }}</span>
                            <el-switch v-model="settingsStore.mainSettings.onTsunami.sound" />
                        </div>
                        <div class="switch" v-if="isTauri">
                            <span>{{ $t('settings.behavior.on_eew_warn.popup_window') }}</span>
                            <el-switch v-model="settingsStore.mainSettings.onTsunami.focus" />
                        </div>
                    </div>
                </div>
                <span class="sub-title">{{ $t('settings.sound.title') }}</span>
                <div class="group">
                    <div class="switch-group">
                        <div class="switch-full">
                            <span>{{ $t('settings.sound.mute_default_notification_sound') }}</span>
                            <el-switch v-model="settingsStore.mainSettings.muteNotification" />
                        </div>
                        <div class="switch-full">
                            <span>{{ $t('settings.sound.select_sound_effect') }}</span>
                            <el-select 
                                v-model="settingsStore.mainSettings.soundEffect"
                                size="small"
                                style="width: 72px;"
                            >
                                <el-option label="SREV" value="srev" />
                            </el-select>
                        </div>
                        <div class="switch-full">
                            <span>{{ isTauri ? $t('settings.sound.custom_sound_effect') : $t('settings.sound.preview_sound_effect') }}</span>
                            <el-button size="small" @click="customizeAudio = true">{{ isTauri ? $t('settings.sound.customize') : $t('settings.sound.preview') }}</el-button>
                        </div>
                    </div>
                </div>
                <span class="sub-title">{{ $t('settings.display.title') }}</span>
                <div class="group">
                    <span class="font-bold w-full">
                        {{ $t('settings.display.location_title') }}
                        <el-popover
                            placement="top"
                            :width="300"
                            trigger="hover"
                        >
                            <template #reference>
                                <question-filled width="1em" height="1em" />
                            </template>
                            <strong>
                                <p>{{ $t('settings.display.location_hint1') }}</p>
                                <p>{{ $t('settings.display.location_hint2') }}</p>
                            </strong>
                        </el-popover>
                    </span>
                    <div class="switch-group">
                        <div class="switch-full">
                            <span>{{ $t('settings.display.latitude') }}</span>
                            <el-input-number
                                class="lat-lng"
                                v-model="settingsStore.mainSettings.userLatLng[0]"
                                size="small"
                                :step="0.1"
                                :min="-90"
                                :max="90"
                                @change="val => setLat('userLatLng')(val)"
                            />
                        </div>
                        <div class="switch-full">
                            <span>{{ $t('settings.display.longitude') }}</span>
                            <el-input-number
                                class="lat-lng"
                                v-model="settingsStore.mainSettings.userLatLng[1]"
                                size="small"
                                :step="0.1"
                                :min="-180"
                                :max="180"
                                @change="val => setLng('userLatLng')(val)"
                            />
                        </div>
                        <div class="switch-full">
                            <span>{{ $t('settings.display.use_ip_geolocation') }}</span>
                            <el-button
                                size="small"
                                @click="autoLocate"
                            >{{ $t('settings.display.auto_locate') }}</el-button>
                        </div>
                        <div class="switch-full">
                            <span>{{ $t('settings.display.clear_latlng') }}</span>
                            <el-button
                                size="small"
                                @click="clearUserLatLng"
                            >{{ $t('settings.common.clear') }}</el-button>
                        </div>
                        <div class="switch-full">
                            <span>{{ $t('settings.display.show_location') }}</span>
                            <el-switch v-model="settingsStore.mainSettings.displayUser" />
                        </div>
                    </div>
                    <span class="font-bold w-full">{{ $t('settings.display.main_shaking_countdown_title') }}</span>
                    <div class="switch-group">
                        <div class="w-full">
                            <div class="switch-full">
                                <span>{{ $t('settings.display.show_local_estimated_csis_and_swave') }}</span>
                                <el-switch v-model="settingsStore.mainSettings.displayCountdown" />
                            </div>
                            <div class="switch-full pl-4">
                                <span>{{ $t('settings.display.force_calc_countdown') }}</span>
                                <el-switch v-model="settingsStore.mainSettings.forceDisplayCountdown" :disabled="!settingsStore.mainSettings.displayCountdown" />
                            </div>
                            <div class="switch-full pl-4">
                                <span>{{ $t('settings.display.play_countdown_sound') }}</span>
                                <el-switch v-model="settingsStore.mainSettings.playCountdownSound" :disabled="!settingsStore.mainSettings.displayCountdown" />
                            </div>
                            <div class="switch-full pl-8">
                                <span>{{ $t('settings.display.countdown_sound_only_intense') }}</span>
                                <el-switch v-model="settingsStore.mainSettings.countdownOnlyIntense" :disabled="!(settingsStore.mainSettings.displayCountdown && settingsStore.mainSettings.playCountdownSound && settingsStore.advancedSettings.forceCalcInt && settingsStore.mainSettings.playIntenseSound)" />
                            </div>
                            <div class="switch-full pl-8">
                                <span>{{ $t('settings.display.countdown_speech_zh') }}</span>
                                <el-switch v-model="settingsStore.mainSettings.countdownSpeech" :disabled="!(settingsStore.mainSettings.displayCountdown && settingsStore.mainSettings.playCountdownSound)" />
                            </div>
                            <div class="switch-full pl-8">
                                <span>{{ $t('settings.display.countdown_start_at', { sec: settingsStore.mainSettings.countdownStart }) }}</span>
                                <el-slider
                                    v-model="settingsStore.mainSettings.countdownStart"
                                    :disabled="!(settingsStore.mainSettings.displayCountdown && settingsStore.mainSettings.playCountdownSound)"
                                    :min="5" :max="60"
                                    :step="5"
                                    size="small"
                                    show-stops
                                />
                            </div>
                        </div>
                    </div>
                    <span class="font-bold w-full">{{ $t('settings.display.map_intensity_title') }}</span>
                    <div class="switch-group">
                        <div class="switch-full">
                            <span>{{ $t('settings.display.show_map_intensity_legend') }}</span>
                            <el-switch v-model="settingsStore.mainSettings.displayLegend" :disabled="settingsStore.mainSettings.disableEewBaseMap" />
                        </div>
                        <div class="switch-full">
                            <span>{{ $t('settings.display.show_area_intensity_list') }}</span>
                            <el-switch v-model="settingsStore.mainSettings.displayAreaIntensities" />
                        </div>
                    </div>
                    <span class="font-bold w-full">
                        {{ $t('settings.display.default_view_title') }}
                        <el-popover
                            placement="top"
                            :width="300"
                            trigger="hover"
                        >
                            <template #reference>
                                <question-filled width="1em" height="1em" />
                            </template>
                            <strong>
                                <p>{{ $t('settings.display.default_view_hint1') }}</p>
                                <p>{{ $t('settings.display.default_view_hint2') }}</p>
                                <p>{{ $t('settings.display.default_view_hint3') }}</p>
                            </strong>
                        </el-popover>
                    </span>
                    <div class="switch-group">
                        <div class="switch-full">
                            <span>{{ $t('settings.display.latitude') }}</span>
                            <el-input-number
                                class="lat-lng"
                                v-model="settingsStore.mainSettings.viewLatLng[0]"
                                size="small"
                                :step="0.1"
                                :min="-90"
                                :max="90"
                                @change="val => setLat('viewLatLng')(val)"
                            />
                        </div>
                        <div class="switch-full">
                            <span>{{ $t('settings.display.longitude') }}</span>
                            <el-input-number
                                class="lat-lng"
                                v-model="settingsStore.mainSettings.viewLatLng[1]"
                                size="small"
                                :step="0.1"
                                :min="-180"
                                :max="180"
                                @change="val => setLng('viewLatLng')(val)"
                            />
                        </div>
                        <div class="switch-full">
                            <span>{{ $t('settings.display.zoom') }}</span>
                            <el-input-number
                                v-model="settingsStore.mainSettings.defaultZoom"
                                size="small"
                                :min="2"
                                :max="12"
                                :precision="0"
                                style="width: 84px;"
                            />
                        </div>
                        <div class="switch-full">
                            <span>{{ $t('settings.display.set_to_current_view') }}</span>
                            <el-button
                                size="small"
                                @click="setCurrentViewAsDefault"
                            >{{ $t('settings.common.set') }}</el-button>
                        </div>
                        <div class="switch-full">
                            <span>{{ $t('settings.display.clear_latlng') }}</span>
                            <el-button
                                size="small"
                                @click="clearViewLatLng"
                            >{{ $t('settings.common.clear') }}</el-button>
                        </div>
                    </div>
                    <span class="font-bold w-full">{{ $t('settings.display.other_title') }}</span>
                    <div class="switch-group">
                        <div class="switch-full">
                            <span>{{ $t('settings.display.ui_scale') }}</span>
                            <el-select
                                style="width: 72px;"
                                v-model="settingsStore.mainSettings.uiScale"
                                size="small"
                            >
                                <el-option label="50%" :value=0.5 />
                                <el-option label="75%" :value=0.75 />
                                <el-option :label="$t('settings.display.ui_scale_default')" :value=1 />
                                <el-option label="125%" :value=1.25 />
                                <el-option label="150%" :value=1.5 />
                                <el-option label="200%" :value=2 />
                            </el-select>
                        </div>
                        <div class="switch-full">
                            <span>{{ $t('settings.display.show_place_name') }}</span>
                            <el-switch v-model="settingsStore.mainSettings.displayPlaceName"
                            @change="handleNeedReload" />
                        </div>
                        <div class="switch-full">
                            <span>{{ $t('settings.display.show_place_name_on_hover') }}</span>
                            <el-switch v-model="settingsStore.mainSettings.placeNameOnHover"
                            :disabled="settingsStore.mainSettings.useCanvasRenderer"
                            @change="handleNeedReload" />
                        </div>
                        <div class="switch-full">
                            <span>{{ $t('settings.display.show_cn_fault') }}</span>
                            <el-switch v-model="settingsStore.mainSettings.displayCnFault" />
                        </div>
                        <div class="switch-full">
                            <span>{{ $t('settings.display.show_terminator') }}</span>
                            <el-switch v-model="settingsStore.mainSettings.displayTerminator" />
                        </div>
                        <div class="switch-full">
                            <span>{{ $t('settings.display.use_roman_csis') }}</span>
                            <el-switch v-model="settingsStore.mainSettings.useRomanCsis" />
                        </div>
                        <div class="switch-full">
                            <span>{{ $t('settings.display.fill_s_wave') }}</span>
                            <el-switch v-model="settingsStore.mainSettings.fillSWave" />
                        </div>
                        <div class="switch-full">
                            <span>{{ $t('settings.display.s_wave_color_mode') }}</span>
                            <el-select
                                style="width: 168px;"
                                v-model="settingsStore.mainSettings.sWaveColorMode"
                                size="small"
                            >
                                <el-option :label="$t('settings.display.s_wave_color_mode_warn')" :value=0 />
                                <el-option :label="$t('settings.display.s_wave_color_mode_mag')" :value=1 />
                                <el-option :label="$t('settings.display.s_wave_color_mode_intensity')" :value=2 />
                            </el-select>
                        </div>
                        <div class="switch-full">
                            <span>
                                {{ $t('settings.display.hide_drawer') }}
                                <el-popover
                                    placement="top"
                                    :width="300"
                                    trigger="hover"
                                >
                                    <template #reference>
                                        <question-filled width="1em" height="1em" />
                                    </template>
                                    <p>{{ $t('settings.display.hide_drawer_hint') }}</p>
                                </el-popover>
                            </span>
                            <el-switch v-model="settingsStore.mainSettings.hideDrawer" />
                        </div>
                        <div class="w-full">
                            <div class="switch-full">
                                <span>
                                    {{ $t('settings.display.cinema_mode') }}
                                    <el-popover
                                        placement="top"
                                        :width="300"
                                        trigger="hover"
                                    >
                                        <template #reference>
                                            <question-filled width="1em" height="1em" />
                                        </template>
                                        <p>{{ $t('settings.display.cinema_mode_hint1') }}</p>
                                        <strong>
                                            <p>{{ $t('settings.display.cinema_mode_hint2') }}</p>
                                        </strong>
                                    </el-popover>
                                </span>
                                <el-switch v-model="settingsStore.mainSettings.cinemaMode"
                                @change="handleNeedReload" />
                            </div>
                            <div class="switch-full pl-4">
                                <span>{{ $t('settings.display.eqlists_as_default') }}</span>
                                <el-switch v-model="settingsStore.mainSettings.eqlistsAsDefault"
                                :disabled="!settingsStore.mainSettings.cinemaMode" />
                            </div>
                        </div>
                        <div class="switch-full">
                            <span>{{ $t('settings.display.eqlist_display_mode') }}</span>
                            <el-select
                                style="width: 192px;"
                                v-model="settingsStore.mainSettings.eqlistsDisplayMode"
                                size="small"
                                @change="handleNeedReload"
                            >
                                <el-option :label="$t('settings.display.eqlist_display_mode_each')" :value=0 />
                                <el-option :label="$t('settings.display.eqlist_display_mode_latest')" :value=1 />
                            </el-select>
                        </div>
                        <div class="switch-full">
                            <span>{{ $t('settings.display.always_display_latest_info') }}</span>
                            <el-switch v-model="settingsStore.mainSettings.alwaysDisplayLatestInfo" />
                        </div>
                    </div>
                </div>
                <span class="sub-title">{{ $t('settings.performance.title') }}</span>
                <div class="group">
                    <div class="switch-group">
                        <div class="switch-full">
                            <span>{{ $t('settings.performance.max_wave_render_rate', { rate: settingsStore.mainSettings.maxWaveRenderRate }) }}</span>
                            <el-slider
                                v-model="settingsStore.mainSettings.maxWaveRenderRate"
                                :min="1" :max="20"
                                :step="1"
                                size="small"
                            />
                        </div>
                        <div class="switch-full">
                            <span>
                                {{ $t('settings.performance.use_canvas_renderer') }}
                                <el-popover
                                    placement="top"
                                    :width="300"
                                    trigger="hover"
                                >
                                    <template #reference>
                                        <question-filled width="1em" height="1em" />
                                    </template>
                                    <p>{{ $t('settings.performance.use_canvas_renderer_hint1') }}</p>
                                    <p>{{ $t('settings.performance.use_canvas_renderer_hint2') }}</p>
                                    <p>{{ $t('settings.performance.use_canvas_renderer_hint3') }}</p>
                                    <p><strong>{{ $t('settings.performance.use_canvas_renderer_hint4') }}</strong></p>
                                </el-popover>
                            </span>
                            <el-switch v-model="settingsStore.mainSettings.useCanvasRenderer"
                            @change="handleNeedReload" />
                        </div>
                        <div class="switch-full">
                            <span>
                                {{ $t('settings.performance.disable_intensity_layer') }}
                                <el-popover
                                    placement="top"
                                    :width="300"
                                    trigger="hover"
                                >
                                    <template #reference>
                                        <question-filled width="1em" height="1em" />
                                    </template>
                                    <p>{{ $t('settings.performance.disable_intensity_layer_hint1') }}</p>
                                    <p>{{ $t('settings.performance.disable_intensity_layer_hint2') }}</p>
                                    <p>{{ $t('settings.performance.disable_intensity_layer_hint3') }}</p>
                                    <p><strong>{{ $t('settings.performance.disable_intensity_layer_hint4') }}</strong></p>
                                </el-popover>
                            </span>
                            <el-switch v-model="settingsStore.mainSettings.disableEewBaseMap"
                            @change="handleNeedReload" />
                        </div>
                        <div class="switch-full">
                            <span>
                                {{ $t('settings.performance.simplify_layers') }}
                                <el-popover
                                    placement="top"
                                    :width="350"
                                    trigger="hover"
                                >
                                    <template #reference>
                                        <question-filled width="1em" height="1em" />
                                    </template>
                                    <p>{{ $t('settings.performance.simplify_layers_hint1') }}</p>
                                    <p>{{ $t('settings.performance.simplify_layers_hint2') }}</p>
                                    <p><strong>{{ $t('settings.performance.simplify_layers_hint3') }}</strong></p>
                                </el-popover>
                            </span>
                            <el-slider
                                v-model="settingsStore.mainSettings.mapSimplifyFactor"
                                :min="0" :max="4"
                                :step="1"
                                size="small"
                                show-stops
                                :show-tooltip="false"
                                :marks="simplifyMarks"
                                @change="handleNeedReload"
                            />
                        </div>
                    </div>
                </div>
                <span class="sub-title">{{ $t('settings.advanced.title') }}</span>
                <div class="group">
                    <div class="switch-group">
                        <div class="switch-full">
                            <span>{{ $t('settings.advanced.province_cea_merge') }}</span>
                            <el-switch v-model="settingsStore.advancedSettings.provinceCeaEew"
                            @change="handleNeedReload" />
                        </div>
                        <div class="switch-full" v-if="settingsStore.displayTokenButton">
                            <span>{{ $t('settings.advanced.manage_token') }}</span>
                            <el-button size="small" @click="showTokenManager = true">{{ $t('settings.advanced.manage') }}</el-button>
                        </div>
                        <div class="switch-full" v-if="settingsStore.advancedSettings.enableMultiApi">
                            <span>{{ $t('settings.advanced.enable_more_api') }}</span>
                            <el-switch 
                            v-model="settingsStore.advancedSettings.multiApi"
                            @change="handleNeedReload" />
                        </div>
                        <div class="switch-full">
                            <span>{{ $t('settings.advanced.show_api_name') }}</span>
                            <el-switch v-model="settingsStore.advancedSettings.displayApiType" />
                        </div>
                        <div class="switch-full">
                            <span>
                                {{ $t('settings.advanced.force_calc_intensity') }}
                                <el-popover
                                    placement="top"
                                    :width="300"
                                    trigger="hover"
                                >
                                    <template #reference>
                                        <question-filled width="1em" height="1em" />
                                    </template>
                                    <p>{{ $t('settings.advanced.force_calc_intensity_hint1') }}</p>
                                    <p>{{ $t('settings.advanced.force_calc_intensity_hint2') }}</p>
                                    <p>{{ $t('settings.advanced.force_calc_intensity_hint3') }}</p>
                                    <p>{{ $t('settings.advanced.force_calc_intensity_hint4') }}</p>
                                    <p>{{ $t('settings.advanced.force_calc_intensity_hint5') }}</p>
                                    <strong>
                                        <p>{{ $t('settings.advanced.force_calc_intensity_hint6') }}</p>
                                        <p>{{ $t('settings.advanced.force_calc_intensity_hint7') }}</p>
                                        <p>{{ $t('settings.advanced.force_calc_intensity_hint8') }}</p>
                                    </strong>
                                </el-popover>
                            </span>
                            <el-switch 
                            v-model="settingsStore.advancedSettings.forceCalcInt"
                            @change="handleNeedReload" />
                        </div>
                        <div class="switch-full">
                            <span>
                                {{ $t('settings.advanced.use_classic_map_loader') }}
                                <el-popover
                                    placement="top"
                                    :width="300"
                                    trigger="hover"
                                >
                                    <template #reference>
                                        <question-filled width="1em" height="1em" />
                                    </template>
                                    <p>{{ $t('settings.advanced.use_classic_map_loader_hint1') }}</p>
                                    <p>{{ $t('settings.advanced.use_classic_map_loader_hint2') }}</p>
                                    <p><strong>{{ $t('settings.advanced.use_classic_map_loader_hint3') }}</strong></p>
                                </el-popover>
                            </span>
                            <el-switch 
                            v-model="settingsStore.advancedSettings.useClassicMapLoader"
                            @change="handleNeedReload" />
                        </div>
                        <div class="switch-full">
                            <span>
                                {{ $t('settings.advanced.prevent_flicker_mode') }}
                                <el-popover
                                    placement="top"
                                    :width="300"
                                    trigger="hover"
                                >
                                    <template #reference>
                                        <question-filled width="1em" height="1em" />
                                    </template>
                                    <p><strong>{{ $t('settings.advanced.prevent_flicker_mode_hint1') }}</strong></p>
                                    <p>{{ $t('settings.advanced.prevent_flicker_mode_hint2') }}</p>
                                    <p><strong>{{ $t('settings.advanced.prevent_flicker_mode_hint3') }}</strong></p>
                                </el-popover>
                            </span>
                            <el-switch 
                            v-model="settingsStore.advancedSettings.preventFlickerMode"
                            @change="handleNeedReload" />
                        </div>
                        <div class="switch-full" v-if="settingsStore.advancedSettings.enableMockEew">
                            <span>{{ $t('settings.advanced.mock_eew') }}</span>
                            <el-switch 
                            v-model="settingsStore.advancedSettings.mockEew"
                            @change="handleNeedReload" />
                        </div>
                        <div class="switch-full">
                            <span>{{ $t('settings.advanced.status_panel') }}</span>
                            <el-button size="small" @click="statusStore.showStatusPanel = true">{{ $t('settings.advanced.open') }}</el-button>
                        </div>
                        <div class="switch-full">
                            <span>{{ $t('settings.advanced.input_command') }}</span>
                            <el-input
                                type="password"
                                v-model="advancedInput"
                                size="small"
                                style="width: 192px;"
                                @change="handleAdvance" 
                            />
                        </div>
                    </div>
                </div>
                <span class="sub-title">{{ $t('settings.about.title') }}</span>
                <div class="group">
                    <span class="font-bold w-full" v-if="isTauri">{{ $t('settings.about.autostart') }}</span>
                    <div class="switch-group" v-if="isTauri">
                        <div class="switch-full">
                            <span>{{ $t('settings.about.autostart_onboot') }}</span>
                            <el-switch v-model="isAutoStart" @change="handleAutoStart" />
                        </div>
                        <div class="switch-full" v-if="isWindows">
                            <span>{{ $t('settings.about.autostart_minimize') }}</span>
                            <el-switch v-model="settingsStore.mainSettings.minimizeOnLaunch" />
                        </div>
                    </div>
                    <span class="font-bold w-full">{{ $t('settings.about.update') }}</span>
                    <div class="switch-group">
                        <div class="switch-full">
                            <span>{{ $t('settings.about.auto_check_update') }}</span>
                            <el-switch v-model="settingsStore.mainSettings.autoCheckNewVersion" @change="handleAutoCheckVersion" />
                        </div>
                        <div class="switch-full" v-if="isTauri">
                            <span>{{ $t('settings.about.check_prerelease') }}</span>
                            <el-switch v-model="settingsStore.mainSettings.checkPrerelease" />
                        </div>
                        <div class="switch-full" v-if="!isTauri">
                            <span>{{ $t('settings.about.auto_apply_update') }}</span>
                            <el-switch v-model="settingsStore.mainSettings.autoRefresh" />
                        </div>
                        <div class="switch-full">
                            <span>{{ $t('settings.about.check_update_now') }}</span>
                            <el-button
                                type="primary"
                                size="small"
                                @click="checkNewVersion(false)"
                            >{{ $t('settings.about.check_update') }}</el-button>
                        </div>
                    </div>
                    <span class="font-bold w-full">{{ $t('settings.about.help_about') }}</span>
                    <div class="switch-group">
                        <el-button @click="showAbout = true">{{ $t('settings.about.open_help_about') }}</el-button>
                    </div>
                </div>
                <span class="sub-title" v-if="needReload">{{ $t('settings.reload.title') }}</span>
                <div class="group">
                    <el-button 
                        type="warning"
                        v-if="needReload"
                        @click="handleReload"
                    >{{ $t('settings.reload.reload_to_apply') }}</el-button>
                </div>
            </div>
        </div>
        <el-dialog v-model="verifyDialog" width="300px" top="20vh" :show-close="false" append-to-body>
            <el-form :model="idForm">
                <el-form-item :label="$t('settings.dialogs.verify.username')" label-width="80px">
                    <el-input v-model="idForm.username" @keyup.enter="postVerify()" />
                </el-form-item>
                <el-form-item :label="$t('settings.dialogs.verify.password')" label-width="80px">
                    <el-input type="password" v-model="idForm.password" @keyup.enter="postVerify()" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button type="default" @click="verifyDialog = false">{{ $t('settings.common.cancel') }}</el-button>
                <el-button type="primary" @click="postVerify()">{{ $t('settings.common.ok') }}</el-button>
            </template>
        </el-dialog>
        <el-dialog class="customize-audio" v-model="customizeAudio" width="60%" :show-close="false" append-to-body>
            <div class="explanation" v-if="isTauri">
                <div class="text">
                    <p><strong>{{ $t('settings.dialogs.customize_audio.tauri_title') }}</strong></p>
                    <p>{{ $t('settings.dialogs.customize_audio.tauri_step1') }}</p>
                    <p>{{ $t('settings.dialogs.customize_audio.tauri_step2') }}</p>
                    <p>{{ $t('settings.dialogs.customize_audio.tauri_step3') }}</p>
                    <p>{{ $t('settings.dialogs.customize_audio.tauri_step4') }}</p>
                    <p>{{ $t('settings.dialogs.customize_audio.tauri_tip') }}</p>
                    <p><strong>{{ $t('settings.dialogs.customize_audio.tauri_warn') }}</strong></p>
                </div>
                <div class="buttons">
                    <el-button @click="openDataFolder">{{ $t('settings.dialogs.customize_audio.open_audio_folder') }}</el-button>
                    <el-button @click="loadAudio">{{ $t('settings.dialogs.customize_audio.reload_audio') }}</el-button>
                </div>
            </div>
            <div class="test">
                <div class="text">
                    <strong>{{ $t('settings.dialogs.customize_audio.test_title') }}</strong>
                </div>
                <div class="buttons">
                    <el-button v-for="(type, index) of audioTypes" :key="index" @click="playSound(type)">{{ type }}</el-button>
                </div>
            </div>
            <template #footer>
                <el-button type="default" @click="customizeAudio = false">{{ $t('settings.dialogs.customize_audio.close') }}</el-button>
            </template>
        </el-dialog>
        <el-dialog v-model="showTokenManager" width="300px" top="20vh" :show-close="false" append-to-body>
            <el-form :model="idForm">
                <el-form-item v-if="settingsStore.advancedSettings.enableIclEew" label="FAN:DEV" label-width="60px">
                    <el-input v-model="settingsStore.advancedSettings.tokens.fan_dev" @change="handleNeedReload" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button type="primary" @click="showTokenManager = false">{{ $t('settings.common.done') }}</el-button>
            </template>
        </el-dialog>
        <el-dialog class="about-box" v-model="showAbout" width="60%" :show-close="false" append-to-body>
            <div class="header">要石 v2.3.0</div>
            <div class="title">{{ $t('settings.dialogs.about_dialog.usage') }}</div>
            <div class="about">
                <p>主な機能：地震警報（中国地震局・四川地震局・福建地震局・台湾中央気象署・日本気象庁）、地震情報（中国地震台ネットワーク・日本気象庁・韓国気象庁・USGS・FSSN）、津波情報（日本気象庁）、観測網データ（NIED 強震モニタ・KMA-PEWS）などを表示します。</p>
                <p>Chrome/Edge 推奨設定（Chromeの例。Edgeも概ね同様です）:</p>
                <ul>
                    <li>バックグラウンド更新を維持：`chrome://flags` → "Calculate window occlusion on Windows" → Disabled → 再起動</li>
                    <li>（必要な場合のみ）「安全でない」表示の抑制：`chrome://flags` → "Insecure origins treated as secure" → Enabled → このサイトのURLを追加 → 再起動</li>
                    <li>Webアプリとしてインストール：右上メニュー → 保存して共有 → アプリをインストール</li>
                </ul>
                <p>通知：通知権限が必要です（アドレスバー左のアイコン → サイトの設定 → 通知 → 許可）。</p>
                <p>音声：音声再生がブロックされる場合は、サイト設定で音声を許可してください。</p>
            </div>
            <div class="title">{{ $t('settings.dialogs.about_dialog.shortcuts') }}</div>
            <div class="about">
                <ul>
                    <li>[A]uto：自動視野のオン/オフ</li>
                    <li>[D]rawer：サイドバーの表示/非表示</li>
                    <li>[F]ull：メインメニューへ</li>
                    <li>[E]EW：地震警報メニューへ</li>
                    <li>[L]ist：地震情報メニューへ</li>
                    <li>[S]ettings：設定メニューへ</li>
                    <li>[C]lear：地図上の履歴地震をクリア</li>
                    <li v-if="settingsStore.advancedSettings.mockEew">[M]ock：模擬地震警報パネルのオン/オフ</li>
                    <li>[X]：ステータスパネルのオン/オフ</li>
                    <li>[Tab] / [Enter + Tab]：メニューを巡回</li>
                    <li>[,] / [.]：複数ページの情報パネルを巡回</li>
                </ul>
            </div>
            <div class="title">{{ $t('settings.dialogs.about_dialog.notes') }}</div>
            <div class="about">
                <p>震度階級について：中国大陸（香港・マカオ含む）と韓国は MMI（I〜XII）、日本と台湾は震度（0〜7、5/6は弱・強）を主に使用します。一部は推定値で実測ではありません。</p>
                <p>時刻表示について：USGS/FSSN など全球ネットワークは中国標準時、それ以外は発表機関の現地時刻を表示します。</p>
                <p>遅延について：API/サーバー制限により、情報に遅延がある場合があります。</p>
                <p>地図について：初回表示時に地図の読み込みで時間がかかることがあります。長時間表示されない場合は再読み込みしてください。</p>
            </div>
            <div class="title">{{ $t('settings.dialogs.about_dialog.about') }}</div>
            <div class="about">
                <p>Windows 10（x64）/ macOS（arm64）以上はアプリ版の利用を推奨：<a href="https://github.com/Lipomoea/kanameishi/releases" target="_blank">ダウンロード</a>&nbsp;<a href="https://gitee.com/lipomoea/kanameishi/releases" target="_blank">ミラー</a></p>
                <p>連絡先：<a href="https://space.bilibili.com/316757498" target="_blank">リッポミャ</a>（bilibili）</p>
                <p>GitHub：<a href="https://github.com/Lipomoea/kanameishi" target="_blank">https://github.com/Lipomoea/kanameishi</a></p>
                <p>謝辞：</p>
                <p>Wolfx Open API / FAN Studio API / P2P地震情報：API提供。</p>
                <p>kotoho7：SREV 効果音提供（<a href="https://creativecommons.org/licenses/by-sa/2.0/deed.zh-hans" target="_blank">CC BY-SA 2.0</a>、改変なし）。</p>
                <p>地牛WakeUp：中国語カウントダウン音声素材（台湾向け）。<a href="https://eew.earthquake.tw/" target="_blank">地牛 Wake Up！</a></p>
            </div>
            <template #footer>
                <el-button type="default" @click="showAbout = false">{{ $t('settings.dialogs.about_dialog.close') }}</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import { useSettingsStore } from '@/stores/settings';
import { useStatusStore } from '@/stores/status';
import { chimeUrls, utilUrls } from '@/utils/Urls';
import dayjs from 'dayjs';
import { useI18n } from 'vue-i18n';
import Http from '@/classes/Http';
import { ref, reactive, onMounted, onBeforeUnmount, watch, inject, computed } from 'vue'
import { QuestionFilled } from '@element-plus/icons-vue';
import { calcPassedTime, formatCsis, openUrl, playSound, setClassName, shindoScale, calcCsisLevel } from '@/utils/Utils';
import { join, appDataDir } from "@tauri-apps/api/path";
import { convertFileSrc } from "@tauri-apps/api/core";
import { exists, mkdir } from "@tauri-apps/plugin-fs";
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';
import { platform } from '@tauri-apps/plugin-os';
import { isTauri as getIsTauri } from '@tauri-apps/api/core';

const showNotifButton = 'Notification' in window
const isTauri = getIsTauri()
const thisPlatform = isTauri ? platform() : ''
const isWindows = thisPlatform == 'windows'
const { locale, t } = useI18n()
const simplifyMarks = computed(() => ({
    0: t('settings.performance.simplify_marks.off'),
    1: t('settings.performance.simplify_marks.light'),
    2: t('settings.performance.simplify_marks.medium'),
    3: t('settings.performance.simplify_marks.strong'),
    4: t('settings.performance.simplify_marks.extreme')
}))
const settingsStore = useSettingsStore()
const statusStore = useStatusStore()

const niedMarkerCount = inject('niedMarkerCount', ref(0))
const tremMarkerCount = inject('tremMarkerCount', ref(0))
const palertMarkerCount = inject('palertMarkerCount', ref(0))
const emsdMarkerCount = inject('emsdMarkerCount', ref(0))
const kmaMarkerCount = inject('kmaMarkerCount', ref(0))
const msilMarkerCount = inject('msilMarkerCount', ref(0))

const niedMarkerCountDisplay = computed(() => settingsStore.mainSettings.displaySeisNet.niedNet ? (Number(niedMarkerCount.value) || 0) : 0)
const tremMarkerCountDisplay = computed(() => settingsStore.mainSettings.displaySeisNet.tremNet ? (Number(tremMarkerCount.value) || 0) : 0)
const palertMarkerCountDisplay = computed(() => settingsStore.mainSettings.displaySeisNet.palertNet ? (Number(palertMarkerCount.value) || 0) : 0)
const emsdMarkerCountDisplay = computed(() => settingsStore.mainSettings.displaySeisNet.emsdNet ? (Number(emsdMarkerCount.value) || 0) : 0)
const kmaMarkerCountDisplay = computed(() => settingsStore.mainSettings.displaySeisNet.kmaNet ? (Number(kmaMarkerCount.value) || 0) : 0)
const msilMarkerCountDisplay = computed(() => settingsStore.mainSettings.displaySeisNet.msilNet ? (Number(msilMarkerCount.value) || 0) : 0)
const replayDateTime = ref('')
const setReplayDateTime = () => {
    const passedTime = Math.max(Math.round(calcPassedTime(replayDateTime.value, 8) / 600) / 100, 0)
    settingsStore.mainSettings.displaySeisNet.delay = passedTime
}
const setLat = (type)=>(val)=>{
    if(!val) {
        settingsStore.mainSettings[type][0] = 0
        return
    }
    let number = Number(val)
    if(isNaN(number)){
        settingsStore.mainSettings[type][0] = 0
    }
    else{
        if(number > 90) number = 90
        if(number < -90) number = -90
        settingsStore.mainSettings[type][0] = number
    }
}
const setLng = (type)=>(val)=>{
    if(!val) {
        settingsStore.mainSettings[type][1] = 0
        return
    }
    let number = Number(val)
    if(isNaN(number)){
        settingsStore.mainSettings[type][1] = 0
    }
    else{
        if(number > 180) number = 180
        if(number < -180) number = -180
        settingsStore.mainSettings[type][1] = number
    }
}
const autoLocate = async ()=>{
    const res = await Http.get(utilUrls.geoIp)
    if(res.city_zh == null){
        ElMessage({
            message: t('settings.messages.geoip_failed'),
            type: 'error',
        })
    }
    else{
        ElMessageBox.confirm(
            t('settings.messages.geoip_confirm', { city: res.city_zh, lat: res.latitude, lng: res.longitude }),
            t('settings.messages.geoip_confirm_title'),
            {
                confirmButtonText: t('settings.common.ok'),
                cancelButtonText: t('settings.common.cancel'),
                type: 'info',
                showClose: false,
            }
        ).then(()=>{
            setLat('userLatLng')(res.latitude)
            setLng('userLatLng')(res.longitude)
            ElMessage({
                message: t('settings.messages.location_updated'),
                type: 'success',
            })
        }).catch(()=>{
            ElMessage({
                message: t('settings.messages.settings_canceled'),
                type: 'info',
            })
        })
    }
}
const setDefaultZoom = (val)=>{
    settingsStore.mainSettings.defaultZoom = Math.min(Math.max(val, 2), 12)
}
const setCurrentViewAsDefault = ()=>{
    const map = statusStore.map
    if(map == null){
        ElMessage({
            message: t('settings.messages.map_not_loaded'),
            type: 'error',
        })
    }
    else{
        ElMessageBox.confirm(
            t('settings.messages.set_current_view_confirm'),
            t('settings.messages.set_current_view_title'),
            {
                confirmButtonText: t('settings.common.ok'),
                cancelButtonText: t('settings.common.cancel'),
                type: 'info',
                showClose: false,
            }
        ).then(()=>{
            const { lat, lng } = map.getCenter()
            const zoom = map.getZoom()
            setLat('viewLatLng')(lat)
            setLng('viewLatLng')(lng)
            setDefaultZoom(zoom)
            ElMessage({
                message: t('settings.messages.set_success'),
                type: 'success',
            })
        }).catch(()=>{
            ElMessage({
                message: t('settings.messages.settings_canceled'),
                type: 'info',
            })
        })
    }
}
const clearViewLatLng = ()=>{
    settingsStore.mainSettings.viewLatLng[0] = 0
    settingsStore.mainSettings.viewLatLng[1] = 0
    ElMessage({
        message: t('settings.messages.cleared'),
        type: 'success',
    })
}
const clearUserLatLng = ()=>{
    settingsStore.mainSettings.userLatLng[0] = 0
    settingsStore.mainSettings.userLatLng[1] = 0
    ElMessage({
        message: t('settings.messages.cleared'),
        type: 'success',
    })
}
const needReload = ref(false)
const handleReload = () => {
    window.location.reload()
}
const handleFssnEqlist = (newVal) => {
    if(newVal) {
        ElMessageBox.confirm(
            t('settings.messages.fssn_confirm'),
            t('settings.messages.fssn_confirm_title'),
            {
                confirmButtonText: t('settings.common.ok'),
                cancelButtonText: t('settings.common.cancel'),
                type: 'warning',
                showClose: false,
            }
        ).then(()=>{
            settingsStore.mainSettings.source.fssnEqlist = true
            handleNeedReload()
        }).catch(()=>{
            settingsStore.mainSettings.source.fssnEqlist = false
        })
    }
    else {
        handleNeedReload()
    }
}
const showTokenManager = ref(false)
const advancedInput = ref('')
const verifyDialog = ref(false)
let verifyType = ''
const idForm = reactive({
    username: '',
    password: '',
})
const handleAdvance = (val)=>{
    switch(val){
        case 'enableIclEew':
        case 'enableTremFunctions':
        case 'enableGqEew':
        case 'enableMultiApi':
        case 'enableNmefcTsunami':
        case 'verifyAdmin': {
            verifyType = val
            verifyDialog.value = true
            break
        }
        case 'disableIclEew': {
            if(settingsStore.mainSettings.source.iclEew) handleNeedReload()
            settingsStore.advancedSettings.enableIclEew = false
            settingsStore.mainSettings.source.iclEew = false
            ElMessage({
                message: t('settings.messages.feature_disabled'),
                type: 'success'
            })
            break
        }
        case 'disableTremFunctions': {
            if(settingsStore.mainSettings.source.cwaEqlist) handleNeedReload()
            settingsStore.advancedSettings.enableTremFunctions = false
            settingsStore.mainSettings.source.cwaEqlist = false
            settingsStore.mainSettings.displaySeisNet.tremNet = false
            ElMessage({
                message: t('settings.messages.feature_disabled'),
                type: 'success'
            })
            break
        }
        case 'disableGqEew': {
            if(settingsStore.mainSettings.source.gqEew) handleNeedReload()
            settingsStore.advancedSettings.enableGqEew = false
            settingsStore.mainSettings.source.gqEew = false
            ElMessage({
                message: t('settings.messages.feature_disabled'),
                type: 'success'
            })
            break
        }
        case 'disableMultiApi': {
            if(settingsStore.advancedSettings.multiApi) handleNeedReload()
            settingsStore.advancedSettings.enableMultiApi = false
            settingsStore.advancedSettings.multiApi = false
            ElMessage({
                message: t('settings.messages.feature_disabled'),
                type: 'success'
            })
            break
        }
        case 'disableNmefcTsunami': {
            if(settingsStore.mainSettings.source.nmefcTsunami) handleNeedReload()
            settingsStore.advancedSettings.enableNmefcTsunami = false
            settingsStore.mainSettings.source.nmefcTsunami = false
            ElMessage({
                message: t('settings.messages.feature_disabled'),
                type: 'success'
            })
            break
        }
        case 'enableMockEew': {
            ElMessageBox.confirm(
                t('settings.messages.mock_eew_confirm'),
                t('settings.messages.mock_eew_confirm_title'),
                {
                    confirmButtonText: t('settings.common.agree'),
                    cancelButtonText: t('settings.common.disagree'),
                    type: 'warning',
                    showClose: false,
                }
            ).then(()=>{
                settingsStore.advancedSettings.enableMockEew = true
            }).catch(()=>{
                if(settingsStore.advancedSettings.mockEew) handleNeedReload()
                settingsStore.advancedSettings.mockEew = false
                settingsStore.advancedSettings.enableMockEew = false
            })
            break
        }
        case 'disableMockEew': {
            if(settingsStore.advancedSettings.mockEew) handleNeedReload()
            settingsStore.advancedSettings.mockEew = false
            settingsStore.advancedSettings.enableMockEew = false
            break
        }
    }
    advancedInput.value = ''
}
const postVerify = async (type = verifyType)=>{
    switch(type){
        case 'enableIclEew': {
            const res = await Http.post('https://api.lipomoea.tech/icl_url', idForm)
            if(res && res.success){
                settingsStore.advancedSettings.enableIclEew = true
                localStorage.setItem('iclUrl', JSON.stringify(res.data))
                verifyDialog.value = false
                ElMessage({
                    message: t('settings.messages.verify_success'),
                    type: 'success'
                })
            }
            else{
                ElMessage({
                    message: t('settings.messages.verify_failed'),
                    type: 'error'
                               })
            }
            break
        }
        case 'enableTremFunctions': {
            const res = await Http.post('https://api.lipomoea.tech/trem_url', idForm)
            if(res && res.success){
                settingsStore.advancedSettings.enableTremFunctions = true
                localStorage.setItem('tremUrl', JSON.stringify(res.data))
                verifyDialog.value = false
                ElMessage({
                    message: t('settings.messages.verify_success'),
                    type: 'success'
                })
            }
            else{
                ElMessage({
                    message: t('settings.messages.verify_failed'),
                    type: 'error'
                })
            }
            break
        }
        case 'enableGqEew': {
            const res = await Http.post('https://api.lipomoea.tech/gq_url', idForm)
            if(res && res.success){
                settingsStore.advancedSettings.enableGqEew = true
                localStorage.setItem('gqUrl', JSON.stringify(res.data))
                verifyDialog.value = false
                ElMessage({
                    message: t('settings.messages.verify_success'),
                    type: 'success'
                })
            }
            else{
                ElMessage({
                    message: t('settings.messages.verify_failed'),
                    type: 'error'
                })
            }
            break
        }
        case 'enableMultiApi': {
            const res = await Http.post('https://api.lipomoea.tech/multi_api', idForm)
            if(res && res.success){
                settingsStore.advancedSettings.enableMultiApi = true
                localStorage.setItem('multiApi', JSON.stringify(res.data))
                verifyDialog.value = false
                ElMessage({
                    message: t('settings.messages.verify_success'),
                    type: 'success'
                })
            }
            else{
                ElMessage({
                    message: t('settings.messages.verify_failed'),
                    type: 'error'
                })
            }
            break
        }
        case 'enableNmefcTsunami': {
            const res = await Http.post('https://api.lipomoea.tech/cn_tsunami_topo_json_url', idForm)
            if(res && res.success){
                settingsStore.advancedSettings.enableNmefcTsunami = true
                localStorage.setItem('nmefcTsunami', JSON.stringify(res.data))
                verifyDialog.value = false
                ElMessage({
                    message: t('settings.messages.verify_success'),
                    type: 'success'
                })
            }
            else{
                ElMessage({
                    message: t('settings.messages.verify_failed'),
                    type: 'error'
                })
            }
            break
        }
        case 'verifyAdmin': {
            postVerify('enableIclEew')
            postVerify('enableTremFunctions')
            postVerify('enableGqEew')
            postVerify('enableMultiApi')
            postVerify('enableNmefcTsunami')
        }
    }
}
const handleNeedReload = () => {
    if(!needReload.value) {
        needReload.value = true
        ElMessage({
            message: t('settings.messages.need_reload_to_apply'),
            type: 'warning',
            duration: 0,
            showClose: true,
            onClose: handleReload
        })
    }
}
const showAbout = ref(false)
let hasNewVersion = false
const checkNewVersion = async (silent = false) => {
    const currentVersion = document.title.split('v')[1]
    try {
        const versionInfo = await Http.get('https://api.github.com/repos/Lipomoea/kanameishi/releases')
        let checkedVersion, downloadUrl, detail
        if(isTauri) {
            const fileType = isWindows ? '.exe' : '.dmg'
            let i = 0
            let asset = undefined
            while(i < versionInfo.length) {
                asset = versionInfo[i].assets.find(asset => asset.name.endsWith(fileType))
                if((!versionInfo[i].prerelease || settingsStore.mainSettings.checkPrerelease) && asset) break
                i++
            }
            if(i == versionInfo.length) {
                ElMessage({
                    message: t('settings.messages.no_update_available'),
                    type: 'info'
                })
                return
            }
            else {
                checkedVersion = versionInfo[i].tag_name.slice(1)
                downloadUrl = asset.browser_download_url
                detail = versionInfo[i].body
            }
        }
        else {
            checkedVersion = versionInfo[0].tag_name.slice(1)
            downloadUrl = ''
            detail = versionInfo[0].body
        }
        if(compareVersion(currentVersion, checkedVersion)) {
            if(!hasNewVersion) {
                hasNewVersion = true
                ElMessage({
                    message: t('settings.messages.new_version_found', { version: checkedVersion }),
                    type: 'success',
                    duration: 0,
                    showClose: true,
                    onClose: () => hasNewVersion = false
                })
            }
            ElMessageBox.close()
            if(isTauri) {
                if(!silent) {
                    ElMessageBox.confirm(
                        t('settings.messages.download_confirm', { version: checkedVersion, detail }),
                        t('settings.messages.download_confirm_title'),
                        {
                            confirmButtonText: t('settings.messages.download'),
                            cancelButtonText: t('settings.common.close'),
                            type: '',
                            showClose: false
                        }
                    ).then(()=>{
                        openUrl(downloadUrl)
                    })
                }
            }
            else {
                if(settingsStore.mainSettings.autoRefresh) {
                    ElMessage({
                        message: t('settings.messages.new_version_auto_refresh'),
                        type: 'success'
                    })
                    setTimeout(() => {
                        handleReload()
                    }, 5000);
                }
                else {
                    if(!silent) {
                        ElMessageBox.confirm(
                            t('settings.messages.refresh_confirm', { version: checkedVersion, detail }),
                            t('settings.messages.refresh_confirm_title'),
                            {
                                confirmButtonText: t('settings.common.ok'),
                                cancelButtonText: t('settings.common.cancel'),
                                type: 'info',
                                showClose: false,
                            }
                        ).then(()=>{
                            handleReload()
                        })
                    }
                }
            }
        }
        else if(!silent) {
            ElMessage({
                message: t('settings.messages.up_to_date'),
                type: 'success'
            })
        }
    } catch (_) {
        ElMessage({
            message: t('settings.messages.update_check_failed'),
            type: 'error'
        })
    }
}
const compareArray = (arr1, arr2) => {
    arr1 = arr1.map(i => Number(i))
    arr2 = arr2.map(i => Number(i))
    const len1 = arr1.length
    const len2 = arr2.length
    const lenDiff = len1 - len2
    if(lenDiff > 0) {
        arr2.push(...new Array(lenDiff).fill(0))
    }
    else if(lenDiff < 0) {
        arr1.push(...new Array(-lenDiff).fill(0))
    }
    const len = arr1.length
    for(let i = 0; i < len; i++) {
        if(arr1[i] > arr2[i]) return true
        else if(arr1[i] < arr2[i]) return false
    }
    return false
}
const compareVersion = (currentVersion, checkedVersion) => {
    const splitCurrent = currentVersion.split('-')
    const splitChecked = checkedVersion.split('-')
    if(compareArray(splitChecked[0].split('.'), splitCurrent[0].split('.'))) return true
    else if(compareArray(splitCurrent[0].split('.'), splitChecked[0].split('.'))) return false
    else if(splitChecked.length < splitCurrent.length) return true
    else if(splitChecked.length > splitCurrent.length) return false
    else if(splitChecked.length == 1) return false
    else {
        const typeArr = ['pre', 'rc']
        const currentSuffixArr = splitCurrent[1].split('.')
        const checkedSuffixArr = splitChecked[1].split('.')
        if(typeArr.indexOf(currentSuffixArr[0]) > typeArr.indexOf(checkedSuffixArr[0])) return false
        else if(typeArr.indexOf(currentSuffixArr[0]) < typeArr.indexOf(checkedSuffixArr[0])) return true
        else {
            currentSuffixArr.shift()
            checkedSuffixArr.shift()
            if(compareArray(checkedSuffixArr, currentSuffixArr)) return true
            else return false
        }
    }
}
let autoCheckInterval
const handleAutoCheckVersion = (val) => {
    clearInterval(autoCheckInterval)
    if(val) {
        checkNewVersion(true)
        autoCheckInterval = setInterval(() => {
            checkNewVersion(true)
        }, 6 * 3600 * 1000);
    }
}
const audioTypes = Object.keys(chimeUrls.general).concat(Object.keys(chimeUrls.srev))
const customizeAudio = ref(false)
const loadAudio = () => {
    if(isTauri) {
        chimeUrls.custom = {}
        audioTypes.forEach(async type => {
            try {
                const fileName = type + '.mp3'
                const appDataPath = await appDataDir()
                const filePath = await join(appDataPath, 'audio', fileName)
                const isExist = await exists(filePath)
                if(isExist) {
                    const url = convertFileSrc(filePath)
                    chimeUrls.custom[type] = url
                }
            } catch (err) {
                console.log(err);
            }
        })
    }
}
const openDataFolder = async () => {
    try {
        const appDataPath = await appDataDir()
        const audioPath = await join(appDataPath, 'audio')
        const isExist = await exists(audioPath)
        if(!isExist) await mkdir(audioPath, { recursive: true })
        openUrl(audioPath)
    } catch (e) {
        console.error(e)
    }
}
const isAutoStart = ref(false)
const handleAutoStart = async (value) => {
    if(isTauri) {
        value ? await enable() : await disable()
        isAutoStart.value = await isEnabled()
    }
}
watch(() => settingsStore.mainSettings.language, (newLang) => {
  locale.value = newLang;
});
onMounted(async () => {
    locale.value = settingsStore.mainSettings.language;
    handleAutoCheckVersion(settingsStore.mainSettings.autoCheckNewVersion)

    // 追加：後方互換（保存済み設定に msilStations が無い場合）
    if (settingsStore.mainSettings?.displaySeisNet?.msilStations === undefined) {
      settingsStore.mainSettings.displaySeisNet.msilStations = true
    }

    if(isTauri) {
        loadAudio()
        isAutoStart.value = await isEnabled()
    }
})
onBeforeUnmount(() => {
    clearInterval(autoCheckInterval)
})
</script>

<style lang="scss" scoped>
.outer1{
    width: 100%;
    .container{
        width: 100%;
        padding: 5px;
        display: flex;
        flex-direction: column;
        .title{
            font-size: 24px;
            font-weight: 700;
        }
        .settings{
            display: flex;
            flex-direction: column;
            width: 100%;
            .sub-title{
                font-size: 18px;
                font-weight: 700;
                margin: 10px 0 5px;
            }
            .group{
                display: flex;
                flex-direction: column;
                width: 100%;
                align-items: flex-start;
                row-gap: 4px;
            }
            .switch-group{
                width: 100%;
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                row-gap: 4px;
                column-gap: 15px;
            }
            .switch{
                display: flex;
                align-items: center;
                column-gap: 5px;
            }
            .switch-full {
                display: flex;
                width: 100%;
                justify-content: space-between;
                align-items: center;
            }
            .el-switch{
                height: 24px;
            }
            .lat-lng{
                width: 120px;
            }
            span{
                display: flex;
                align-items: center;
            }
        }
    }
}
ul {
    list-style-position: inside;
}
.w-full{
    width: 100%;
}
.el-checkbox{
    height: 24px;
    margin: 0px;
}
.int {
    width: 22px;
    height: 22px;
    margin-left: 6px;
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
    .roman.scale-9 {
        transform: scaleX(0.9);
    }
}
.mag {
    width: 28px;
    height: 22px;
    margin-left: 6px;
    border-radius: 5px;
    display: flex;
    justify-content: center;
    align-items: center;
    pointer-events: none;
    user-select: none;
}
.el-slider {
    flex: 1;
    margin: 0 1rem;
}
.justify-between {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.flex {
    display: flex;
    align-items: center;
}
.ml-4 {
    margin-left: 1rem;
}
.mr-4 {
    margin-right: 1rem;
}
.pl-4 {
    padding-left: 1rem;
}
.pl-8 {
    padding-left: 2rem;
}
.pr-4 {
    padding-right: 1rem;
}
.gap-2 {
    gap: 0.5rem;
}
.font-bold {
    font-weight: 700;
}
.text-right {
    text-align: right;
    :deep(.el-input__inner) {
        text-align: right;
    }
}
</style>

<style lang="scss">
.about-box {
    padding: 20px;
    .header {
        width: 100%;
        text-align: center;
        font-size: 24px;
        font-weight: 700;
    }
    .title{
        font-size: 20px;
        font-weight: 700;
    }
    .about {
        font-size: 16px;
    }
    .about+.about{
        margin-top: 10px;
    }
    a,a:visited{
        color: blue;
    }
}
.customize-audio {
    display: flex;
    flex-direction: column;
    align-items: center;
    .explanation,.test {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        .text {
            font-size: 16px;
        }
        .buttons {
            width: 100%;
            display: flex;
            column-gap: 20px;
            row-gap: 10px;
            justify-content: center;
            flex-wrap: wrap;
            .el-button {
                width: 150px;
                margin: 0;
            }
        }
    }
    .test {
        margin-top: 20px;
    }
}
</style>