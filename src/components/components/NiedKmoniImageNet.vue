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
import { getLevelFromInstShindo, stampToTime, playSound, sendMyNotification, calcTimeDiff, focusWindow, getShindoFromLevel } from '@/utils/Utils'
import { NiedStation, simpleIcon } from '@/classes/StationClasses'

const statusStore = useStatusStore()
const settingsStore = useSettingsStore()
const timeStore = useTimeStore()

const niedMaxShindo = inject('niedMaxShindo')
const niedUpdateTime = inject('niedUpdateTime')
const niedPeriodMaxShindo = inject('niedPeriodMaxShindo')
const niedPeriodBarClass = inject('niedPeriodBarClass')
const niedMarkerCount = inject('niedMarkerCount')
const handleTempEqlists = inject('handleTempEqlists')
const smartSetView = inject('smartSetView')

const points = ref([]) // [{lat, lon, x, y, suspended}]

let stationList = []
const stationData = ref([]) // intensity chars
const stations = reactive([]) // NiedStation[]

let map = null
let worker = null
let timer = null

const proxyBase = computed(() => (import.meta.env.DEV ? '/kmoni' : 'http://www.kmoni.bosai.go.jp'))
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

const update = () => {
  if (stationList.length === stations.length && stations.length === stationData.value.length) {
    const render = document.visibilityState === 'visible'
    if (!render) pendingRender = true
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
    activeSet.forEach((station) => station.setActive())
  }
}

const renderAll = () => {
  stations.forEach((station) => station?.render?.())
}

const _fetchJson = async (url) => {
  // TauriではCORS回避のため plugin-http を使う
  if (typeof window !== 'undefined' && window.__TAURI__) {
    return await Http.tauriGet(url)
  }
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`)
  return await res.json()
}

const _fetchBlob = async (url) => {
  if (typeof window !== 'undefined' && window.__TAURI__) {
    const res = await tauriFetch(url, { method: 'GET', connectTimeout: 15000 })
    const ab = await res.arrayBuffer()
    return new Blob([ab])
  }
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`)
  return await res.blob()
}

const _ensureWorker = () => {
  if (worker) return
  worker = new Worker(new URL('../../workers/kmoni-gif-decoder.js', import.meta.url), { type: 'module' })
  worker.onmessage = (ev) => {
    const { type } = ev.data || {}
    if (type === 'decoded') {
      const { inst, valid, tsMs } = ev.data
      handleDecoded(inst, valid, tsMs)
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

  update()
}

const _pollOnce = async () => {
  if (!worker || !points.value.length || !stations.length) return

  // リプレイ: displaySeisNet.delay (分) が >0 のときは、ターゲット時刻の画像を引く
  if (delayMs.value > 0) {
    const targetMs = Math.floor((timeStore.getTimeStamp() - delayMs.value) / 1000) * 1000
    const { yyyymmdd, yyyymmddhhmmss } = _formatJstKey(targetMs)
    const gifUrl = `${proxyBase.value}/data/map_img/RealTimeImg/jma_s/${yyyymmdd}/${yyyymmddhhmmss}.jma_s.gif?_=${Date.now()}`
    const blob = await _fetchBlob(gifUrl)
    const imageBitmap = await createImageBitmap(blob)
    worker.postMessage({ type: 'decode', imageBitmap, tsMs: targetMs }, [imageBitmap])
    return
  }

  // 通常: latest.json で最新フレームの時刻を取得
  const latestUrl = `${proxyBase.value}/webservice/server/pros/latest.json?_=${Date.now()}`
  const latest = await _fetchJson(latestUrl)
  const latestTime = String(latest?.latest_time || '')
  if (!latestTime) return

  // latest_time: YYYY/MM/DD HH:MM:SS
  const [datePart, timePart] = latestTime.split(' ')
  const yyyymmdd = datePart.replaceAll('/', '')
  const hhmmss = (timePart || '').replaceAll(':', '')
  if (yyyymmdd.length !== 8 || hhmmss.length !== 6) return
  const yyyymmddhhmmss = `${yyyymmdd}${hhmmss}`

  const gifUrl = `${proxyBase.value}/data/map_img/RealTimeImg/jma_s/${yyyymmdd}/${yyyymmddhhmmss}.jma_s.gif?_=${Date.now()}`
  const blob = await _fetchBlob(gifUrl)
  const imageBitmap = await createImageBitmap(blob)

  const tsMs = Date.parse(latestTime.replaceAll('/', '-').replace(' ', 'T') + '+09:00')
  worker.postMessage({ type: 'decode', imageBitmap, tsMs }, [imageBitmap])
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
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && pendingRender) {
      pendingRender = false
      renderAll()
    }
  })
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
        statusStore.isActive.niedNet = Object.keys(newGrids).length > 0
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

    shake1Notified = false
    shake2Notified = false
    focused = false
    lastFrameTimeStr = null

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
  if (niedMarkerCount) niedMarkerCount.value = 0
  if (worker) worker.terminate()
  worker = null
})
</script>
