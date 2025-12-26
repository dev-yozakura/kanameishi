<template>
    <div />
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, inject } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import Http from '@/classes/Http'
import { computeNiedStyleColorRadius } from '@/classes/StationClasses'
import { useStatusStore } from '@/stores/status'
import { useSettingsStore } from '@/stores/settings'
import { useTimeStore } from '@/stores/time'
import { focusWindow, getLevelFromInstShindo, getShindoFromLevel, playSound, sendMyNotification } from '@/utils/Utils'
import { iconUrls } from '@/utils/Urls'
import { isTauri as getIsTauri } from '@tauri-apps/api/core'

const statusStore = useStatusStore()
const settingsStore = useSettingsStore()
const timeStore = useTimeStore()

const isTauri = getIsTauri()
const graphqlUrl = isTauri
    ? 'https://palert.earth.sinica.edu.tw/graphql/'
    : '/palert/graphql/'

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

const palertUpdateTime = inject('palertUpdateTime', ref('1970-01-01 08:00:00'))
const palertMaxShindo = inject('palertMaxShindo', ref('?'))
const palertMarkerCount = inject('palertMarkerCount', ref(0))
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

const shouldShowShindoTooltip = (level, zoom) => {
    if (!settingsStore.mainSettings.displaySeisNet.displayTremShindo) return false
    if (zoom < 7) return false
    const minLevel = settingsStore.mainSettings.displaySeisNet.displayShindo0 ? 6 : 8
    return level >= minLevel
}

const syncMarkerTooltip = (markerObj, zoom) => {
    if (!markerObj?.marker) return
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
    statusStore.isActive.palertNet = false
}

const pgaToInstShindo = (pga) => {
    const v = Number(pga)
    if (!Number.isFinite(v) || v <= 0) return -3.1
    // MSIL 側の逆変換: pga = 10 ** (5 * ((shindo + 3) / 10) - 2)
    // => shindo = 2*log10(pga) + 1
    return 2 * Math.log10(v) + 1
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

const quantize01 = (v) => Math.round(Number(v) * 10) / 10

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

    const quantizeEnabled = !!settingsStore.mainSettings.displaySeisNet.palertQuantize01deg

    if (quantizeEnabled) {
        // 緯度経度を0.1°刻みに丸めて代表点1つ
        const reps = new Map() // key -> { station, lat, lon, dist2 }
        for (const info of infos) {
            const station = info?.station
            const lat = info?.lat
            const lon = info?.lon
            if (!station || typeof lat !== 'number' || typeof lon !== 'number') continue

            const qLat = quantize01(lat)
            const qLon = quantize01(lon)
            const key = `${qLat.toFixed(1)},${qLon.toFixed(1)}`
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
                activity: 0,
                isActive: false,
                activeUntil: 0,
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
        const { color, radius } = computeNiedStyleColorRadius(obj.level, zoom)
        try {
            obj.marker.setStyle({
                opacity: 1,
                fillOpacity: 1,
                color,
                fillColor: color,
                weight: 0,
            }).setRadius(radius)
        } catch {}

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

const updateStationState = (state, newLevel) => {
    const originLevel = newLevel
    const level = originLevel === -1
        ? (state.recentLevel.slice(0, 4).find((v) => v !== -1) ?? -1)
        : originLevel

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
    if (!existing) {
        const zoom = map.getZoom()
        const { color, radius } = computeNiedStyleColorRadius(level, zoom)
        const marker = L.circleMarker(latLng, {
            radius,
            opacity: 1,
            fillOpacity: 1,
            color,
            fillColor: color,
            weight: 0,
            pane: 'palertStationPane0',
            renderer: palertRenderer ?? undefined,
            interactive: false,
        }).addTo(map)

        const obj = { level, marker, tooltipBound: false }
        markers.set(id, obj)
        syncMarkerTooltip(obj, zoom)
        return
    }

    if (!forceUpdate && existing.level === level) return

    existing.level = level
    const zoom = map.getZoom()
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

const applyRealtimePga = (dataVals) => {
    if (!map) return
    const render = document.visibilityState === 'visible'
    if (!render) pendingRender = true

    const now = Date.now()

    // Update per-station level/activity
    let maxLevel = -1
    for (const id of stationIds) {
        const st = stations[id]
        if (!st) continue

        // Active timeout
        if (st.isActive && st.activeUntil && now > st.activeUntil) {
            st.isActive = false
        }

        const pga = dataVals?.[id]
        const instRaw = pgaToInstShindo(pga)
        // 震度0(瞬間震度<0.5)はNIED同様に“青帯”へ寄せる。
        // 欠測(-3.0未満)はそのまま欠測扱い。
        const inst = (instRaw > -3.0 && instRaw < 0.5) ? -3.0 : instRaw
        const level = getLevelFromInstShindo(inst)
        updateStationState(st, level)
        if (st.level > maxLevel) maxLevel = st.level
    }

    palertMaxShindo.value = getShindoFromLevel(maxLevel)

    // Detect shake (NIED互換)
    const activeIds = computeActiveStations()
    if (activeIds.size > 0) {
        for (const id of activeIds) {
            const st = stations[id]
            if (!st) continue
            st.isActive = true
            st.activeUntil = now + 10500
        }
    }

    statusStore.isActive.palertNet = activeIds.size > 0
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
    applyRealtimePga(payload.dataVals)
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

    palertMarkerCount.value = 0
    statusStore.isActive.palertNet = false
}, { immediate: true })

watch(
    () => settingsStore.mainSettings.displaySeisNet.palertQuantize01deg,
    () => {
        // 間引き設定を変えたら、観測点集合を作り直す
        clearStations()
        fetchStationList().catch((e) => console.log(e))
    }
)

watch(
    () => `${settingsStore.mainSettings.displaySeisNet.style}
    |${settingsStore.mainSettings.displaySeisNet.displayTremShindo}
    |${settingsStore.mainSettings.displaySeisNet.hideNoData}
    |${settingsStore.mainSettings.displaySeisNet.displayShindo0}`,
    () => renderAll()
)

onBeforeUnmount(() => {
    stopRealtimeLoop()
    if (stationListInterval) clearInterval(stationListInterval)
    stationListInterval = null

    if (map) map.off('zoomend', renderAll)
    clearStations()

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
