<template>
  <div />
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, inject } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Http from '@/classes/Http'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { useStatusStore } from '@/stores/status'
import { useSettingsStore } from '@/stores/settings'
import { useTimeStore } from '@/stores/time'
import { iconUrls } from '@/utils/Urls'
import { getLevelFromInstShindo, stampToTime, playSound, sendMyNotification, calcTimeDiff, focusWindow, getShindoFromLevel, calcWaveDistance } from '@/utils/Utils'
import { getTjma2001TravelTime } from '@/utils/Tjma2001'
import { locateHypocenterGeiger } from '@/utils/HypocenterGeiger'
import { getNearestEpiName } from '@/utils/EpiName'
import { NiedStation, simpleIcon } from '@/classes/StationClasses'
import eewCross from '@/assets/icon/hypocenter/eewCross.svg'

const statusStore = useStatusStore()
const settingsStore = useSettingsStore()
const timeStore = useTimeStore()

const niedMaxShindo = inject('niedMaxShindo')
const niedUpdateTime = inject('niedUpdateTime')
const niedPeriodMaxShindo = inject('niedPeriodMaxShindo')
const niedPeriodBarClass = inject('niedPeriodBarClass')
const niedMaxPgaGal = inject('niedMaxPgaGal')
const niedMarkerCount = inject('niedMarkerCount')
const niedEpicenterName = inject('niedEpicenterName')
const niedDetectActive = inject('niedDetectActive')
const niedDetectOriginTime = inject('niedDetectOriginTime')
const niedDetectDepthKm = inject('niedDetectDepthKm')
const niedDetectObsCount = inject('niedDetectObsCount')
const handleTempEqlists = inject('handleTempEqlists')
const smartSetView = inject('smartSetView')

const points = ref([]) // [{lat, lon, x, y, suspended}]

let stationList = []
const stationData = ref([]) // intensity chars
const stations = reactive([]) // NiedStation[]

let map = null
let worker = null
let timer = null

const iconRadius = 20
const niedHypoIcon = L.icon({
  iconUrl: eewCross,
  iconSize: [iconRadius * 2, iconRadius * 2],
  iconAnchor: [iconRadius, iconRadius],
})

// stationId -> { tMs: number, level: number }
const kmoniFirstDetectMsByStationId = new Map() // stationId -> first detect frame ts (ms)
const OBS_KEEP_GAP_MS = 10 * 1000
let lastDetectActiveAtMs = 0

let niedHypoMarker = null
let niedPWave = null
let niedSWave = null
let niedSWaveFill = null
let _niedHypoTooltipKey = ''

let lastHypoEstimateAtMs = 0
let lastHypo = null // { lat, lon, depthKm, originMs, score }
let _niedEpiName = ''
let _niedEpiReqId = 0

const _escapeHtml = (s) =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

let _tjma2001 = null
const _getTravelTime = () => {
  if (_tjma2001) return _tjma2001
  _tjma2001 = getTjma2001TravelTime()
  return _tjma2001
}

const _clearNiedHypoLayers = () => {
  if (!map) return
  if (niedHypoMarker && map.hasLayer(niedHypoMarker)) map.removeLayer(niedHypoMarker)
  if (niedPWave && map.hasLayer(niedPWave)) map.removeLayer(niedPWave)
  if (niedSWave && map.hasLayer(niedSWave)) map.removeLayer(niedSWave)
  if (niedSWaveFill && map.hasLayer(niedSWaveFill)) map.removeLayer(niedSWaveFill)
  niedHypoMarker = null
  niedPWave = null
  niedSWave = null
  niedSWaveFill = null
  _niedHypoTooltipKey = ''
}

const _resetNiedHypo = (hard = false) => {
  if (hard) kmoniFirstDetectMsByStationId.clear()
  lastHypoEstimateAtMs = 0
  lastHypo = null
  _niedEpiName = ''
  if (niedEpicenterName) niedEpicenterName.value = ''
  if (niedDetectActive) niedDetectActive.value = false
  if (niedDetectOriginTime) niedDetectOriginTime.value = ''
  if (niedDetectDepthKm) niedDetectDepthKm.value = NaN
  if (niedDetectObsCount) niedDetectObsCount.value = 0
  _clearNiedHypoLayers()
}

