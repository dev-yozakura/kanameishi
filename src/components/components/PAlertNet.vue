<template>
    <div />
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, inject } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import Http from '@/classes/Http'
import { computeNiedStyleColorRadius, getShindoLeafletIcon } from '@/classes/StationClasses'
import { useStatusStore } from '@/stores/status'
import { useSettingsStore } from '@/stores/settings'
import { useTimeStore } from '@/stores/time'
import { calcWaveDistance, focusWindow, getLevelFromInstShindo, getShindoFromLevel, playSound, sendMyNotification, stampToTime } from '@/utils/Utils'
import { iconUrls } from '@/utils/Urls'
import { isTauri as getIsTauri } from '@tauri-apps/api/core'
import { getTjma2001TravelTime } from '@/utils/Tjma2001'
import { locateHypocenterGeiger } from '@/utils/HypocenterGeiger'
import { getNearestEpiName } from '@/utils/EpiName'
import eewCross from '@/assets/icon/hypocenter/eewCross.svg'

const statusStore = useStatusStore()
const settingsStore = useSettingsStore()
const timeStore = useTimeStore()

const isTauri = getIsTauri()
const edgeProxyBase = (import.meta.env.VITE_EDGE_PROXY_BASE || '').replace(/\/+$/, '')
const graphqlUrl = isTauri
    ? 'https://palert.earth.sinica.edu.tw/graphql/'
    : (import.meta.env.DEV
        ? '/palert/graphql/'
        : (edgeProxyBase
            ? `${edgeProxyBase}/palert/graphql/`
            : 'https://palert.earth.sinica.edu.tw/graphql/'))

const P_ALERT_HEADERS = {
    Origin: 'https://palert.earth.sinica.edu.tw',
    Referer: 'https://palert.earth.sinica.edu.tw/realtime'
}

const STATION_LIST_QUERY = `query ($staFilter: staList_filter_choices) {
  stationList(staFilter: $staFilter) {
    staInfos
    timestamp
    version
  }
}`

const REALTIME_PGA_QUERY = `query ($recordTime: Float!, $type: Int!) {
  realtimePGA(recordTime: $recordTime, type: $type) {
    dataVals
    timestamp
  }
}`

const delayMs = computed(() => settingsStore.mainSettings.displaySeisNet.delay * 60000)

// ユーザー要望: 配色を震度基準へ戻す
watch(
    () => settingsStore.mainSettings.displaySeisNet.palertNet,
    (enabled) => {
        if (enabled) settingsStore.mainSettings.displaySeisNet.palertColorBy = 'shindo'
    },
    { immediate: true }
)

const palertUpdateTime = inject('palertUpdateTime', ref('1970-01-01 08:00:00'))
const palertMaxShindo = inject('palertMaxShindo', ref('?'))
const palertMaxPgaGal = inject('palertMaxPgaGal', ref('?'))
const palertPeriodMaxShindo = inject('palertPeriodMaxShindo', ref('?'))
const palertPeriodBarClass = inject('palertPeriodBarClass', ref('gray'))
const palertMarkerCount = inject('palertMarkerCount', ref(0))
const palertDetectActive = inject('palertDetectActive', ref(false))
const palertDetectOriginTime = inject('palertDetectOriginTime', ref(''))
const palertDetectDepthKm = inject('palertDetectDepthKm', ref(NaN))
const palertDetectObsCount = inject('palertDetectObsCount', ref(0))
const palertDetectEpicenterName = inject('palertDetectEpicenterName', ref(''))
const handleTempEqlists = inject('handleTempEqlists', null)
const smartSetView = inject('smartSetView', null)

const stationIndex = new Map() // stationCode -> [lat, lon]
const stationIds = []
const stationIdToIndex = new Map() // stationCode -> index in stationIds
const adjStationIds = {}
const expireSeconds = {}
const distMatrix = []

// Shake grid (NIED互換: 0.99°四方の矩形)
const gridRects = new Map() // key -> { color, layer }
let gridDecimal = [0, 0]
let gridDecimalInitialized = false

// Station state (no marker by default)
const stations = reactive({}) // stationCode -> state
const markers = new Map() // stationCode -> { level, marker }

let map = null
let palertRenderer = null
let requestInterval = null
let stationListInterval = null
let pendingRender = false

// 揺れ検知由来の予報円はEEWと別色にする
const shakePColor = 'var(--swave-blue)'
const shakeSColor = 'var(--swave-green)'

const hypoIconRadius = 20
const palertHypoIcon = L.icon({
    iconUrl: eewCross,
    iconSize: [hypoIconRadius * 2, hypoIconRadius * 2],
    iconAnchor: [hypoIconRadius, hypoIconRadius]
})

// stationId -> { tMs: number, level: number }
const firstDetectMsByStationId = new Map() // stationId -> first detect frame ts (ms)
const OBS_KEEP_GAP_MS = 10 * 1000
let lastDetectActiveAtMs = 0
let palertHypoMarker = null
let palertPWave = null
let palertSWave = null
let palertSWaveFill = null
let lastHypo = null // { lat, lon, depthKm, originMs, rmsSec, converged }
let lastHypoEstimateAtMs = 0
let _tjma2001 = null

let gridBlinkTimer = null
let gridBlinkOn = true

const _applyGridBlinkStyle = () => {
    if (!map) return
    const opacity = gridBlinkOn ? 1 : 0.15
    for (const obj of gridRects.values()) {
        try {
            obj?.layer?.setStyle({ opacity })
        } catch {}
    }
}

const _stopGridBlinking = () => {
    if (gridBlinkTimer) clearInterval(gridBlinkTimer)
    gridBlinkTimer = null
    gridBlinkOn = true
    // restore
    for (const obj of gridRects.values()) {
        try {
            obj?.layer?.setStyle({ opacity: 1 })
        } catch {}
    }
}

const _startGridBlinking = () => {
    if (gridBlinkTimer) return
    gridBlinkOn = true
    _applyGridBlinkStyle()
    gridBlinkTimer = setInterval(() => {
        gridBlinkOn = !gridBlinkOn
        _applyGridBlinkStyle()
    }, 450)
}

