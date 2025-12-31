<template>
    <div>

    </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, inject } from 'vue';
import { useStatusStore } from '@/stores/status';
import { useSettingsStore } from '@/stores/settings';
import { seisNetUrls, iconUrls } from '@/utils/Urls';
import { getTimeNumberString, playSound, sendMyNotification, calcTimeDiff, focusWindow, getShindoFromLevel, stampToTime, calcWaveDistance } from '@/utils/Utils';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { getTjma2001TravelTime } from '@/utils/Tjma2001'
import { locateHypocenterGeigerRobust } from '@/utils/HypocenterGeiger'
import { refineHypocenterArrivalNonArrival } from '@/utils/ArrivalNonArrivalRefine'
import { getNearestEpiName } from '@/utils/EpiName'
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { NiedStation, simpleIcon } from '@/classes/StationClasses';
import eewCross from '@/assets/icon/hypocenter/eewCross.svg'

const statusStore = useStatusStore()
const settingsStore = useSettingsStore()
let stationList = []
const stationData = ref([])
const stations = reactive([])
const siteConfigId = ref('')
let map
const yahooBase = computed(() => (import.meta.env.DEV ? '/yahoo' : 'https://weather-kyoshin.east.edge.storage-yahoo.jp'))

const iconRadius = 20
const niedHypoIcon = L.icon({
    iconUrl: eewCross,
    iconSize: [iconRadius * 2, iconRadius * 2],
    iconAnchor: [iconRadius, iconRadius]
})

// stationId -> { tMs: number, level: number }
const firstDetectMsByStationId = new Map()
const OBS_KEEP_GAP_MS = 10 * 1000
let lastDetectActiveAtMs = 0
let niedHypoMarker = null
let niedPWave = null
let niedSWave = null
let niedSWaveFill = null
let lastHypo = null
let lastHypoEstimateAtMs = 0
let hypoEstimateFinished = false
let hypoStopChecked = false
let _tjma2001 = null
let _niedHypoTooltipKey = ''
let _niedEpiName = ''
let _niedEpiReqId = 0

// 予報円の描画は「データ取得/解析」と分離して 10fps で回す
const NIED_FORECAST_DRAW_INTERVAL_MS = 100
let niedForecastDrawTimer = null

const HYPO_ESTIMATE_MIN_POINTS = 40
const HYPO_ESTIMATE_STOP_AFTER_MS = 20 * 1000
const _getHypoEstimateMaxPoints = () => {
    const v = Number(settingsStore.mainSettings?.displaySeisNet?.hypoEstimateMaxPoints)
    const n = Number.isFinite(v) ? Math.floor(v) : 120
    return Math.min(500, Math.max(HYPO_ESTIMATE_MIN_POINTS, n))
}

const _escapeHtml = (s) => String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const _getTravelTime = () => {
    if(_tjma2001) return _tjma2001
    _tjma2001 = getTjma2001TravelTime()
    return _tjma2001
}

const _clearNiedHypoLayers = ()=>{
    if(!map) return
    if(niedHypoMarker && map.hasLayer(niedHypoMarker)) map.removeLayer(niedHypoMarker)
    if(niedPWave && map.hasLayer(niedPWave)) map.removeLayer(niedPWave)
    if(niedSWave && map.hasLayer(niedSWave)) map.removeLayer(niedSWave)
    if(niedSWaveFill && map.hasLayer(niedSWaveFill)) map.removeLayer(niedSWaveFill)
    niedHypoMarker = null
    niedPWave = null
    niedSWave = null
    niedSWaveFill = null
    _niedHypoTooltipKey = ''
}

const _resetNiedHypo = (hard = false)=>{
    if(hard) firstDetectMsByStationId.clear()
    lastHypo = null
    lastHypoEstimateAtMs = 0
    hypoEstimateFinished = false
    hypoStopChecked = false
    _niedEpiName = ''
    if(niedEpicenterName) niedEpicenterName.value = ''
    if(niedDetectActive) niedDetectActive.value = false
    if(niedDetectOriginTime) niedDetectOriginTime.value = ''
    if(niedDetectDepthKm) niedDetectDepthKm.value = NaN
    if(niedDetectObsCount) niedDetectObsCount.value = 0
    _clearNiedHypoLayers()
}