const _resolveEpicenterName = async (hypo) => {
  if (!hypo || !niedEpicenterName) return
  const reqId = ++_niedEpiReqId
  try {
    const name = await getNearestEpiName(hypo.lat, hypo.lon)
    if (reqId !== _niedEpiReqId) return
    _niedEpiName = name || ''
    niedEpicenterName.value = _niedEpiName
    _niedHypoTooltipKey = ''
  } catch {
    if (reqId !== _niedEpiReqId) return
    _niedEpiName = ''
    niedEpicenterName.value = ''
    _niedHypoTooltipKey = ''
  }
}

const _buildGeigerObservations = (used) => {
  if (!used?.length) return null

  // 初期値: 最初に検知した3点の重心（深さは固定10km）
  const seed = used.slice(0, 3)
  const initialLat = seed.reduce((s, o) => s + o.lat, 0) / seed.length
  const initialLon = seed.reduce((s, o) => s + o.lon, 0) / seed.length
  const first = used[0]
  const initial = {
    lat: initialLat,
    lon: initialLon,
    depthKm: 10,
    originSec: first.tObsSec - 2.0,
  }

  // 重み: レベル(強い揺れほど↑) + 距離(遠いほど↓)
  const hypo0 = L.latLng(initial.lat, initial.lon)
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
      elevM: Number.isFinite(o?.elevM) ? o.elevM : 0,
    }
  })

  return { observations, initial }
}

const _updateNiedHypoLayers = (hypo, frameMs) => {
  if (!map || !hypo) return
  const travelTime = _getTravelTime()
  const latLng = [hypo.lat, hypo.lon]
  const passedSec = Math.max(0, (frameMs - hypo.originMs) / 1000)

  const pInfo = calcWaveDistance(travelTime, true, hypo.depthKm, passedSec)
  const sInfo = calcWaveDistance(travelTime, false, hypo.depthKm, passedSec)
  const pRadiusKm = pInfo?.radius || 0
  const sRadiusKm = sInfo?.radius || 0

  if (!niedHypoMarker) {
    niedHypoMarker = L.marker(latLng, { icon: niedHypoIcon, pane: 'eewMarkerPane' })
    niedHypoMarker.addTo(map)
  } else {
    niedHypoMarker.setLatLng(latLng)
  }

  const originStr = Number.isFinite(hypo.originMs) ? stampToTime(hypo.originMs, 9) : ''
  const tooltipKey = `${hypo.depthKm}|${originStr}|${_niedEpiName}`
  if (tooltipKey !== _niedHypoTooltipKey) {
    _niedHypoTooltipKey = tooltipKey
    const nameLine = _niedEpiName ? `<br>Name ${_escapeHtml(_niedEpiName)}` : ''
    niedHypoMarker.bindTooltip(
      `<strong>NIED(推定)</strong><br>Depth ${hypo.depthKm}km<br>Origin ${originStr}${nameLine}`,
      { permanent: false, direction: 'top', className: 'custom-tooltip' }
    )
  }

  if (pRadiusKm > 0) {
    if (!niedPWave) {
      niedPWave = L.circle(latLng, {
        color: 'var(--swave-blue)',
        opacity: 1,
        weight: 2,
        fill: false,
        radius: pRadiusKm * 1000,
        pane: 'wavePane',
        interactive: false,
      }).addTo(map)
    } else {
      niedPWave.setLatLng(latLng)
      niedPWave.setRadius(pRadiusKm * 1000)
    }
  } else if (niedPWave && map.hasLayer(niedPWave)) {
    map.removeLayer(niedPWave)
    niedPWave = null
  }

  const sColor = 'var(--swave-green)'
  if (sRadiusKm > 0) {
    if (!niedSWave) {
      niedSWave = L.circle(latLng, {
        color: sColor,
        opacity: 1,
        weight: 2,
        fill: false,
        radius: sRadiusKm * 1000,
        pane: 'wavePane',
        interactive: false,
      }).addTo(map)
    } else {
      niedSWave.setLatLng(latLng)
      niedSWave.setRadius(sRadiusKm * 1000)
    }
    if (!niedSWaveFill) {
      niedSWaveFill = L.circle(latLng, {
        fillColor: sColor,
        fillOpacity: 0.2,
        stroke: false,
        radius: sRadiusKm * 1000,
        pane: 'waveFillPane',
        interactive: false,
      }).addTo(map)
    } else {
      niedSWaveFill.setLatLng(latLng)
      niedSWaveFill.setRadius(sRadiusKm * 1000)
    }
  } else {
    if (niedSWave && map.hasLayer(niedSWave)) map.removeLayer(niedSWave)
    if (niedSWaveFill && map.hasLayer(niedSWaveFill)) map.removeLayer(niedSWaveFill)
    niedSWave = null
    niedSWaveFill = null
  }
}