const _getTravelTime = () => {
    if (_tjma2001) return _tjma2001
    _tjma2001 = getTjma2001TravelTime()
    return _tjma2001
}

const _clearPalertHypoLayers = () => {
    if (!map) return
    if (palertHypoMarker && map.hasLayer(palertHypoMarker)) map.removeLayer(palertHypoMarker)
    if (palertPWave && map.hasLayer(palertPWave)) map.removeLayer(palertPWave)
    if (palertSWave && map.hasLayer(palertSWave)) map.removeLayer(palertSWave)
    if (palertSWaveFill && map.hasLayer(palertSWaveFill)) map.removeLayer(palertSWaveFill)
    palertHypoMarker = null
    palertPWave = null
    palertSWave = null
    palertSWaveFill = null
}

const _resetPalertHypo = (hard = false) => {
    if (hard) firstDetectMsByStationId.clear()
    lastHypo = null
    lastHypoEstimateAtMs = 0
    _clearPalertHypoLayers()

    palertDetectActive.value = false
    palertDetectOriginTime.value = ''
    palertDetectDepthKm.value = NaN
    palertDetectObsCount.value = 0
    palertDetectEpicenterName.value = ''
}

const _updateHypoLayers = (hypo, frameMs) => {
    if (!map || !hypo) return

    const travelTime = _getTravelTime()
    const latLng = [hypo.lat, hypo.lon]
    const passedSec = Math.max(0, (frameMs - hypo.originMs) / 1000)

    const pInfo = calcWaveDistance(travelTime, true, hypo.depthKm, passedSec)
    const sInfo = calcWaveDistance(travelTime, false, hypo.depthKm, passedSec)
    const pRadiusKm = pInfo?.radius || 0
    const sRadiusKm = sInfo?.radius || 0

    if (!palertHypoMarker) {
        palertHypoMarker = L.marker(latLng, { icon: palertHypoIcon, pane: 'eewMarkerPane' }).addTo(map)
    } else {
        palertHypoMarker.setLatLng(latLng)
    }

    const originStr = Number.isFinite(hypo.originMs) ? stampToTime(hypo.originMs, 8) : ''
    try {
        palertHypoMarker.bindTooltip(
            `<strong>P-Alert(推定)</strong><br>Depth ${Math.round(hypo.depthKm)}km<br>Origin ${originStr}`,
            { permanent: false, direction: 'top', className: 'custom-tooltip' }
        )
    } catch {}

    if (pRadiusKm > 0) {
        if (!palertPWave) {
            palertPWave = L.circle(latLng, {
                color: shakePColor,
                opacity: 1,
                weight: 2,
                fill: false,
                radius: pRadiusKm * 1000,
                pane: 'wavePane',
                interactive: false,
            }).addTo(map)
        } else {
            palertPWave.setLatLng(latLng)
            palertPWave.setRadius(pRadiusKm * 1000)
        }
    } else if (palertPWave && map.hasLayer(palertPWave)) {
        map.removeLayer(palertPWave)
        palertPWave = null
    }

    if (sRadiusKm > 0) {
        if (!palertSWave) {
            palertSWave = L.circle(latLng, {
                color: shakeSColor,
                opacity: 1,
                weight: 2,
                fill: false,
                radius: sRadiusKm * 1000,
                pane: 'wavePane',
                interactive: false,
            }).addTo(map)
        } else {
            palertSWave.setLatLng(latLng)
            palertSWave.setRadius(sRadiusKm * 1000)
        }

        if (!palertSWaveFill) {
            palertSWaveFill = L.circle(latLng, {
                fillColor: shakeSColor,
                fillOpacity: 0.2,
                stroke: false,
                radius: sRadiusKm * 1000,
                pane: 'waveFillPane',
                interactive: false,
            }).addTo(map)
        } else {
            palertSWaveFill.setLatLng(latLng)
            palertSWaveFill.setRadius(sRadiusKm * 1000)
        }
    } else {
        if (palertSWave && map.hasLayer(palertSWave)) map.removeLayer(palertSWave)
        if (palertSWaveFill && map.hasLayer(palertSWaveFill)) map.removeLayer(palertSWaveFill)
        palertSWave = null
        palertSWaveFill = null
    }
}

const shouldShowShindoTooltip = (level, zoom) => {
    const enabled = !!(
        settingsStore.mainSettings.displaySeisNet.displayTremShindo ||
        settingsStore.mainSettings.displaySeisNet.displayNiedShindo
    )
    if (!enabled) return false
    if (zoom < 7) return false
    const minLevel = settingsStore.mainSettings.displaySeisNet.displayShindo0 ? 6 : 8
    return level >= minLevel
}

const syncMarkerTooltip = (markerObj, zoom) => {
    if (!markerObj?.marker) return
    if (markerObj.markerType === 'icon') {
        if (markerObj.tooltipBound) {
            try {
                markerObj.marker.unbindTooltip()
            } catch {}
            markerObj.tooltipBound = false
        }
        return
    }
    const want = shouldShowShindoTooltip(markerObj.level, zoom)
    if (want) {
        if (!markerObj.tooltipBound) {
            try {
                markerObj.marker.bindTooltip(getShindoFromLevel(markerObj.level), {
                    permanent: true,
                    direction: 'center',
                    className: 'palert-shindo-tooltip',
                    opacity: 1,
                })
                markerObj.tooltipBound = true
            } catch {}
        } else {
            try {
                markerObj.marker.setTooltipContent(getShindoFromLevel(markerObj.level))
            } catch {}
        }
    } else if (markerObj.tooltipBound) {
        try {
            markerObj.marker.unbindTooltip()
        } catch {}
        markerObj.tooltipBound = false
    }
}

const shouldUseShindoIconMarker = (level, zoom) => {
    const enabled = !!(
        settingsStore.mainSettings.displaySeisNet.displayTremShindo ||
        settingsStore.mainSettings.displaySeisNet.displayNiedShindo
    )
    if (!enabled) return false
    if (zoom < 4) return false
    const minLevel = settingsStore.mainSettings.displaySeisNet.displayShindo0 ? 6 : 8
    return level >= minLevel
}