const _resolveEpicenterName = async (hypo)=>{
    if(!hypo || !niedEpicenterName) return
    const reqId = ++_niedEpiReqId
    try {
        const name = await getNearestEpiName(hypo.lat, hypo.lon)
        if(reqId !== _niedEpiReqId) return
        _niedEpiName = name || ''
        niedEpicenterName.value = _niedEpiName
        _niedHypoTooltipKey = ''
    }
    catch {
        if(reqId !== _niedEpiReqId) return
        _niedEpiName = ''
        niedEpicenterName.value = ''
        _niedHypoTooltipKey = ''
    }
}

const _updateHypoLayers = (hypo, frameMs)=>{
    if(!map || !hypo) return
    const travelTime = _getTravelTime()
    const latLng = [hypo.lat, hypo.lon]
    const passedSec = Math.max(0, (frameMs - hypo.originMs) / 1000)
    const pInfo = calcWaveDistance(travelTime, true, hypo.depthKm, passedSec)
    const sInfo = calcWaveDistance(travelTime, false, hypo.depthKm, passedSec)
    const pRadiusKm = pInfo?.radius || 0
    const sRadiusKm = sInfo?.radius || 0

    if(!niedHypoMarker){
        niedHypoMarker = L.marker(latLng, { icon: niedHypoIcon, pane: 'eewMarkerPane' }).addTo(map)
    }
    else {
        niedHypoMarker.setLatLng(latLng)
    }

    const originStr = Number.isFinite(hypo.originMs) ? stampToTime(hypo.originMs, 9) : ''
    const tooltipKey = `${hypo.depthKm}|${originStr}|${_niedEpiName}`
    if(tooltipKey !== _niedHypoTooltipKey){
        _niedHypoTooltipKey = tooltipKey
        const nameLine = _niedEpiName ? `<br>Name ${_escapeHtml(_niedEpiName)}` : ''
        niedHypoMarker.bindTooltip(
            `<strong>NIED(推定)</strong><br>Depth ${hypo.depthKm}km<br>Origin ${originStr}${nameLine}`,
            { permanent: false, direction: 'top', className: 'custom-tooltip' }
        )
    }

    const shakePColor = 'var(--swave-blue)'
    if(pRadiusKm > 0){
        if(!niedPWave){
            niedPWave = L.circle(latLng, { color: shakePColor, opacity: 1, weight: 2, fill: false, radius: pRadiusKm * 1000, pane: 'wavePane', interactive: false }).addTo(map)
        }
        else {
            niedPWave.setLatLng(latLng)
            niedPWave.setRadius(pRadiusKm * 1000)
        }
    }
    else if(niedPWave && map.hasLayer(niedPWave)){
        map.removeLayer(niedPWave)
        niedPWave = null
    }

    const sColor = 'var(--swave-green)'
    if(sRadiusKm > 0){
        if(!niedSWave){
            niedSWave = L.circle(latLng, { color: sColor, opacity: 1, weight: 2, fill: false, radius: sRadiusKm * 1000, pane: 'wavePane', interactive: false }).addTo(map)
        }
        else {
            niedSWave.setLatLng(latLng)
            niedSWave.setRadius(sRadiusKm * 1000)
        }
        if(!niedSWaveFill){
            niedSWaveFill = L.circle(latLng, { fillColor: sColor, fillOpacity: 0.2, stroke: false, radius: sRadiusKm * 1000, pane: 'waveFillPane', interactive: false }).addTo(map)
        }
        else {
            niedSWaveFill.setLatLng(latLng)
            niedSWaveFill.setRadius(sRadiusKm * 1000)
        }
    }
    else {
        if(niedSWave && map.hasLayer(niedSWave)) map.removeLayer(niedSWave)
        if(niedSWaveFill && map.hasLayer(niedSWaveFill)) map.removeLayer(niedSWaveFill)
        niedSWave = null
        niedSWaveFill = null
    }
}

const _startNiedForecastDrawLoop = () => {
    if (niedForecastDrawTimer) return
    niedForecastDrawTimer = setInterval(() => {
        if (!map) return
        if (!lastHypo) return

        // 揺れ検知が完全に途切れた後は更新しない（安全側）
        const logicalNowMs = Date.now() - (Number.isFinite(delay.value) ? delay.value : 0)
        if (!Number.isFinite(logicalNowMs)) return
        if (lastDetectActiveAtMs > 0 && logicalNowMs - lastDetectActiveAtMs > OBS_KEEP_GAP_MS && firstDetectMsByStationId.size === 0) return

        _updateHypoLayers(lastHypo, logicalNowMs)
    }, NIED_FORECAST_DRAW_INTERVAL_MS)
}