let pollInFlight = false
let lastAbortController = null

const edgeProxyBase = (import.meta.env.VITE_EDGE_PROXY_BASE || '').replace(/\/+$/, '')
const proxyBase = computed(() => {
  if (edgeProxyBase) return `${edgeProxyBase}/kmoni`
  return import.meta.env.DEV ? '/kmoni' : 'https://www.kmoni.bosai.go.jp'
})
const delayMs = computed(() => settingsStore.mainSettings.displaySeisNet.delay * 60000)

const _formatJstKey = (ms) => {
  // kmoni はJST基準のパスを使うので、UTC getter + 9h オフセットで組み立てる
  const d = new Date(ms + 9 * 3600 * 1000)
  const yyyy = d.getUTCFullYear()
  const MM = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  const ss = String(d.getUTCSeconds()).padStart(2, '0')
  return { yyyymmdd: `${yyyy}${MM}${dd}`, yyyymmddhhmmss: `${yyyy}${MM}${dd}${hh}${mm}${ss}` }
}

let pendingRender = false
const _onVisibilityChange = () => {
  if (document.visibilityState === 'visible' && pendingRender) {
    pendingRender = false
    renderAll()
  }
}
const nearbyLength = 6
const activityThresArr = [Infinity, 9, 12, 14, 15, 16, 16]
let adjStationIds = {}
let expireSeconds = {}
let distMatrix = [[]]
let decimal = [0, 0]
const gridRects = {}
let periodMaxLevel = -1

const activeStations = computed(() => {
  const list = []
  stations.forEach((station) => {
    if (station?.isActive) list.push(station)
  })
  return list
})

const grids = computed(() => {
  const out = {}
  activeStations.value.forEach((station) => {
    const latLng = station.latLng.map((l, index) => Math.round(l - decimal[index]) + decimal[index])
    const level = station.level
    const key = JSON.stringify(latLng)
    if (key in out) {
      if (level > out[key].level) out[key].level = level
    } else {
      out[key] = { latLng, level }
    }
  })
  return out
})

const currentMaxShindo = computed(() => {
  const currentMaxLevel = Math.max(...Object.keys(grids.value).map((key) => grids.value[key].level), -1)
  if (currentMaxLevel === -1) return -1
  else if (currentMaxLevel <= 7) return 0
  else if (currentMaxLevel <= 9) return 1
  else if (currentMaxLevel <= 11) return 2
  else if (currentMaxLevel <= 13) return 3
  else if (currentMaxLevel <= 15) return 4
  else if (currentMaxLevel <= 17) return 5
  else if (currentMaxLevel <= 19) return 6
  else return 7
})

const chainActivate = (station, activeSet, checkedSet) => {
  const pendingStations = new Set([station])
  while (pendingStations.size > 0) {
    const currentStation = pendingStations.values().next().value
    pendingStations.delete(currentStation)
    checkedSet.add(currentStation)
    if (currentStation.activity > 0) {
      activeSet.add(currentStation)
      adjStationIds[currentStation.id].forEach((id) => {
        const neighbor = stations[id]
        if (!checkedSet.has(neighbor)) pendingStations.add(neighbor)
      })
    }
  }
}