const clearStations = () => {
    for (const [id, obj] of markers.entries()) {
        try {
            if (map && obj?.marker && map.hasLayer(obj.marker)) map.removeLayer(obj.marker)
        } catch {}
    }
    markers.clear()

    for (const obj of gridRects.values()) {
        try {
            if (map && obj?.layer && map.hasLayer(obj.layer)) map.removeLayer(obj.layer)
        } catch {}
    }
    gridRects.clear()

    for (const id of Object.keys(stations)) delete stations[id]
    stationIndex.clear()
    stationIds.length = 0
    stationIdToIndex.clear()
    for (const k of Object.keys(adjStationIds)) delete adjStationIds[k]
    distMatrix.length = 0
    for (const k of Object.keys(expireSeconds)) delete expireSeconds[k]
    palertMarkerCount.value = 0
    palertMaxShindo.value = '?'
    palertMaxPgaGal.value = '?'
    periodMaxLevel = -1
    palertPeriodMaxShindo.value = '?'
    palertPeriodBarClass.value = 'gray'
    statusStore.isActive.palertNet = false
}

const normalizePgaToGal = (pga) => {
    let v = Number(pga)
    if (!Number.isFinite(v) || v <= 0) return 0
    // P-AlertのPGAがmGalスケールで返る場合があるため、明らかに大きい値は1/1000してGal扱い
    // (例) 50000 mGal -> 50 Gal
    if (v >= 5000) v = v / 1000
    return v
}

const pgaLogColorStops = [
    { x: 0, rgb: [0, 0, 255] },
    { x: 1, rgb: [0, 255, 255] },
    { x: 2, rgb: [0, 255, 0] },
    { x: 3, rgb: [255, 255, 0] },
    { x: 4, rgb: [255, 0, 0] },
]

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const lerp = (a, b, t) => a + (b - a) * t
const rgbToHex = (rgb) => {
    const to2 = (n) => Math.round(n).toString(16).padStart(2, '0')
    return `#${to2(rgb[0])}${to2(rgb[1])}${to2(rgb[2])}`
}

const pgaGalToColor = (pgaGal) => {
    const v = Number(pgaGal)
    if (!Number.isFinite(v) || v <= 0) {
        return settingsStore.mainSettings.displaySeisNet.hideNoData ? '#cfcfcf00' : '#cfcfcf'
    }
    const lx = Math.log10(v)
    const x = Math.min(4, Math.max(0, lx))

    let i = 0
    while (i + 1 < pgaLogColorStops.length && x > pgaLogColorStops[i + 1].x) i++
    const a = pgaLogColorStops[i]
    const b = pgaLogColorStops[Math.min(i + 1, pgaLogColorStops.length - 1)]
    const t = (b.x === a.x) ? 0 : clamp01((x - a.x) / (b.x - a.x))
    return rgbToHex([
        lerp(a.rgb[0], b.rgb[0], t),
        lerp(a.rgb[1], b.rgb[1], t),
        lerp(a.rgb[2], b.rgb[2], t),
    ])
}

const calcRecentPgaRms = (pgaGalSeries) => {
    const N = 3
    const recent = Array.isArray(pgaGalSeries) ? pgaGalSeries.slice(0, N) : []
    // 0(揺れなし/微小)も窓に含めて平均し、単発スパイクの過大評価を抑える
    // (※ 不正値/負値だけ除外)
    const vals = recent
        .map((x) => Number(x))
        .filter((x) => Number.isFinite(x) && x >= 0)

    if (vals.length === 0) return 0

    // サンプルが少ない時も平滑が効くように0でパディング
    while (vals.length < N) vals.push(0)

    const meanSq = vals.reduce((s, x) => s + x * x, 0) / N
    const rms = Math.sqrt(meanSq)
    return Number.isFinite(rms) ? rms : 0
}

// 台湾(2020年以前の旧制度)の近似: I = 2*log10(PGA[gal]) + 0.70 を四捨五入して震度階級(0..7)
// 1秒統計値しか無いので、直近数秒のRMSでスパイクを抑えてから換算する。
const pgaSeriesToTaiwanIntensityClass = (pgaGalSeries) => {
    const pgaEff = calcRecentPgaRms(pgaGalSeries)
    if (!Number.isFinite(pgaEff) || pgaEff <= 0) return -1

    const iFloat = 2.0 * Math.log10(pgaEff) + 0.70
    const iClass = Math.round(iFloat)
    return Math.max(0, Math.min(7, iClass))
}

// 内部描画は既存の0..20 level系(色/半径/揺れ検知が依存)なので、台湾の0..7を近いlevelに写像する
const taiwanClassToLevel = (iClass) => {
    switch (iClass) {
        case 0: return 0
        case 1: return 8
        case 2: return 10
        case 3: return 12
        case 4: return 14
        case 5: return 16
        case 6: return 18
        case 7: return 20
        default: return -1
    }
}