const _stopNiedForecastDrawLoop = () => {
    if (niedForecastDrawTimer) clearInterval(niedForecastDrawTimer)
    niedForecastDrawTimer = null
}

const _fetchJson = async (url)=>{
    // TauriではCORS回避のためplugin-httpで取得する
    if(typeof window !== 'undefined' && window.__TAURI__){
        const res = await tauriFetch(url, {
            method: 'GET',
            connectTimeout: 10000,
            headers: {
                'Referer': 'https://weather.yahoo.co.jp/',
                'Origin': 'https://weather.yahoo.co.jp'
            }
        })
        const data = await res.json()
        return { status: res.status, data }
    }
    const res = await fetch(url, { cache: 'no-store' })
    const status = res.status
    let data = null
    try { data = await res.json() } catch {}
    return { status, data }
}
const defaultDelay = 1200
const maxDelay = 3000
const delay = ref(defaultDelay)
const niedMaxShindo = inject('niedMaxShindo')
const niedUpdateTime = inject('niedUpdateTime')
const niedPeriodMaxShindo = inject('niedPeriodMaxShindo')
const niedPeriodBarClass = inject('niedPeriodBarClass')
const niedMarkerCount = inject('niedMarkerCount')
const niedEpicenterName = inject('niedEpicenterName')
const niedDetectActive = inject('niedDetectActive')
const niedDetectOriginTime = inject('niedDetectOriginTime')
const niedDetectDepthKm = inject('niedDetectDepthKm')
const niedDetectObsCount = inject('niedDetectObsCount')
const handleTempEqlists = inject('handleTempEqlists')
const smartSetView = inject('smartSetView')
let periodMaxLevel = -1
const currentMaxShindo = computed(()=>{
    const currentMaxLevel = Math.max(...Object.keys(grids.value).map(key=>grids.value[key].level), -1)
    if(currentMaxLevel == -1) return -1
    else if(currentMaxLevel <= 7) return 0
    else if(currentMaxLevel <= 9) return 1
    else if(currentMaxLevel <= 11) return 2
    else if(currentMaxLevel <= 13) return 3
    else if(currentMaxLevel <= 15) return 4
    else if(currentMaxLevel <= 17) return 5
    else if(currentMaxLevel <= 19) return 6
    else return 7
})
let adjStationIds = {}
let expireSeconds = {}
let distMatrix = [[]]
let decimal = [0, 0]
const gridRects = {}
const activeStations = computed(()=>{
    const list = []
    stations.forEach(station=>{
        if(station.isActive) list.push(station)
    })
    return list
})
const grids = computed(()=>{
    let grids = {}
    activeStations.value.forEach(station=>{
        const latLng = station.latLng.map((l, index) => Math.round(l - decimal[index]) + decimal[index])
        const level = station.level
        const key = JSON.stringify(latLng)
        if(key in grids){
            if(level > grids[key].level) grids[key].level = level
        }
        else {
            grids[key] = {
                latLng,
                level
            }
        }
    })
    return grids
})
const getData = async (url)=>{
    try {
        const res = await _fetchJson(url)
        if(res?.status && res.status >= 400 && delay.value <= maxDelay - 100) {
            delay.value += 100
        }
        return res
    }
    catch (e) {
        if(delay.value <= maxDelay - 100) {
            delay.value += 100
        }
    }
}
let pendingRender = false
const nearbyLength = 6
const activityThresArr = [Infinity, 9, 12, 14, 15, 16, 16]
const update = (frameMs)=>{
    if(stationList.length == stations.length && stations.length == stationData.value.length){
        const render = document.visibilityState === 'visible'
        if(!render) pendingRender = true
        const nowMs = Number.isFinite(frameMs) ? frameMs : Date.now()
        let maxLevel = -1
        for(let i = 0; i < stationList.length; i++){
            stations[i].update(stationData.value[i], render)
            if(stations[i].level > maxLevel) maxLevel = stations[i].level
        }
        niedMaxShindo.value = getShindoFromLevel(maxLevel)
        const possibleStations = stations.filter(station=>station.activity > 0)
        const activeStationsSet = new Set()
        const checkedStations = new Set()
        possibleStations.forEach(station=>{
            if(!checkedStations.has(station)){
                if(station.isActive && station.ascend > 0) {
                    chainActivate(station, activeStationsSet, checkedStations)
                    return
                }
                const nearbyStations = adjStationIds[station.id].map(id=>stations[id]).filter(station=>station.level > -1)
                const possibleNearbyStations = nearbyStations.filter(station=>station.activity > 0)
                const nearbyActiveNum = possibleNearbyStations.length - possibleNearbyStations.filter(station => station.ascend <= 1 && !station.isActive).length / 2
                let numThres, activityThres
                switch(settingsStore.mainSettings.displaySeisNet.niedSensitivity) {
                    case 1:
                        numThres = 3
                        activityThres = activityThresArr[nearbyStations.length] + 2
                        break
                    case 2:
                        numThres = nearbyStations.length <= 2 ? (nearbyStations.length + 1) / 2 : nearbyStations.length / 2
                        activityThres = activityThresArr[nearbyStations.length]
                        break
                    case 3:
                        numThres = nearbyStations.length / 2
                        activityThres = activityThresArr[nearbyStations.length] - 2
                        break
                    default:
                        return
                }
                if (nearbyActiveNum >= numThres) {
                    const numActivity = nearbyActiveNum * (nearbyActiveNum + 1) / 2
                    const nearbyActivity = nearbyStations.reduce((sum, nearbyStation, index) => 
                        index >= 3 && distMatrix[station.id][nearbyStation.id] > 15 
                        ? sum + nearbyStation.activity / 2 
                        : sum + nearbyStation.activity, 0
                    ) + numActivity
                    if (nearbyActivity >= activityThres) {
                        chainActivate(station, activeStationsSet, checkedStations)
                    }
                }
            }
        })
        if(!statusStore.isActive.niedNet) {
            let first = null
            activeStationsSet.forEach(station=>{
                if(!first || station.level > first.level) {
                    first = station
                }
            })
            if(first) decimal = first.latLng.map(val => Math.round((val + 180) % 1 * 10) / 10)
        }

        // 検出が一度途切れても、推定に使う観測点(初検知)は保持する。
        // ただし長時間空いた後に再び揺れ検知が始まった場合は、新規イベント扱いでクリアする。
        if(Number.isFinite(nowMs) && activeStationsSet.size > 0){
            if(lastDetectActiveAtMs > 0 && nowMs - lastDetectActiveAtMs > OBS_KEEP_GAP_MS){
                _resetNiedHypo(true)
            }
            lastDetectActiveAtMs = nowMs
        }

        activeStationsSet.forEach(station=>{
            if(Number.isFinite(nowMs) && !firstDetectMsByStationId.has(station.id)) {
                firstDetectMsByStationId.set(station.id, { tMs: nowMs, level: station.level })
            }
            station.setActive()
        })

        const canEstimate = map && Number.isFinite(nowMs) && (
            activeStationsSet.size > 0 ||
            (firstDetectMsByStationId.size > 0 && lastDetectActiveAtMs > 0 && nowMs - lastDetectActiveAtMs <= OBS_KEEP_GAP_MS)
        )

        if(canEstimate){
            if(!hypoEstimateFinished && nowMs - lastHypoEstimateAtMs >= 1000){
                const picks = []
                // 推定には「現在アクティブな局」だけでなく、イベント中に一度でも検知した局(初検知)を使う
                for (const [id, info] of firstDetectMsByStationId.entries()) {
                    const station = stations[id]
                    const tMs = info?.tMs
                    if(!station || !Number.isFinite(tMs)) continue
                    const lat = station.latLng[0]
                    const lon = station.latLng[1]

                    // Yahoo sitelist 側に標高が含まれている場合のみ利用（無ければ 0m）
                    let elevM = 0
                    const src = stationList?.[station.id]
                    if (Array.isArray(src) && Number.isFinite(src[2])) {
                        elevM = Number(src[2])
                    } else if (src && typeof src === 'object') {
                        const v = src.elevation ?? src.elev ?? src.altitude ?? src.alt ?? src.height
                        const n = Number(v)
                        if (Number.isFinite(n)) elevM = n
                    }

                    picks.push({
                        id,
                        tObsSec: tMs / 1000,
                        ll: L.latLng(station.latLng),
                        lat,
                        lon,
                        level: Number.isFinite(info?.level) ? info.level : (station.level ?? -1),
                        elevM
                    })
                }
                picks.sort((a,b)=>a.tObsSec-b.tObsSec)
                const firstPickMs = picks.length > 0 ? (picks[0].tObsSec * 1000) : NaN
                const deadlineMs = Number.isFinite(firstPickMs) ? (firstPickMs + HYPO_ESTIMATE_STOP_AFTER_MS) : NaN
                const reachedDeadline = Number.isFinite(deadlineMs) && nowMs >= deadlineMs
                const shouldStopNow = !hypoStopChecked && reachedDeadline && picks.length >= HYPO_ESTIMATE_MIN_POINTS
                if (!hypoStopChecked && reachedDeadline) hypoStopChecked = true

                const maxPoints = _getHypoEstimateMaxPoints()
                const used = picks.slice(0, Math.min(picks.length, maxPoints))

                let solved = false
                if(used.length >= 4){
                    const seed = used.slice(0, 3)
                    const initialLat = seed.reduce((s, o) => s + o.lat, 0) / seed.length
                    const initialLon = seed.reduce((s, o) => s + o.lon, 0) / seed.length
                    const hypo0 = L.latLng(initialLat, initialLon)
                    const observations = used.map(o=>{
                        const distKm = hypo0.distanceTo(o.ll) / 1000
                        const distW = 1 / Math.pow(1 + distKm / 200, 2)
                        const levelW = 1 + Math.max(0, o.level) / 10
                        return {
                            lat: o.lat,
                            lon: o.lon,
                            ll: o.ll,
                            tObsSec: o.tObsSec,
                            weight: distW * levelW,
                            elevM: Number.isFinite(o?.elevM) ? o.elevM : 0
                        }
                    })

                    const est = locateHypocenterGeigerRobust({
                        travelTime: _getTravelTime(),
                        observations,
                        initial: {
                            lat: initialLat,
                            lon: initialLon,
                            depthKm: 10,
                            originSec: used[0].tObsSec - 2.0
                        },
                        maxIter: 8,
                        useStationElevation: false
                    })
                    if(est){
                        const minObsSec = observations.reduce(
                            (acc, o) => (Number.isFinite(o?.tObsSec) ? Math.min(acc, o.tObsSec) : acc),
                            Infinity
                        )
                        const clampUpper = Number.isFinite(minObsSec) ? (minObsSec - 0.01) : Infinity
                        const originSec0 = Number.isFinite(est.originSec) ? Math.min(est.originSec, clampUpper) : clampUpper

                        // 着未着法: 未到着(未検知)局の不等式ペナルティで軽量リファイン
                        // 非検知局は「使用点の近傍候補(隣接局)」のみ採用し、計算量を抑える
                        const arrivedIds = new Set(used.map((p) => p.id))
                        const candidateNonArrivalIds = new Set()
                        for (const p of used) {
                            const nbs = adjStationIds?.[p.id] || []
                            for (const nid of nbs) {
                                if (arrivedIds.has(nid)) continue
                                if (firstDetectMsByStationId.has(nid)) continue
                                candidateNonArrivalIds.add(nid)
                            }
                        }
                        const nonArrivals = []
                        // 近い局ほど制約力が強くなるよう距離重みを付ける
                        const hypoSeed = L.latLng(est.lat, est.lon)
                        for (const nid of candidateNonArrivalIds) {
                            const st = stations[nid]
                            if (!st?.latLng) continue
                            const ll = L.latLng(st.latLng)
                            const distKm = hypoSeed.distanceTo(ll) / 1000
                            const distW = 1 / Math.pow(1 + distKm / 200, 2)
                            nonArrivals.push({ ll, weight: distW })
                            if (nonArrivals.length >= 48) break
                        }
                        const refined = refineHypocenterArrivalNonArrival({
                            travelTime: _getTravelTime(),
                            hypo: {
                                lat: est.lat,
                                lon: est.lon,
                                depthKm: est.depthKm,
                                originSec: originSec0,
                            },
                            arrivals: observations,
                            nonArrivals,
                            nowSec: nowMs / 1000,
                            options: {
                                lambda: 0.25,
                                searchKm: 10,
                                depthKm: 6,
                                timeSec: 0.6,
                                useStationElevation: false,
                                acceptImprovementRatio: 0.985,
                            }
                        })

                        const originSec = Number.isFinite(refined?.originSec)
                            ? Math.min(refined.originSec, clampUpper)
                            : originSec0

                        lastHypo = {
                            lat: Number.isFinite(refined?.lat) ? refined.lat : est.lat,
                            lon: Number.isFinite(refined?.lon) ? refined.lon : est.lon,
                            depthKm: Number.isFinite(refined?.depthKm) ? refined.depthKm : est.depthKm,
                            originMs: originSec * 1000,
                            rmsSec: est.rmsSec,
                            converged: est.converged
                        }
                        lastHypoEstimateAtMs = nowMs
                        solved = true
                        _resolveEpicenterName(lastHypo)
                    }
                }

                if(!solved && used.length >= 1 && !lastHypo){
                    const first = used[0]
                    lastHypo = {
                        lat: first.lat,
                        lon: first.lon,
                        depthKm: 10,
                        originMs: (first.tObsSec - 2.0) * 1000,
                        rmsSec: Infinity,
                        converged: false
                    }
                    lastHypoEstimateAtMs = nowMs
                    _resolveEpicenterName(lastHypo)
                }

                if(shouldStopNow && lastHypo) {
                    hypoEstimateFinished = true
                }
            }
            if(lastHypo) _updateHypoLayers(lastHypo, nowMs)

            if(niedDetectObsCount) niedDetectObsCount.value = firstDetectMsByStationId.size
            if(lastHypo){
                if(niedDetectActive) niedDetectActive.value = true
                if(niedDetectOriginTime) niedDetectOriginTime.value = stampToTime(lastHypo.originMs, 9)
                if(niedDetectDepthKm) niedDetectDepthKm.value = lastHypo.depthKm
            }
        }
    }
}
const chainActivate = (station, activeStations, checkedStations)=>{
    const pendingStations = new Set([station])
    while(pendingStations.size > 0){
        const currentStation = pendingStations.values().next().value
        pendingStations.delete(currentStation)
        checkedStations.add(currentStation)
        if(currentStation.activity > 0){
            activeStations.add(currentStation)
            adjStationIds[currentStation.id].forEach(id=>{
                const neighbor = stations[id]
                if(!checkedStations.has(neighbor)) pendingStations.add(neighbor)
            })
        }
    }
}
const renderAll = ()=>{
    stations.forEach(station=>{
        station.render()
    })
}
let fetchStationInterval, requestInterval, delayInterval
const fetchStationList = async () => {
    try {
        const res = await getData(`${yahooBase.value}/SiteList/sitelist.json?time=${Date.now()}`)
        const data = res?.data
        if(data && data.siteConfigId) {
            clearInterval(fetchStationInterval)
            stationList = data.items
            siteConfigId.value = data.siteConfigId
            if(stationList.length > 0){
                let latLngs = []
                for(let i = 0; i < stationList.length; i++){
                    latLngs[i] = L.latLng(stationList[i])
                }
                for(let i = 0; i < stationList.length; i++){
                    const distances = []
                    let candidate = {
                        id: null,
                        distance: 40
                    }
                    distMatrix[i] = []
                    for(let j = 0; j < stationList.length; j++){
                        let distance
                        if(j < i) distance = distMatrix[j][i]
                        else if(j == i) distance = 0
                        else distance = latLngs[i].distanceTo(latLngs[j]) / 1000
                        distMatrix[i][j] = distance
                        if(distance <= 30) distances.push({ id: j, distance })
                        else if(distance <= candidate.distance) candidate = { id: j, distance }
                    }
                    if(distances.length <= 1 && candidate.id !== null) {
                        distances.push(candidate)
                    }
                    distances.sort((a, b) => a.distance - b.distance).splice(nearbyLength)
                    adjStationIds[i] = distances.map(obj => obj.id)
                    const maxDist = distances[distances.length - 1].distance
                    expireSeconds[i] = Math.max(Math.round(maxDist / 3.5), 5)
                }
                stationList.forEach((latLng, index)=>{
                    const station = reactive(new NiedStation(map, index, latLng, 'c', expireSeconds[index]))
                    stations.push(station)
                })
                if(niedMarkerCount) niedMarkerCount.value = stations.length
            }
        }
    } catch (err) {
        console.log(err);
    }
}
onMounted(()=>{
    fetchStationInterval = setInterval(fetchStationList, 5000);
    fetchStationList()
    requestInterval = setInterval(async () => {
        try {
            const time = getTimeNumberString(9, -delay.value)
            const date = time.slice(0, 8)
            const res = await getData(`${yahooBase.value}/RealTimeData/${date}/${time}.json`)
            if(res?.status == 200) {
                const data = res.data
                if(data.realTimeData.siteConfigId == siteConfigId.value) {
                    stationData.value = data.realTimeData.intensity.split('')
                    const timeDiff = calcTimeDiff(data.realTimeData.dataTime.slice(0, -6), 9, niedUpdateTime.value, 9)
                    if(timeDiff > 1000) {
                        const popNum = Math.min(Math.round(timeDiff / 1000) - 1, 60)
                        const noDataArr = Array(popNum).fill(-1)
                        stations.forEach(station => {
                            station.recentLevel.unshift(...noDataArr)
                            station.recentLevel.splice(station.maxExpireSeconds)
                            station.expireSeconds = Math.max(station.expireSeconds - popNum, station.defaultExpireSeconds)
                        })
                    }
                    if(timeDiff > 10000) {
                        stations.forEach(station => {
                            station.isActive = false
                        })
                    }
                    if(delay.value > maxDelay && timeDiff < 0) {
                        stations.forEach(station => {
                            station.level = -1
                            station.recentLevel = []
                            station.expireSeconds = station.defaultExpireSeconds
                            station.isActive = false
                        })
                    }
                    if(delay.value > maxDelay && timeDiff < 0 || timeDiff > 0) {
                        niedUpdateTime.value = data.realTimeData.dataTime.slice(0, -6).replace('T', ' ')
                        const frameMs = Date.parse(data.realTimeData.dataTime)
                        update(Number.isFinite(frameMs) ? frameMs : Date.now())
                    }
                }
                else if(siteConfigId.value){
                    ElMessage({
                        message: '站点数据已更新，正在重新加载…',
                        type: 'warning',
                    })
                    settingsStore.mainSettings.displaySeisNet.niedNet = false
                    settingsStore.mainSettings.displaySeisNet.delay = 0
                    setTimeout(() => {
                        settingsStore.mainSettings.displaySeisNet.niedNet = true
                    }, 1500);
                }
            }
        } catch (err) {
            console.log(err);
        }
    }, 500);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && pendingRender) {
            pendingRender = false
            renderAll()
        }
    })
})
let unwatchGrids, unwatchRender
watch(()=>statusStore.map, newVal=>{
    if(newVal !== null){
        map = newVal
        map.on('zoomend', renderAll)
        _startNiedForecastDrawLoop()
        unwatchGrids = watch(grids, (newVal)=>{
            let maxLevel = -1, maxColor = 'gray'
            for(let key in newVal) {
                const item = newVal[key]
                const color = item.level <= 7 ? 'green' : item.level <= 13 ? 'yellow' : 'red'
                if(item.level > maxLevel) {
                    maxLevel = item.level
                    maxColor = color
                }
                if(!(key in gridRects)) {
                    const layer = L.rectangle([item.latLng.map(l => l - 0.495), item.latLng.map(l => l + 0.495)], {
                        color,
                        weight: 2,
                        fill: false,
                        pane: 'niedGridPane',
                        interactive: false
                    }).addTo(map)
                    gridRects[key] = {
                        color,
                        layer
                    }
                }
                else if(gridRects[key].color != color) {
                    gridRects[key].color = color
                    gridRects[key].layer.setStyle({
                        color
                    })
                }
                if(item.level > periodMaxLevel) periodMaxLevel = item.level
            }
            for(let key in gridRects) {
                if(!(key in newVal)) {
                    if(map.hasLayer(gridRects[key].layer)) map.removeLayer(gridRects[key].layer)
                    delete gridRects[key]
                }
            }
            niedPeriodMaxShindo.value = getShindoFromLevel(periodMaxLevel)
            niedPeriodBarClass.value = maxColor
            const nextActive = Object.keys(newVal).length > 0
            if(!nextActive) _resetNiedHypo()
            statusStore.isActive.niedNet = nextActive
        }, { immediate: true })
        unwatchRender = watch(
            ()=>`${settingsStore.mainSettings.displaySeisNet.style}
            |${settingsStore.mainSettings.displaySeisNet.displayNiedShindo}
            |${settingsStore.mainSettings.displaySeisNet.hideNoData}
            |${simpleIcon.value}
            |${settingsStore.mainSettings.displaySeisNet.displayShindo0}`, 
            renderAll
        )
    }
}, { immediate: true })
watch(()=>(statusStore.isActive.jmaEew || statusStore.isActive.niedNet), newVal=>{
    if(newVal){
        if(periodMaxLevel == -1){
            periodMaxLevel = 0
            niedPeriodMaxShindo.value = getShindoFromLevel(periodMaxLevel)
        }
    }
    else{
        periodMaxLevel = -1
        niedPeriodMaxShindo.value = getShindoFromLevel(periodMaxLevel)
    }
}, { immediate: true })
watch(() => Object.keys(grids.value).length, smartSetView)
let shake1Notified = false, shake2Notified = false
let focused = false
watch(currentMaxShindo, (newVal, oldVal)=>{
    if(newVal > oldVal){
        if(settingsStore.mainSettings.onShake.sound){
            const type = `shindo${newVal}`
            playSound(type)
        }
        if(settingsStore.mainSettings.onShake.notification){
            if(newVal >= 1 && newVal <= 3 && !shake1Notified){
                sendMyNotification('揺れを検出', 
                    '揺れに注意してください。', 
                    iconUrls.caution, 
                    settingsStore.mainSettings.muteNotification)
                shake1Notified = true
            }
            else if(newVal >= 4 && !shake2Notified){
                sendMyNotification('強い揺れを検出', 
                    '強い揺れに警戒してください。', 
                    iconUrls.warn, 
                    settingsStore.mainSettings.muteNotification)
                shake1Notified = true
                shake2Notified = true
            }
        }
        if(settingsStore.mainSettings.onShake.focus){
            if(newVal >= 1 && !focused){
                focusWindow()
                focused = true
            }
        }
        handleTempEqlists(0)
    }
    else{
        shake1Notified = false
        shake2Notified = false
        focused = false
    }
})
watch(()=>settingsStore.mainSettings.displaySeisNet.delay, newVal=>{
    // リプレイ時刻を変えたら、揺れ検知/期間最大用の蓄積をリセット
    periodMaxLevel = -1
    niedPeriodMaxShindo.value = getShindoFromLevel(periodMaxLevel)
    niedPeriodBarClass.value = 'gray'
    statusStore.isActive.niedNet = false
    shake1Notified = false
    shake2Notified = false
    focused = false
    stations.forEach((station)=>{
        if(!station) return
        station.isActive = false
        station.recentLevel = []
        station.expireSeconds = station.defaultExpireSeconds
        station.update('c', true)
    })
    _resetNiedHypo(true)

    clearInterval(delayInterval)
    if(newVal > maxDelay / 60000){
        delay.value = newVal * 60000
    }
    else{
        delay.value = defaultDelay
        delayInterval = setInterval(() => {
            if(delay.value <= maxDelay * 2/3) delay.value -= 20
            else delay.value -= 100
        }, 10000);
    }
}, { immediate: true })
onBeforeUnmount(()=>{
    _resetNiedHypo(true)
    _stopNiedForecastDrawLoop()
    if(niedMarkerCount) niedMarkerCount.value = 0
    clearInterval(fetchStationInterval)
    clearInterval(requestInterval)
    clearInterval(delayInterval)
    if(map !== null) map.off('zoomend', renderAll)
    if(unwatchGrids) unwatchGrids()
    if(unwatchRender) unwatchRender()
    stations.forEach((station, index)=>{
        station.terminate()
        stations[index] = null
    })
    stations.length = 0
    map.eachLayer(layer=>{
        if(layer.options.pane == 'niedGridPane' || layer.options.pane.includes('niedStationPane')){
            map.removeLayer(layer)
        }
    })
})
</script>

<style lang="scss" scoped>

</style>