const update = (frameMs) => {
  if (stationList.length === stations.length && stations.length === stationData.value.length) {
    const render = document.visibilityState === 'visible'
    if (!render) pendingRender = true
    const nowMs = Number.isFinite(frameMs) ? frameMs : timeStore.getTimeStamp()
    let maxLevel = -1
    for (let i = 0; i < stationList.length; i += 1) {
      stations[i].update(stationData.value[i], render)
      if (stations[i].level > maxLevel) maxLevel = stations[i].level
    }
    niedMaxShindo.value = getShindoFromLevel(maxLevel)

    const possibleStations = stations.filter((s) => s?.activity > 0)
    const activeSet = new Set()
    const checkedSet = new Set()
    possibleStations.forEach((station) => {
      if (!checkedSet.has(station)) {
        if (station.isActive && station.ascend > 0) {
          chainActivate(station, activeSet, checkedSet)
          return
        }
        const nearbyStations = adjStationIds[station.id].map((id) => stations[id]).filter((s) => s.level > -1)
        const possibleNearbyStations = nearbyStations.filter((s) => s.activity > 0)
        const nearbyActiveNum = possibleNearbyStations.length - possibleNearbyStations.filter((s) => s.ascend <= 1 && !s.isActive).length / 2

        let numThres
        let activityThres
        switch (settingsStore.mainSettings.displaySeisNet.niedSensitivity) {
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
          const numActivity = (nearbyActiveNum * (nearbyActiveNum + 1)) / 2
          const nearbyActivity = nearbyStations.reduce(
            (sum, nearbyStation, index) => (index >= 3 && distMatrix[station.id][nearbyStation.id] > 15 ? sum + nearbyStation.activity / 2 : sum + nearbyStation.activity),
            0
          ) + numActivity
          if (nearbyActivity >= activityThres) {
            chainActivate(station, activeSet, checkedSet)
          }
        }
      }
    })

    if (!statusStore.isActive.niedNet) {
      let first = null
      activeSet.forEach((station) => {
        if (!first || station.level > first.level) first = station
      })
      if (first) decimal = first.latLng.map((val) => Math.round(((val + 180) % 1) * 10) / 10)
    }

    // 検出が一度途切れても、推定に使う観測点(初検知)は保持する。
    // ただし長時間空いた後に再び揺れ検知が始まった場合は、新規イベント扱いでクリアする。
    if (Number.isFinite(nowMs) && activeSet.size > 0) {
      if (lastDetectActiveAtMs > 0 && nowMs - lastDetectActiveAtMs > OBS_KEEP_GAP_MS) {
        _resetNiedHypo(true)
      }
      lastDetectActiveAtMs = nowMs
    }

    if (Number.isFinite(nowMs)) {
      activeSet.forEach((station) => {
        // 既にアクティブになっている局でも、初回検知時刻が未記録なら補完する
        if (!kmoniFirstDetectMsByStationId.has(station.id)) {
          kmoniFirstDetectMsByStationId.set(station.id, { tMs: nowMs, level: station.level })
        }
      })
    }

    activeSet.forEach((station) => station.setActive())

    if (map && Number.isFinite(nowMs) && activeSet.size > 0 && nowMs - lastHypoEstimateAtMs >= 1000) {
      const picks = []
      // 推定には「現在アクティブな局」だけでなく、イベント中に一度でも検知した局(初検知)を使う
      for (const [id, info] of kmoniFirstDetectMsByStationId.entries()) {
        const station = stations[id]
        const tMs = info?.tMs
        if (!station || !Number.isFinite(tMs)) continue
        const elevM = Number(points.value?.[id]?.elevation)
        picks.push({
          id,
          tObsSec: tMs / 1000,
          ll: L.latLng(station.latLng),
          lat: station.latLng[0],
          lon: station.latLng[1],
          level: Number.isFinite(info?.level) ? info.level : (station.level ?? -1),
          elevM: Number.isFinite(elevM) ? elevM : 0,
        })
      }
      picks.sort((a, b) => a.tObsSec - b.tObsSec)
      const used = picks.slice(0, 40)

      const travelTime = _getTravelTime()
      const built = _buildGeigerObservations(used)
      let solved = false
      if (built && used.length >= 4) {
        const est = locateHypocenterGeiger({
          travelTime,
          observations: built.observations,
          initial: built.initial,
          maxIter: 8,
        })
        if (est) {
          lastHypo = {
            lat: est.lat,
            lon: est.lon,
            depthKm: est.depthKm,
            originMs: est.originSec * 1000,
            rmsSec: est.rmsSec,
            converged: est.converged,
          }
          lastHypoEstimateAtMs = nowMs
          solved = true
          _resolveEpicenterName(lastHypo)
          _updateNiedHypoLayers(lastHypo, nowMs)
        }
      }

      // まだ解けない段階でも、暫定的に「最初に検知した点」を震源として表示する
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
        lastHypoEstimateAtMs = nowMs
        _resolveEpicenterName(lastHypo)
        _updateNiedHypoLayers(lastHypo, nowMs)
      }
    }

    // 推定済みであれば、推定更新がなくても円を毎フレーム更新する
    if (map && lastHypo && Number.isFinite(nowMs)) {
      _updateNiedHypoLayers(lastHypo, nowMs)
    }

    if (niedDetectObsCount) niedDetectObsCount.value = activeSet.size
    if (lastHypo) {
      if (niedDetectActive) niedDetectActive.value = true
      if (niedDetectOriginTime) niedDetectOriginTime.value = stampToTime(lastHypo.originMs, 9)
      if (niedDetectDepthKm) niedDetectDepthKm.value = lastHypo.depthKm
    }
  }
}