const pad2 = (n) => String(n).padStart(2, '0')
const formatIsoToTime = (iso, tzHours) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return String(iso)
    const ms = d.getTime() + tzHours * 3600 * 1000
    const t = new Date(ms)
    return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())} ${pad2(t.getUTCHours())}:${pad2(t.getUTCMinutes())}:${pad2(t.getUTCSeconds())}`
}

const postGraphql = async (query, variables) => {
    const body = { query, variables: variables ?? {} }
    const res = isTauri
        ? await Http.tauriPost(graphqlUrl, body, {
            connectTimeout: 10000,
            headers: P_ALERT_HEADERS
        })
        : await Http.post(graphqlUrl, body, { timeout: 10000 })

    if (!res) return null
    if (res.errors?.length) {
        console.log('P-Alert GraphQL errors:', res.errors)
        return null
    }
    return res
}

const quantizeByStep = (v, step) => {
    const x = Number(v)
    const s = Number(step)
    if (!Number.isFinite(x) || !Number.isFinite(s) || s <= 0) return x
    return Math.round(x / s) * s
}

const computeDecimalFromLatLng = (latLng) => {
    const vals = Array.isArray(latLng) ? latLng : null
    if (!vals || vals.length < 2) return null
    return vals.map((val) => Math.round((((val + 180) % 1) * 10)) / 10)
}

const snapToNiedGrid = (latLng) => {
    const vals = Array.isArray(latLng) ? latLng : null
    if (!vals || vals.length < 2) return null
    return vals.map((l, index) => Math.round(l - gridDecimal[index]) + gridDecimal[index])
}

const fetchStationList = async () => {
    const res = await postGraphql(STATION_LIST_QUERY, {})
    const infos = res?.data?.stationList?.staInfos
    if (!Array.isArray(infos) || infos.length === 0) return

    // 構造を確実に更新する（間引きON/OFF切替やstationList更新に対応）
    stationIndex.clear()
    stationIds.length = 0
    stationIdToIndex.clear()
    for (const k of Object.keys(adjStationIds)) delete adjStationIds[k]
    for (const k of Object.keys(expireSeconds)) delete expireSeconds[k]
    distMatrix.length = 0

    const qStep = Number(settingsStore.mainSettings.displaySeisNet.palertQuantizeDeg)
    const quantizeEnabled = Number.isFinite(qStep) && qStep > 0

    if (quantizeEnabled) {
        // 緯度経度を指定刻みに丸めて代表点1つ
        const reps = new Map() // key -> { station, lat, lon, dist2 }
        for (const info of infos) {
            const station = info?.station
            const lat = info?.lat
            const lon = info?.lon
            if (!station || typeof lat !== 'number' || typeof lon !== 'number') continue

            const qLat = quantizeByStep(lat, qStep)
            const qLon = quantizeByStep(lon, qStep)
            const key = `${qLat.toFixed(2)},${qLon.toFixed(2)}`
            const dist2 = (lat - qLat) ** 2 + (lon - qLon) ** 2
            const prev = reps.get(key)
            if (!prev || dist2 < prev.dist2) reps.set(key, { station, lat, lon, dist2 })
        }

        const next = Array.from(reps.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([, rep]) => rep)

        for (const rep of next) {
            stationIndex.set(rep.station, [rep.lat, rep.lon])
            stationIds.push(rep.station)
        }
    } else {
        // 間引き無効: 全観測点を利用
        const next = []
        for (const info of infos) {
            const station = info?.station
            const lat = info?.lat
            const lon = info?.lon
            if (!station || typeof lat !== 'number' || typeof lon !== 'number') continue
            next.push({ station, lat, lon })
        }
        next.sort((a, b) => String(a.station).localeCompare(String(b.station)))
        for (const rep of next) {
            stationIndex.set(rep.station, [rep.lat, rep.lon])
            stationIds.push(rep.station)
        }
    }

    // Remove markers/states no longer used
    const nextIdSet = new Set(stationIds)
    for (const id of Array.from(markers.keys())) {
        if (!nextIdSet.has(id)) removeMarker(id)
    }
    for (const id of Object.keys(stations)) {
        if (!nextIdSet.has(id)) delete stations[id]
    }

    for (let i = 0; i < stationIds.length; i++) {
        stationIdToIndex.set(stationIds[i], i)
    }

    // Precompute adjacency (NIED互換の揺れ検知用)
    // 700点程度なので、1時間に1回のO(N^2)は許容
    const latLngs = stationIds.map((id) => {
        const ll = stationIndex.get(id)
        return ll ? L.latLng(ll[0], ll[1]) : null
    })
    const nearbyLength = 6
    for (let i = 0; i < stationIds.length; i++) {
        const distances = []
        let candidate = { id: null, distance: 40 }
        distMatrix[i] = []
        const a = latLngs[i]
        if (!a) continue
        for (let j = 0; j < stationIds.length; j++) {
            let distance
            if (j < i) distance = distMatrix[j]?.[i] ?? 0
            else if (j === i) distance = 0
            else {
                const b = latLngs[j]
                distance = b ? a.distanceTo(b) / 1000 : 99999
            }
            distMatrix[i][j] = distance
            if (distance <= 30) distances.push({ id: j, distance })
            else if (distance <= candidate.distance) candidate = { id: j, distance }
        }
        if (distances.length <= 1 && candidate.id !== null) distances.push(candidate)
        distances.sort((x, y) => x.distance - y.distance)
        distances.splice(nearbyLength)
        const id = stationIds[i]
        adjStationIds[id] = distances.map((obj) => stationIds[obj.id])
        const maxDist = distances.length ? distances[distances.length - 1].distance : 0
        expireSeconds[id] = Math.max(Math.round(maxDist / 3.5), 5)
    }

    // Ensure station state objects exist
    for (const id of stationIds) {
        if (!stations[id]) {
            stations[id] = reactive({
                id,
                latLng: stationIndex.get(id),
                defaultExpireSeconds: expireSeconds[id] ?? 10,
                expireSeconds: expireSeconds[id] ?? 10,
                maxExpireSeconds: 30,
                level: -1,
                ascend: 0,
                recentLevel: [],
                recentPga: [],
                pgaEff: 0,
                activity: 0,
                isActive: false,
                activeUntil: 0,
                levelHoldUntil: 0,
            })
        }
    }
}

const renderAll = () => {
    // Update marker style for currently displayed markers only
    const zoom = map?.getZoom?.() ?? 4
    for (const [id, obj] of markers.entries()) {
        const state = stations[id]
        if (!state) continue
        // SVGアイコン/円マーカーの切替もここで同期
        ensureMarker(id, obj.level, true)
        syncMarkerTooltip(obj, zoom)
    }
}

const calcActivity = (level, ascend, isActive) => {
    let levelActivity
    if (ascend > 0 || isActive) {
        if (level <= 5) levelActivity = 0
        else if (level <= 7) levelActivity = (isActive ? 0.5 : 0.25) * (level - 5)
        else if (level <= 11) levelActivity = 2 * (level - 7)
        else levelActivity = 6 * (level - 10)
    } else {
        levelActivity = 0
    }

    let ascendActivity
    if (ascend <= 0) ascendActivity = 0
    else if (ascend <= 1) ascendActivity = isActive ? 0.5 : 0.25
    else if (ascend <= 6) ascendActivity = 2 * (ascend - 2) + 1
    else ascendActivity = 6 * (ascend - 5)

    return levelActivity + ascendActivity
}

const PALERT_LEVEL_HOLD_MS = 15000

const updateStationState = (state, newLevel) => {
    const now = Date.now()
    const originLevel = newLevel
    let level = originLevel === -1
        ? (state.recentLevel.slice(0, 10).find((v) => v !== -1) ?? -1)
        : originLevel

    // レベルが下がるのが速すぎるのを抑えるため、低下方向は一定時間ホールドする
    const holdUntil = state.levelHoldUntil ?? 0
    if (state.level !== -1 && level !== -1) {
        if (level < state.level && now < holdUntil) {
            level = state.level
        } else if (level > state.level) {
            state.levelHoldUntil = now + PALERT_LEVEL_HOLD_MS
        }
    } else if (state.level !== -1 && level === -1 && now < holdUntil) {
        level = state.level
    } else if (state.level === -1 && level !== -1) {
        state.levelHoldUntil = now + PALERT_LEVEL_HOLD_MS
    }

    if (level > state.level && state.level !== -1) state.expireSeconds = Math.min(state.expireSeconds + 2, state.maxExpireSeconds)
    else if (level < state.level || level === -1) state.expireSeconds = state.defaultExpireSeconds

    if (level !== state.level) {
        state.level = level
    }

    const recentFilter = state.recentLevel.slice(0, state.expireSeconds).filter((v) => v !== -1)
    let ascend = 0
    if (recentFilter.length > 0) {
        const minRecent = Math.min(...recentFilter)
        ascend = level - minRecent
    }
    state.ascend = ascend
    state.activity = calcActivity(level, ascend, state.isActive)

    state.recentLevel.unshift(originLevel)
    state.recentLevel.splice(state.maxExpireSeconds)

    if (state.expireSeconds > state.defaultExpireSeconds && !state.isActive && state.recentLevel.length >= state.expireSeconds) {
        const rf = state.recentLevel.slice(0, state.expireSeconds).filter((v) => v !== -1)
        if (rf.length && rf.every((v) => v === rf[0])) {
            state.expireSeconds = state.defaultExpireSeconds
        }
    }
}

const chainActivate = (startId, activeSet, checkedSet) => {
    const pending = new Set([startId])
    while (pending.size > 0) {
        const cur = pending.values().next().value
        pending.delete(cur)
        checkedSet.add(cur)
        const st = stations[cur]
        if (!st) continue
        if (st.activity > 0) {
            activeSet.add(cur)
            for (const nb of adjStationIds[cur] || []) {
                if (!checkedSet.has(nb)) pending.add(nb)
            }
        }
    }
}

const activityThresArr = [Infinity, 9, 12, 14, 15, 16, 16]
const computeActiveStations = () => {
    const possible = stationIds.filter((id) => (stations[id]?.activity ?? 0) > 0)
    const active = new Set()
    const checked = new Set()

    for (const id of possible) {
        if (checked.has(id)) continue
        const st = stations[id]
        if (!st) continue

        if (st.isActive && st.ascend > 0) {
            chainActivate(id, active, checked)
            continue
        }

        const nearby = (adjStationIds[id] || []).map((nid) => stations[nid]).filter((s) => (s?.level ?? -1) > -1)
        const possibleNearby = nearby.filter((s) => (s?.activity ?? 0) > 0)
        const nearbyActiveNum = possibleNearby.length - possibleNearby.filter((s) => (s?.ascend ?? 0) <= 1 && !(s?.isActive)).length / 2

        let numThres
        let activityThres
        switch (settingsStore.mainSettings.displaySeisNet.niedSensitivity) {
            case 1:
                numThres = 3
                activityThres = activityThresArr[Math.min(nearby.length, 6)] + 2
                break
            case 2:
                numThres = nearby.length <= 2 ? (nearby.length + 1) / 2 : nearby.length / 2
                activityThres = activityThresArr[Math.min(nearby.length, 6)]
                break
            case 3:
                numThres = nearby.length / 2
                activityThres = activityThresArr[Math.min(nearby.length, 6)] - 2
                break
            default:
                continue
        }

        if (nearbyActiveNum >= numThres) {
            const numActivity = nearbyActiveNum * (nearbyActiveNum + 1) / 2
            const centerIndex = stationIdToIndex.get(id)
            const nearbyActivity = nearby.reduce((sum, s, idx) => {
                const sid = s?.id
                const nbIndex = stationIdToIndex.get(sid)
                const d = (typeof centerIndex === 'number' && typeof nbIndex === 'number')
                    ? (distMatrix[centerIndex]?.[nbIndex] ?? 0)
                    : 0
                return (idx >= 3 && d > 15) ? sum + (s.activity / 2) : sum + s.activity
            }, 0) + numActivity

            if (nearbyActivity >= activityThres) {
                chainActivate(id, active, checked)
            }
        }
    }

    return active
}

const ensureMarker = (id, level, forceUpdate = false) => {
    const latLng = stationIndex.get(id)
    if (!latLng || !map) return

    const existing = markers.get(id)

    const zoom = map.getZoom()
    const wantIcon = shouldUseShindoIconMarker(level, zoom)

    const createIconMarker = () => {
        const shindo = getShindoFromLevel(level)
        const icon = getShindoLeafletIcon(shindo, zoom)
        if (!icon) return null
        return L.marker(latLng, {
            icon,
            pane: 'palertStationPane0',
            interactive: false,
        })
    }

    const createCircleMarker = () => {
        const { color, radius } = computeNiedStyleColorRadius(level, zoom)
        return L.circleMarker(latLng, {
            radius,
            opacity: 1,
            fillOpacity: 1,
            color,
            fillColor: color,
            weight: 0,
            pane: 'palertStationPane0',
            renderer: palertRenderer ?? undefined,
            interactive: false,
        })
    }

    const replaceMarker = (markerType, newMarker) => {
        if (!newMarker) return
        if (existing?.marker) {
            try {
                if (map.hasLayer(existing.marker)) map.removeLayer(existing.marker)
            } catch {}
        }
        const obj = existing ?? { level: -1, marker: null, tooltipBound: false }
        obj.level = level
        obj.marker = newMarker
        obj.markerType = markerType
        obj.tooltipBound = false
        markers.set(id, obj)
        try {
            newMarker.addTo(map)
        } catch {}
        syncMarkerTooltip(obj, zoom)
    }

    // create
    if (!existing) {
        if (wantIcon) {
            const m = createIconMarker()
            if (m) {
                replaceMarker('icon', m)
                return
            }
        }
        replaceMarker('circle', createCircleMarker())
        return
    }

    // no-op
    if (!forceUpdate && existing.level === level && ((existing.markerType === 'icon') === wantIcon)) return

    // switch type
    if ((existing.markerType === 'icon') !== wantIcon) {
        if (wantIcon) {
            const m = createIconMarker()
            if (m) {
                replaceMarker('icon', m)
                return
            }
            replaceMarker('circle', createCircleMarker())
            return
        }
        replaceMarker('circle', createCircleMarker())
        return
    }

    // update same type
    existing.level = level
    if (existing.markerType === 'icon') {
        try {
            const shindo = getShindoFromLevel(level)
            const icon = getShindoLeafletIcon(shindo, zoom)
            if (icon) existing.marker.setIcon(icon)
        } catch {}
    } else {
        const { color, radius } = computeNiedStyleColorRadius(level, zoom)
        try {
            existing.marker.setStyle({
                opacity: 1,
                fillOpacity: 1,
                color,
                fillColor: color,
                weight: 0,
            }).setRadius(radius)
        } catch {}
    }

    syncMarkerTooltip(existing, zoom)
}

const removeMarker = (id) => {
    const existing = markers.get(id)
    if (!existing) return
    try {
        if (map && existing.marker && map.hasLayer(existing.marker)) map.removeLayer(existing.marker)
    } catch {}
    markers.delete(id)
}

const currentMaxShindo = computed(() => {
    // NIEDと同じ換算（activeStationsの最大levelを0..7へ）
    let currentMaxLevel = -1
    for (const id of Object.keys(stations)) {
        const st = stations[id]
        if (st?.isActive && (st.level ?? -1) > currentMaxLevel) currentMaxLevel = st.level
    }
    if (currentMaxLevel === -1) return -1
    if (currentMaxLevel <= 7) return 0
    if (currentMaxLevel <= 9) return 1
    if (currentMaxLevel <= 11) return 2
    if (currentMaxLevel <= 13) return 3
    if (currentMaxLevel <= 15) return 4
    if (currentMaxLevel <= 17) return 5
    if (currentMaxLevel <= 19) return 6
    return 7
})

let periodMaxLevel = -1

let shake1Notified = false
let shake2Notified = false
let focused = false
watch(currentMaxShindo, (newVal, oldVal) => {
    if (newVal > oldVal) {
        if (settingsStore.mainSettings.onShake?.sound) {
            playSound(`shindo${newVal}`)
        }
        if (settingsStore.mainSettings.onShake?.notification) {
            if (newVal >= 1 && newVal <= 3 && !shake1Notified) {
                sendMyNotification(
                    '揺れを検出',
                    '揺れに注意してください。',
                    iconUrls.caution,
                    settingsStore.mainSettings.muteNotification
                )
                shake1Notified = true
            } else if (newVal >= 4 && !shake2Notified) {
                sendMyNotification(
                    '強い揺れを検出',
                    '強い揺れに警戒してください。',
                    iconUrls.warn,
                    settingsStore.mainSettings.muteNotification
                )
                shake1Notified = true
                shake2Notified = true
            }
        }
        if (settingsStore.mainSettings.onShake?.focus) {
            if (newVal >= 1 && !focused) {
                focusWindow()
                focused = true
            }
        }
        if (handleTempEqlists) handleTempEqlists(0)
    } else {
        shake1Notified = false
        shake2Notified = false
        focused = false
    }
})

const applyRealtimePga = (dataVals, frameMs = Date.now()) => {
    if (!map) return
    const render = document.visibilityState === 'visible'
    if (!render) pendingRender = true

    const now = Number.isFinite(frameMs) ? frameMs : Date.now()

    // Update per-station level/activity
    let maxLevel = -1
    let maxPgaGal = 0
    for (const id of stationIds) {
        const st = stations[id]
        if (!st) continue

        // Active timeout
        if (st.isActive && st.activeUntil && now > st.activeUntil) {
            st.isActive = false
        }
        const pga = dataVals?.[id]
        const pgaGal = normalizePgaToGal(pga)

        if (pgaGal > maxPgaGal) maxPgaGal = pgaGal

        st.recentPga.unshift(pgaGal)
        st.recentPga.splice(10)

        st.pgaEff = calcRecentPgaRms(st.recentPga)

        const iClass = pgaSeriesToTaiwanIntensityClass(st.recentPga)
        const level = taiwanClassToLevel(iClass)
        updateStationState(st, level)
        if (st.level > maxLevel) maxLevel = st.level
    }

    palertMaxShindo.value = getShindoFromLevel(maxLevel)
    palertMaxPgaGal.value = maxPgaGal > 0 ? maxPgaGal.toFixed(1) : '?'
    const activeIds = computeActiveStations()
    if (activeIds.size > 0) {
        // 検出が一度途切れても、推定に使う観測点(初検知)は保持する。
        // ただし長時間空いた後に再び揺れ検知が始まった場合は、新規イベント扱いでクリアする。
        if (lastDetectActiveAtMs > 0 && now - lastDetectActiveAtMs > OBS_KEEP_GAP_MS) {
            _resetPalertHypo(true)
        }
        lastDetectActiveAtMs = now

        for (const id of activeIds) {
            const st = stations[id]
            if (!st) continue
            st.isActive = true
            st.activeUntil = now + 10500

            if (!firstDetectMsByStationId.has(id)) {
                firstDetectMsByStationId.set(id, { tMs: now, level: st?.level ?? -1 })
            }
        }
    }

    const activeStationIds = []
    for (const id of stationIds) {
        const st = stations[id]
        if (!st?.isActive) continue
        activeStationIds.push(id)
    }

    palertDetectActive.value = activeStationIds.length > 0
    palertDetectObsCount.value = activeStationIds.length

    // 震源推定 + 予報円描画（揺れ検知由来）
    if (map && Number.isFinite(now) && activeStationIds.length > 0) {
        if (now - lastHypoEstimateAtMs >= 1000) {
            const picks = []
            // 推定には「現在アクティブな局」だけでなく、イベント中に一度でも検知した局(初検知)を使う
            for (const [id, info] of firstDetectMsByStationId.entries()) {
                const tMs = info?.tMs
                const ll = stationIndex.get(id)
                if (!Number.isFinite(tMs) || !ll) continue
                picks.push({
                    id,
                    tObsSec: tMs / 1000,
                    ll: L.latLng(ll[0], ll[1]),
                    lat: ll[0],
                    lon: ll[1],
                    level: Number.isFinite(info?.level) ? info.level : (stations[id]?.level ?? -1),
                })
            }
            picks.sort((a, b) => a.tObsSec - b.tObsSec)
            const used = picks.slice(0, 40)

            let solved = false
            if (used.length >= 4) {
                const seed = used.slice(0, 3)
                const initialLat = seed.reduce((s, o) => s + o.lat, 0) / seed.length
                const initialLon = seed.reduce((s, o) => s + o.lon, 0) / seed.length
                const hypo0 = L.latLng(initialLat, initialLon)
                const observations = used.map((o) => {
                    const distKm = hypo0.distanceTo(o.ll) / 1000
                    const distW = 1 / Math.pow(1 + distKm / 200, 2)
                    const levelW = 1 + Math.max(0, o.level) / 10
                    return {
                        lat: o.lat,
                        lon: o.lon,
                        ll: o.ll,
                        tObsSec: o.tObsSec,
                        weight: distW * levelW,
                    }
                })

                const est = locateHypocenterGeiger({
                    travelTime: _getTravelTime(),
                    observations,
                    initial: {
                        lat: initialLat,
                        lon: initialLon,
                        depthKm: 10,
                        originSec: used[0].tObsSec - 2.0,
                    },
                    maxIter: 8,
                })
                if (est) {
                    const minObsSec = observations.reduce(
                        (acc, o) => (Number.isFinite(o?.tObsSec) ? Math.min(acc, o.tObsSec) : acc),
                        Infinity
                    )
                    const clampUpper = Number.isFinite(minObsSec) ? (minObsSec - 0.01) : Infinity
                    const originSec = Number.isFinite(est.originSec) ? Math.min(est.originSec, clampUpper) : clampUpper

                    lastHypo = {
                        lat: est.lat,
                        lon: est.lon,
                        depthKm: est.depthKm,
                        originMs: originSec * 1000,
                        rmsSec: est.rmsSec,
                        converged: est.converged,
                    }
                    lastHypoEstimateAtMs = now
                    solved = true
                }
            }

            if (!solved && used.length >= 1 && !lastHypo) {
                const first = used[0]
                lastHypo = {
                    lat: first.lat,
                    lon: first.lon,
                    depthKm: 10,
                    originMs: (first.tObsSec - 2.0) * 1000,
                    rmsSec: Infinity,
                    converged: false,
                }
                lastHypoEstimateAtMs = now
            }
        }

        if (lastHypo) {
            _updateHypoLayers(lastHypo, now)
            palertDetectOriginTime.value = stampToTime(lastHypo.originMs, 8)
            palertDetectDepthKm.value = lastHypo.depthKm

            // Prefer epicenter name if available; else fallback to coordinates
            const fallback = `${lastHypo.lat.toFixed(2)}, ${lastHypo.lon.toFixed(2)}`
            palertDetectEpicenterName.value = fallback
            getNearestEpiName(lastHypo.lat, lastHypo.lon)
                .then((name) => {
                    if (name) palertDetectEpicenterName.value = name
                })
                .catch(() => {})
        }
    } else {
        _resetPalertHypo()
    }

    statusStore.isActive.palertNet = activeIds.size > 0

    // 期間最大（揺れ検知中）: NIEDと同様に、揺れが継続している間は最大を保持
    if (statusStore.isActive.palertNet) {
        let maxActiveLevel = -1
        for (const id of activeIds) {
            const st = stations[id]
            if (!st) continue
            if ((st.level ?? -1) > maxActiveLevel) maxActiveLevel = st.level
        }
        if (maxActiveLevel < 0) maxActiveLevel = 0
        if (maxActiveLevel > periodMaxLevel) periodMaxLevel = maxActiveLevel
        palertPeriodMaxShindo.value = getShindoFromLevel(periodMaxLevel)

        const color = periodMaxLevel <= 7 ? 'green' : periodMaxLevel <= 13 ? 'yellow' : 'red'
        palertPeriodBarClass.value = color
    } else {
        periodMaxLevel = -1
        palertPeriodMaxShindo.value = '?'
        palertPeriodBarClass.value = 'gray'

        _resetPalertHypo()
    }
    if (smartSetView) smartSetView()

    // マーカーは全て表示（設定で間引きした集合に対して）
    // ただし毎秒全点のsetStyleは避け、レベル変化または未生成の時だけ更新する
    if (render) {
        for (const id of stationIds) {
            const st = stations[id]
            if (!st) continue
            ensureMarker(id, st.level)
        }
    } else {
        // 非表示中はDOM/Canvas更新を避けるが、状態だけ追従させる
        for (const id of stationIds) {
            const st = stations[id]
            if (!st) continue
            const existing = markers.get(id)
            if (existing) existing.level = st.level
        }
    }
    palertMarkerCount.value = markers.size

    // 揺れ検知時: NIED互換グリッド矩形を表示
    if (!gridDecimalInitialized) {
        let first = null
        for (const id of stationIds) {
            const st = stations[id]
            if (!st?.isActive) continue
            if (!first || (st.level ?? -1) > (first.level ?? -1)) first = st
        }
        if (first?.latLng) {
            const dec = computeDecimalFromLatLng(first.latLng)
            if (dec) {
                gridDecimal = dec
                gridDecimalInitialized = true
            }
        }
    }

    const grids = {}
    if (gridDecimalInitialized) {
        for (const id of stationIds) {
            const st = stations[id]
            if (!st?.isActive) continue
            const snapped = snapToNiedGrid(st.latLng)
            if (!snapped) continue
            const key = JSON.stringify(snapped)
            const level = st.level ?? -1
            if (key in grids) {
                if (level > grids[key].level) grids[key].level = level
            } else {
                grids[key] = { latLng: snapped, level }
            }
        }
    }

    for (const [key, obj] of gridRects.entries()) {
        if (!(key in grids)) {
            try {
                if (map && obj?.layer && map.hasLayer(obj.layer)) map.removeLayer(obj.layer)
            } catch {}
            gridRects.delete(key)
        }
    }

    for (const key of Object.keys(grids)) {
        const item = grids[key]
        const color = item.level <= 7 ? 'green' : item.level <= 13 ? 'yellow' : 'red'

        if (!gridRects.has(key)) {
            try {
                const layer = L.rectangle([item.latLng.map(l => l - 0.495), item.latLng.map(l => l + 0.495)], {
                    color,
                    weight: 2,
                    fill: false,
                    opacity: gridBlinkOn ? 1 : 0.15,
                    pane: 'palertGridPane',
                    interactive: false
                }).addTo(map)
                gridRects.set(key, { color, layer })
            } catch {}
        } else {
            const existing = gridRects.get(key)
            if (existing?.color !== color) {
                existing.color = color
                try {
                    existing.layer.setStyle({ color })
                } catch {}
            }
        }
    }

    // 点滅（揺れ検知中）
    if (gridRects.size > 0) {
        _startGridBlinking()
    } else {
        _stopGridBlinking()
    }
}

const tickRealtime = async () => {
    if (!map) return
    if (stationIndex.size === 0) return

    const nowMs = timeStore.getTimeStamp() - delayMs.value
    const recordTimeSeconds = nowMs / 1000

    const res = await postGraphql(REALTIME_PGA_QUERY, {
        recordTime: recordTimeSeconds,
        type: 0
    })

    const payload = res?.data?.realtimePGA
    if (!payload) return

    if (payload.timestamp) palertUpdateTime.value = formatIsoToTime(payload.timestamp, 8)
    applyRealtimePga(payload.dataVals, nowMs)
}

const startRealtimeLoop = () => {
    if (requestInterval) return
    requestInterval = setInterval(() => {
        tickRealtime().catch((e) => console.log(e))
    }, 1000)
    tickRealtime().catch((e) => console.log(e))
}

const stopRealtimeLoop = () => {
    if (requestInterval) clearInterval(requestInterval)
    requestInterval = null
}

onMounted(() => {
    fetchStationList().catch((e) => console.log(e))
    stationListInterval = setInterval(() => {
        fetchStationList().catch((e) => console.log(e))
    }, 3600 * 1000)

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && pendingRender) {
            pendingRender = false
            renderAll()
        }
    })
})

let unwatchMap = null
unwatchMap = watch(
    () => statusStore.map,
    (newVal) => {
        if (newVal === null) return
        if (map) return

        map = newVal
        palertRenderer = L.canvas({ padding: 0.5, pane: 'palertStationPane0' })
        map.on('zoomend', renderAll)
        startRealtimeLoop()
    },
    { immediate: true }
)

watch(() => settingsStore.mainSettings.displaySeisNet.delay, () => {
    // リプレイ時刻を変えたら、揺れ検知/表示の蓄積をリセット
    shake1Notified = false
    shake2Notified = false
    focused = false
    for (const id of stationIds) {
        const st = stations[id]
        if (!st) continue
        st.isActive = false
        st.activeUntil = 0
        st.recentLevel = []
        st.recentPga = []
        st.expireSeconds = st.defaultExpireSeconds
        st.level = -1
        st.ascend = 0
        st.activity = 0
    }
    for (const id of Array.from(markers.keys())) removeMarker(id)

    for (const obj of gridRects.values()) {
        try {
            if (map && obj?.layer && map.hasLayer(obj.layer)) map.removeLayer(obj.layer)
        } catch {}
    }
    gridRects.clear()

    gridDecimalInitialized = false
    gridDecimal = [0, 0]

    periodMaxLevel = -1
    palertPeriodMaxShindo.value = '?'
    palertPeriodBarClass.value = 'gray'

    palertMarkerCount.value = 0
    palertMaxPgaGal.value = '?'
    statusStore.isActive.palertNet = false

    _resetPalertHypo(true)
}, { immediate: true })

watch(
    () => settingsStore.mainSettings.displaySeisNet.palertQuantizeDeg,
    () => {
        // 間引き設定を変えたら、観測点集合を作り直す
        clearStations()
        periodMaxLevel = -1
        palertPeriodMaxShindo.value = '?'
        palertPeriodBarClass.value = 'gray'
        fetchStationList().catch((e) => console.log(e))
    }
)

watch(
    () => `${settingsStore.mainSettings.displaySeisNet.style}
    |${settingsStore.mainSettings.displaySeisNet.displayTremShindo}
    |${settingsStore.mainSettings.displaySeisNet.displayNiedShindo}
    |${settingsStore.mainSettings.displaySeisNet.hideNoData}
    |${settingsStore.mainSettings.displaySeisNet.displayShindo0}
    |${settingsStore.mainSettings.displaySeisNet.palertColorBy}`,
    () => renderAll()
)

onBeforeUnmount(() => {
    _stopGridBlinking()
    stopRealtimeLoop()
    if (stationListInterval) clearInterval(stationListInterval)
    stationListInterval = null

    if (map) map.off('zoomend', renderAll)
    clearStations()

    _resetPalertHypo(true)

    if (unwatchMap) unwatchMap()
})
</script>

<style lang="scss" scoped>
:global(.palert-shindo-tooltip.leaflet-tooltip) {
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
}

:global(.palert-shindo-tooltip.leaflet-tooltip .leaflet-tooltip-content) {
    padding: 0;
    margin: 0;
    font-size: 10px;
    line-height: 10px;
    font-weight: 700;
    color: var(--white);
}

:global(.palert-shindo-tooltip.leaflet-tooltip:before) {
    display: none;
}
</style>