const renderAll = () => {
  stations.forEach((station) => station?.render?.())
}

const _fetchJson = async (url, signal) => {
  // TauriではCORS回避のため plugin-http を使う
  if (typeof window !== 'undefined' && window.__TAURI__) {
    return await Http.tauriGet(url)
  }
  const res = await fetch(url, { cache: 'no-store', signal })
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`)
  return await res.json()
}

const _fetchBlob = async (url, signal) => {
  if (typeof window !== 'undefined' && window.__TAURI__) {
    const res = await tauriFetch(url, { method: 'GET', connectTimeout: 15000 })
    const ab = await res.arrayBuffer()
    return new Blob([ab])
  }
  const res = await fetch(url, { cache: 'no-store', signal })
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`)
  return await res.blob()
}

const _ensureWorker = () => {
  if (worker) return
  worker = new Worker(new URL('../../workers/kmoni-gif-decoder.js', import.meta.url), { type: 'module' })
  worker.onmessage = (ev) => {
    const { type } = ev.data || {}
    if (type === 'decoded') {
      const { mode, inst, pga, valid, tsMs } = ev.data
      if (mode === 'pga') {
        handleDecodedPga(pga, valid, tsMs)
      } else {
        handleDecoded(inst, valid, tsMs)
      }
    }
  }
  worker.postMessage({
    type: 'init',
    points: points.value.map((p) => ({ x: p.x, y: p.y, suspended: p.suspended })),
  })
}

let lastFrameTimeStr = null

const _instToIntensityChar = (inst) => {
  if (!Number.isFinite(inst)) return 'c' // charCode 99 -> level -1
  const level = getLevelFromInstShindo(inst)
  if (!Number.isFinite(level) || level < 0) return 'c'
  return String.fromCharCode(level + 100)
}

const handleDecoded = (instArr, validArr, tsMs) => {
  const render = document.visibilityState === 'visible'
  if (!render) return

  const newTimeStr = Number.isFinite(tsMs) ? stampToTime(tsMs, 9) : null
  if (newTimeStr && lastFrameTimeStr) {
    const timeDiff = calcTimeDiff(newTimeStr, 9, lastFrameTimeStr, 9)
    if (timeDiff > 1000) {
      const popNum = Math.min(Math.round(timeDiff / 1000) - 1, 60)
      const noDataArr = Array(popNum).fill(-1)
      stations.forEach((station) => {
        station.recentLevel.unshift(...noDataArr)
        station.recentLevel.splice(station.maxExpireSeconds)
        station.expireSeconds = Math.max(station.expireSeconds - popNum, station.defaultExpireSeconds)
      })
    }
    if (timeDiff > 10000) {
      stations.forEach((station) => {
        station.isActive = false
      })
    }
  }

  const chars = new Array(stations.length)
  for (let i = 0; i < stations.length; i += 1) {
    if (!validArr?.[i]) {
      chars[i] = 'c'
      continue
    }
    chars[i] = _instToIntensityChar(instArr[i])
  }
  stationData.value = chars

  if (newTimeStr) {
    lastFrameTimeStr = newTimeStr
    niedUpdateTime.value = newTimeStr
  }

  update(tsMs)
}

const handleDecodedPga = (pgaArr, validArr) => {
  if (!niedMaxPgaGal) return
  if (!pgaArr || !validArr) {
    niedMaxPgaGal.value = '?'
    return
  }

  let maxPga = -Infinity
  for (let i = 0; i < pgaArr.length; i += 1) {
    if (!validArr[i]) continue
    const v = Number(pgaArr[i])
    if (!Number.isFinite(v) || v < 0) continue
    if (v > maxPga) maxPga = v
  }

  if (!Number.isFinite(maxPga) || maxPga === -Infinity) {
    niedMaxPgaGal.value = '?'
  } else {
    niedMaxPgaGal.value = (Math.round(maxPga * 10) / 10).toFixed(1)
  }
}

const _pollOnce = async () => {
  if (!worker || !points.value.length || !stations.length) return

  // 長時間運用でのメモリ増大を抑えるため、pollの重なりを禁止する
  if (pollInFlight) return
  pollInFlight = true

  // Web版は古いfetchを中断できるようにする（Tauriはplugin側制約で無効）
  const canAbort = !(typeof window !== 'undefined' && window.__TAURI__)
  if (canAbort) {
    try { lastAbortController?.abort?.() } catch {}
    lastAbortController = new AbortController()
  }
  const signal = canAbort ? lastAbortController.signal : undefined

  try {

  // リプレイ: displaySeisNet.delay (分) が >0 のときは、ターゲット時刻の画像を引く
  if (delayMs.value > 0) {
    const targetMs = Math.floor((timeStore.getTimeStamp() - delayMs.value) / 1000) * 1000
    const { yyyymmdd, yyyymmddhhmmss } = _formatJstKey(targetMs)
    const shindoUrl = `${proxyBase.value}/data/map_img/RealTimeImg/jma_s/${yyyymmdd}/${yyyymmddhhmmss}.jma_s.gif?_=${Date.now()}`
    const pgaUrl = `${proxyBase.value}/data/map_img/RealTimeImg/acmap_s/${yyyymmdd}/${yyyymmddhhmmss}.acmap_s.gif?_=${Date.now()}`
    const [shindoBlob, pgaBlob] = await Promise.all([_fetchBlob(shindoUrl, signal), _fetchBlob(pgaUrl, signal)])
    const [shindoBitmap, pgaBitmap] = await Promise.all([createImageBitmap(shindoBlob), createImageBitmap(pgaBlob)])
    worker.postMessage({ type: 'decode', mode: 'shindo', imageBitmap: shindoBitmap, tsMs: targetMs }, [shindoBitmap])
    worker.postMessage({ type: 'decode', mode: 'pga', imageBitmap: pgaBitmap, tsMs: targetMs }, [pgaBitmap])
    try { shindoBitmap.close?.() } catch {}
    try { pgaBitmap.close?.() } catch {}
    return
  }

  // 通常: latest.json で最新フレームの時刻を取得
  const latestUrl = `${proxyBase.value}/webservice/server/pros/latest.json?_=${Date.now()}`
  const latest = await _fetchJson(latestUrl, signal)
  const latestTime = String(latest?.latest_time || '')
  if (!latestTime) return

  // latest_time: YYYY/MM/DD HH:MM:SS
  const [datePart, timePart] = latestTime.split(' ')
  const yyyymmdd = datePart.replaceAll('/', '')
  const hhmmss = (timePart || '').replaceAll(':', '')
  if (yyyymmdd.length !== 8 || hhmmss.length !== 6) return
  const yyyymmddhhmmss = `${yyyymmdd}${hhmmss}`

  const shindoUrl = `${proxyBase.value}/data/map_img/RealTimeImg/jma_s/${yyyymmdd}/${yyyymmddhhmmss}.jma_s.gif?_=${Date.now()}`
  const pgaUrl = `${proxyBase.value}/data/map_img/RealTimeImg/acmap_s/${yyyymmdd}/${yyyymmddhhmmss}.acmap_s.gif?_=${Date.now()}`
  const [shindoBlob, pgaBlob] = await Promise.all([_fetchBlob(shindoUrl, signal), _fetchBlob(pgaUrl, signal)])
  const [shindoBitmap, pgaBitmap] = await Promise.all([createImageBitmap(shindoBlob), createImageBitmap(pgaBlob)])

  const tsMs = Date.parse(latestTime.replaceAll('/', '-').replace(' ', 'T') + '+09:00')
  worker.postMessage({ type: 'decode', mode: 'shindo', imageBitmap: shindoBitmap, tsMs }, [shindoBitmap])
  worker.postMessage({ type: 'decode', mode: 'pga', imageBitmap: pgaBitmap, tsMs }, [pgaBitmap])
  try { shindoBitmap.close?.() } catch {}
  try { pgaBitmap.close?.() } catch {}
  }
  finally {
    pollInFlight = false
  }
}

const start = async () => {
  // points
  const res = await fetch(`${import.meta.env.BASE_URL}resources/kmoni_points.json?_=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('kmoni_points.json not found')
  const loaded = await res.json()
  points.value = Array.isArray(loaded) ? loaded : []

  stationList = points.value.map((p) => [p.lat, p.lon])
  stationData.value = Array(stationList.length).fill('c')
  stations.length = 0
  adjStationIds = {}
  expireSeconds = {}
  distMatrix = [[]]

  if (stationList.length > 0) {
    const latLngs = stationList.map((ll) => L.latLng(ll))
    for (let i = 0; i < stationList.length; i += 1) {
      const distances = []
      let candidate = { id: null, distance: 40 }
      distMatrix[i] = []
      for (let j = 0; j < stationList.length; j += 1) {
        let distance
        if (j < i) distance = distMatrix[j][i]
        else if (j === i) distance = 0
        else distance = latLngs[i].distanceTo(latLngs[j]) / 1000
        distMatrix[i][j] = distance
        if (distance <= 30) distances.push({ id: j, distance })
        else if (distance <= candidate.distance) candidate = { id: j, distance }
      }
      if (distances.length <= 1 && candidate.id !== null) distances.push(candidate)
      distances.sort((a, b) => a.distance - b.distance).splice(nearbyLength)
      adjStationIds[i] = distances.map((obj) => obj.id)
      const maxDist = distances[distances.length - 1].distance
      expireSeconds[i] = Math.max(Math.round(maxDist / 3.5), 5)
    }
    stationList.forEach((latLng, index) => {
      const station = reactive(new NiedStation(map, index, latLng, 'c', expireSeconds[index]))
      stations.push(station)
    })
    if (niedMarkerCount) niedMarkerCount.value = stations.length
  }

  // reset
  periodMaxLevel = -1
  niedMaxShindo.value = getShindoFromLevel(-1)
  if (niedMaxPgaGal) niedMaxPgaGal.value = '?'
  niedPeriodMaxShindo.value = getShindoFromLevel(-1)
  niedPeriodBarClass.value = 'gray'
  lastFrameTimeStr = null

  _ensureWorker()

  const tick = async () => {
    try {
      await _pollOnce()
    } catch {
      // ignore
    }
    timer = setTimeout(tick, 1000)
  }
  tick()
}

onMounted(() => {
  document.addEventListener('visibilitychange', _onVisibilityChange)
})

let unwatchMap = null
let unwatchGrids = null
let unwatchRender = null

unwatchMap = watch(
  () => statusStore.map,
  async (newVal) => {
    if (!newVal) return
    map = newVal
    try {
      await start()
    } catch {
      // ignore
    }

    map.on('zoomend', renderAll)
    unwatchGrids = watch(
      grids,
      (newGrids) => {
        let maxLevel = -1
        let maxColor = 'gray'
        for (const key in newGrids) {
          const item = newGrids[key]
          const color = item.level <= 7 ? 'green' : item.level <= 13 ? 'yellow' : 'red'
          if (item.level > maxLevel) {
            maxLevel = item.level
            maxColor = color
          }
          if (!(key in gridRects)) {
            const layer = L.rectangle([item.latLng.map((l) => l - 0.495), item.latLng.map((l) => l + 0.495)], {
              color,
              weight: 2,
              fill: false,
              pane: 'niedGridPane',
              interactive: false,
            }).addTo(map)
            gridRects[key] = { color, layer }
          } else if (gridRects[key].color !== color) {
            gridRects[key].color = color
            gridRects[key].layer.setStyle({ color })
          }
          if (item.level > periodMaxLevel) periodMaxLevel = item.level
        }
        for (const key in gridRects) {
          if (!(key in newGrids)) {
            if (map.hasLayer(gridRects[key].layer)) map.removeLayer(gridRects[key].layer)
            delete gridRects[key]
          }
        }
        niedPeriodMaxShindo.value = getShindoFromLevel(periodMaxLevel)
        niedPeriodBarClass.value = maxColor
        const nextActive = Object.keys(newGrids).length > 0
        if (!nextActive) _resetNiedHypo()
        statusStore.isActive.niedNet = nextActive
      },
      { immediate: true }
    )
    unwatchRender = watch(
      () => `${settingsStore.mainSettings.displaySeisNet.style}
            |${settingsStore.mainSettings.displaySeisNet.displayNiedShindo}
            |${settingsStore.mainSettings.displaySeisNet.hideNoData}
            |${simpleIcon.value}
            |${settingsStore.mainSettings.displaySeisNet.displayShindo0}`,
      renderAll
    )
  },
  { immediate: true }
)

watch(
  () => statusStore.isActive.jmaEew || statusStore.isActive.niedNet,
  (newVal) => {
    if (newVal) {
      if (periodMaxLevel === -1) {
        periodMaxLevel = 0
        niedPeriodMaxShindo.value = getShindoFromLevel(periodMaxLevel)
      }
    } else {
      periodMaxLevel = -1
      niedPeriodMaxShindo.value = getShindoFromLevel(periodMaxLevel)
    }
  },
  { immediate: true }
)

watch(() => Object.keys(grids.value).length, smartSetView)

let shake1Notified = false
let shake2Notified = false
let focused = false
watch(currentMaxShindo, (newVal, oldVal) => {
  if (newVal > oldVal) {
    if (settingsStore.mainSettings.onShake.sound) {
      const type = `shindo${newVal}`
      playSound(type)
    }
    if (settingsStore.mainSettings.onShake.notification) {
      if (newVal >= 1 && newVal <= 3 && !shake1Notified) {
        sendMyNotification('揺れを検出', '揺れに注意してください。', iconUrls.caution, settingsStore.mainSettings.muteNotification)
        shake1Notified = true
      } else if (newVal >= 4 && !shake2Notified) {
        sendMyNotification('強い揺れを検出', '強い揺れに警戒してください。', iconUrls.warn, settingsStore.mainSettings.muteNotification)
        shake1Notified = true
        shake2Notified = true
      }
    }
    if (settingsStore.mainSettings.onShake.focus) {
      if (newVal >= 1 && !focused) {
        focusWindow()
        focused = true
      }
    }
    handleTempEqlists?.(0)
  } else {
    shake1Notified = false
    shake2Notified = false
    focused = false
  }
})

watch(
  () => settingsStore.mainSettings.displaySeisNet.delay,
  () => {
    // リプレイ時刻を変えたら、揺れ検知/期間最大/時刻差分の蓄積をリセット
    periodMaxLevel = -1
    niedPeriodMaxShindo.value = getShindoFromLevel(periodMaxLevel)
    niedPeriodBarClass.value = 'gray'
    statusStore.isActive.niedNet = false

    if (niedMaxPgaGal) niedMaxPgaGal.value = '?'

    shake1Notified = false
    shake2Notified = false
    focused = false
    lastFrameTimeStr = null
    _resetNiedHypo(true)

    stations.forEach((station) => {
      if (!station) return
      station.isActive = false
      station.recentLevel = []
      station.expireSeconds = station.defaultExpireSeconds
      station.update('c', true)
    })
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  try { lastAbortController?.abort?.() } catch {}
  try { document.removeEventListener('visibilitychange', _onVisibilityChange) } catch {}
  if (unwatchMap) unwatchMap()
  if (unwatchGrids) unwatchGrids()
  if (unwatchRender) unwatchRender()
  if (timer) clearTimeout(timer)
  if (map !== null) map.off('zoomend', renderAll)
  stations.forEach((station, index) => {
    station.terminate()
    stations[index] = null
  })
  stations.length = 0
  if (map) {
    map.eachLayer((layer) => {
      if (layer?.options?.pane === 'niedGridPane' || String(layer?.options?.pane || '').includes('niedStationPane')) {
        map.removeLayer(layer)
      }
    })
  }
  _resetNiedHypo(true)
  if (niedMarkerCount) niedMarkerCount.value = 0
  if (worker) worker.terminate()
  worker = null
})
</script>
