<template>
  <div />
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, inject } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { useStatusStore } from '@/stores/status'
import { useSettingsStore } from '@/stores/settings'
import { isTauri as getIsTauri } from '@tauri-apps/api/core'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { computeNiedStyleColorRadius, getShindoLeafletIcon } from '@/classes/StationClasses'
import { getShindoFromLevel } from '@/utils/Utils'

const statusStore = useStatusStore()
const settingsStore = useSettingsStore()

const emsdMarkerCount = inject('emsdMarkerCount', ref(0))
const emsdUpdateTime = inject('emsdUpdateTime', ref('1970-01-01 00:00:00'))
const emsdMaxShindo = inject('emsdMaxShindo', ref('?'))
const emsdMaxPgaGal = inject('emsdMaxPgaGal', ref('?'))

const isTauri = getIsTauri()
const emsdBase = computed(() => (import.meta.env.DEV ? '/emsd' : 'https://glob.emsd.ru'))

let map = null
let zoomListenerAttached = false
let scheduleTimer = null
let inFlight = false

let emsdRenderer = null

// stationKey -> { markerType: 'circle'|'icon', marker: Layer, level, pgaGal, pgvCms, latLng }
const markers = new Map()

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const lerp = (a, b, t) => a + (b - a) * t
const rgbToHex = (rgb) => {
  const to2 = (n) => Math.round(n).toString(16).padStart(2, '0')
  return `#${to2(rgb[0])}${to2(rgb[1])}${to2(rgb[2])}`
}

// JMA震度(表示ラベル)に準じた段階（pane順序用）
const shindoLabelToLevel = (label) => {
  switch (label) {
    case '0': return 0
    case '1': return 8
    case '2': return 10
    case '3': return 12
    case '4': return 14
    case '5-': return 16
    case '5+': return 17
    case '6-': return 18
    case '6+': return 19
    case '7': return 20
    default: return -1
  }
}

// --- P-Alertの震度換算（閾値）を踏襲 ---

// PGA[gal] -> 震度ラベル
const pgaToShindoLabel = (pgaGal) => {
  const v = Number(pgaGal)
  if (!Number.isFinite(v) || v <= 0) return '0'
  if (v < 0.8) return '0'
  if (v < 2.5) return '1'
  if (v < 8.0) return '2'
  if (v < 25) return '3'
  if (v < 80) return '4'
  if (v < 140) return '5-'
  if (v < 250) return '5+'
  if (v < 440) return '6-'
  if (v < 800) return '6+'
  return '7'
}

const pgvToShindoLabel = (pgvCms) => {
  const v = Number(pgvCms)
  if (!Number.isFinite(v) || v <= 0) return '0'
  if (v < 0.2) return '0'
  if (v < 0.7) return '1'
  if (v < 1.9) return '2'
  if (v < 5.7) return '3'
  if (v < 15) return '4'
  if (v < 30) return '5-'
  if (v < 50) return '5+'
  if (v < 80) return '6-'
  if (v < 140) return '6+'
  return '7'
}

const estimatePgvFromPga = (pgaGal) => {
  const v = Number(pgaGal)
  if (!Number.isFinite(v) || v <= 0) return 0
  return v / 5.6
}

const pgaPgvToLevel = (pgaGal, pgvCms) => {
  const pgaLabel = pgaToShindoLabel(pgaGal)
  const pgaLevel = shindoLabelToLevel(pgaLabel)
  if (pgaLevel < 0) return -1
  if (pgaLevel <= 15) return pgaLevel

  const pgvEff = (Number.isFinite(Number(pgvCms)) && Number(pgvCms) > 0)
    ? Number(pgvCms)
    : estimatePgvFromPga(pgaGal)
  const pgvLabel = pgvToShindoLabel(pgvEff)
  return shindoLabelToLevel(pgvLabel)
}

const shouldUseShindoIconMarker = (level, zoom) => {
  if (zoom < 4) return false
  // 要望: 震度1以上でアイコン
  return level >= 8
}

const _decodeUtf8 = (ab) => {
  try {
    return new TextDecoder('utf-8').decode(ab)
  } catch {
    return ''
  }
}

const _fetchCsv = async () => {
  const baseUrl = emsdBase.value
  const url = `${baseUrl}/media/ddv/msk_1h.csv?t=${Date.now()}`

  if (isTauri) {
    const res = await tauriFetch(`https://glob.emsd.ru/media/ddv/msk_1h.csv?t=${Date.now()}`, {
      method: 'GET',
      connectTimeout: 15000,
      headers: {
        Origin: 'https://glob.emsd.ru',
        Referer: 'https://glob.emsd.ru/media/ddv/msk_1h.htm',
      },
    })
    const ab = await res.arrayBuffer()
    let lastModified = null
    try {
      // plugin-http headers shape can vary; best-effort extraction
      const h = res.headers
      lastModified = (typeof h?.get === 'function' ? h.get('last-modified') : null)
        ?? h?.['last-modified']
        ?? h?.['Last-Modified']
        ?? null
    } catch {}
    return { text: _decodeUtf8(ab), lastModified }
  }

  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`)
  const text = await res.text()
  const lastModified = res.headers?.get?.('last-modified') ?? null
  return { text, lastModified }
}

const _parseCsv = (text) => {
  const rows = []
  const lines = String(text || '').split(/\r?\n/)
  for (const line of lines) {
    const s = line.trim()
    if (!s) continue
    const cols = s.split(';')
    // EMSD msk_1h.htm expects at least 10 columns:
    // 0 sta, 1 net, 2 chan, 3 lat, 4 lon, 5 sens, 6 pga, 7 pgv, 8 pex, 9 praw
    if (cols.length < 10) continue

    const code = String(cols[0] || '').trim()
    const net = String(cols[1] || '').trim()
    const chan = String(cols[2] || '').trim()
    const lat = Number(cols[3])
    const lon = Number(cols[4])
    const sens = Number(cols[5])
    const pga0 = Number(cols[6])
    const pgv0 = Number(cols[7])

    if (!code || !net) continue
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue

    // Follow the reference implementation (msk_1h.htm) to reduce false positives.
    // - drop *355 stations
    // - drop IU network
    // - require HNE channel
    // - require valid sensitivity
    if (code.length >= 5 && code.slice(2) === '355') continue
    if (net.startsWith('IU')) continue
    if (chan.slice(3) !== 'HNE') continue
    if (!Number.isFinite(sens) || sens < 0.01) continue
    if (!Number.isFinite(pga0) || !Number.isFinite(pgv0)) continue
    if (pga0 <= 0 || pgv0 <= 0) continue

    // msk_1h.htm does: value *= 100 / sens
    const pgaGal = (pga0 * 100) / sens
    const pgvCms = (pgv0 * 100) / sens

    if (!Number.isFinite(pgaGal) || !Number.isFinite(pgvCms)) continue

    rows.push({ key: `${code}_${net}`, code, net, lat, lon, pgaGal, pgvCms })
  }
  return rows
}

const _clearAll = () => {
  if (map) {
    for (const obj of markers.values()) {
      try {
        if (obj?.marker && map.hasLayer(obj.marker)) map.removeLayer(obj.marker)
      } catch {}
    }
  }
  markers.clear()
  emsdMarkerCount.value = 0
  try { statusStore.isActive.emsdNet = false } catch {}
}

const _renderAll = () => {
  if (!map) return
  // P-Alert同様: zoom変化でcircle半径/アイコン更新
  for (const [key, obj] of markers.entries()) {
    try {
      ensureMarker(key, obj?.level ?? -1, obj?.pgaGal ?? 0, obj?.pgvCms ?? 0, obj?.latLng ?? null, true)
    } catch {}
  }
}

const ensureMarker = (key, level, pgaGal, pgvCms, latLng, forceUpdate = false) => {
  if (!map) return
  const existing = markers.get(key)
  const zoom = map.getZoom()

  const wantIcon = shouldUseShindoIconMarker(level, zoom)

  const createIconMarker = (latLng) => {
    const shindo = getShindoFromLevel(level)
    const icon = getShindoLeafletIcon(shindo, zoom)
    if (!icon) return null
    return L.marker(latLng, {
      icon,
      pane: 'emsdStationPane0',
      interactive: true,
    })
  }

  const createCircleMarker = (latLng, pgaGal) => {
    let color
    let radius
    if (!Number.isFinite(pgaGal) || pgaGal <= 0) {
      const rc = computeNiedStyleColorRadius(level, zoom)
      radius = rc.radius
      color = settingsStore.mainSettings.displaySeisNet.hideNoData ? '#cfcfcf00' : '#cfcfcf'
    } else {
      const capped = Math.min(0.7, Number(pgaGal))
      const idx = Math.min(7, Math.floor((capped / 0.7) * 8))
      const rc = computeNiedStyleColorRadius(idx, zoom, { style: 'nied', hideNoData: false })
      radius = rc.radius
      color = rc.color
    }

    return L.circleMarker(latLng, {
      radius,
      opacity: 1,
      fillOpacity: 1,
      color,
      fillColor: color,
      weight: 0,
      pane: 'emsdStationPane0',
      renderer: emsdRenderer ?? undefined,
      interactive: true,
    })
  }

  const replaceMarker = (markerType, latLng, newMarker, pgaGal) => {
    if (!newMarker) return
    if (existing?.marker) {
      try {
        if (map.hasLayer(existing.marker)) map.removeLayer(existing.marker)
      } catch {}
    }
    const obj = existing ?? { markerType: null, marker: null, level: -1, pgaGal: 0, pgvCms: 0, latLng: null }
    obj.markerType = markerType
    obj.marker = newMarker
    obj.level = level
    obj.pgaGal = pgaGal
    obj.pgvCms = pgvCms
    obj.latLng = latLng
      // store discrete PGA index to detect color-only changes
      if (!Number.isFinite(pgaGal) || pgaGal <= 0) obj._pgaIdx = -1
      else obj._pgaIdx = Math.min(7, Math.floor((Math.min(0.7, Number(pgaGal)) / 0.7) * 8))
    markers.set(key, obj)
    try { newMarker.addTo(map) } catch {}
  }

  const updateTooltip = (marker, latLng) => {
    const shindo = getShindoFromLevel(level)
    const tooltip = `EMSD DDV\n${key}\nShindo ${shindo}\nPGA ${Number(pgaGal).toFixed(1)} gal\nPGV ${Number(pgvCms).toFixed(2)} cm/s`
    try {
      marker.bindTooltip(tooltip, { direction: 'top', className: 'custom-tooltip' })
    } catch {}
  }

  const nextLatLng = latLng ?? existing?.latLng
  if (!nextLatLng) return

  // create (or recover from missing marker)
  if (!existing || !existing.marker) {
    if (wantIcon) {
      const m = createIconMarker(nextLatLng)
      if (m) {
        replaceMarker('icon', nextLatLng, m)
        updateTooltip(m, nextLatLng)
        return
      }
    }
    const cm = createCircleMarker(nextLatLng, pgaGal)
    replaceMarker('circle', nextLatLng, cm, pgaGal)
    updateTooltip(cm, nextLatLng)
    return
  }

  // no-op
    // no-op: also skip when PGA色インデックスが変わっていない
    const pgaIdx = (!Number.isFinite(pgaGal) || pgaGal <= 0) ? -1 : Math.min(7, Math.floor((Math.min(0.7, Number(pgaGal)) / 0.7) * 8))
    if (!forceUpdate && existing.level === level && ((existing.markerType === 'icon') === wantIcon) && existing._pgaIdx === pgaIdx) return

  // switch type
  if ((existing.markerType === 'icon') !== wantIcon) {
    if (wantIcon) {
      const m = createIconMarker(nextLatLng)
      if (m) {
        replaceMarker('icon', nextLatLng, m)
        updateTooltip(m, nextLatLng)
        return
      }
    }
    const cm = createCircleMarker(nextLatLng, pgaGal)
    replaceMarker('circle', nextLatLng, cm, pgaGal)
    updateTooltip(cm, nextLatLng)
    return
  }

  // update same type
  existing.level = level
  existing.pgaGal = pgaGal
  existing.pgvCms = pgvCms
    existing._pgaIdx = -1
  try { existing.marker.setLatLng(nextLatLng) } catch {}

  if (existing.markerType === 'icon') {
    try {
      const shindo = getShindoFromLevel(level)
      const icon = getShindoLeafletIcon(shindo, zoom)
      if (icon) existing.marker.setIcon(icon)
    } catch {}
  } else {
    let radius
    let color
    if (!Number.isFinite(pgaGal) || pgaGal <= 0) {
      const rc = computeNiedStyleColorRadius(level, zoom)
      radius = rc.radius
      color = settingsStore.mainSettings.displaySeisNet.hideNoData ? '#cfcfcf00' : '#cfcfcf'
      existing._pgaIdx = -1
    } else {
      const capped = Math.min(0.7, Number(pgaGal))
      const idx = Math.min(7, Math.floor((capped / 0.7) * 8))
      const rc = computeNiedStyleColorRadius(idx, zoom, { style: 'nied', hideNoData: false })
      radius = rc.radius
      color = rc.color
      existing._pgaIdx = idx
    }
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

  updateTooltip(existing.marker, nextLatLng)
}

const _applyRows = (rows) => {
  if (!map) return

  const nextKeys = new Set(rows.map(r => r.key))
  for (const [key, obj] of markers.entries()) {
    if (!nextKeys.has(key)) {
      try {
        if (obj?.marker && map.hasLayer(obj.marker)) map.removeLayer(obj.marker)
      } catch {}
      markers.delete(key)
    }
  }

  let hasAny = false
  let maxLevel = -1
  let maxPga = 0

  for (const row of rows) {
    hasAny = true
    const level = pgaPgvToLevel(row.pgaGal, row.pgvCms)
    const latLng = [row.lat, row.lon]

    if (Number.isFinite(level)) maxLevel = Math.max(maxLevel, level)
    if (Number.isFinite(row.pgaGal)) maxPga = Math.max(maxPga, row.pgaGal)

    // create/update actual marker
    ensureMarker(row.key, level, row.pgaGal, row.pgvCms, latLng, false)
  }

  // stats for UI (MainMap)
  try {
    emsdMaxShindo.value = hasAny ? getShindoFromLevel(maxLevel) : '?'
    emsdMaxPgaGal.value = hasAny ? String(Number(maxPga).toFixed(1)) : '?'
  } catch {
    emsdMaxShindo.value = '?'
    emsdMaxPgaGal.value = '?'
  }

  // count currently displayed markers
  emsdMarkerCount.value = markers.size
  statusStore.isActive.emsdNet = hasAny
}

const _tick = async () => {
  if (inFlight) return
  inFlight = true
  try {
    const { text, lastModified } = await _fetchCsv()
    const rows = _parseCsv(text)
    _applyRows(rows)

    // update time (UTC)
    try {
      const d = lastModified ? new Date(lastModified) : new Date()
      const use = Number.isFinite(d.getTime()) ? d : new Date()
      emsdUpdateTime.value = use.toISOString().slice(0, 19).replace('T', ' ')
    } catch {}
  } catch (e) {
    // 通信失敗時は既存表示を維持し、activeは落とす
    try { statusStore.isActive.emsdNet = false } catch {}
  } finally {
    inFlight = false
  }
}

const _computeNextDelayMs = () => {
  // Server updates roughly once per minute. Fetch shortly after the next minute boundary.
  const now = Date.now()
  const msToNextMinute = 60_000 - (now % 60_000)
  return Math.max(2_000, msToNextMinute + 4_000)
}

const _clearSchedule = () => {
  if (scheduleTimer) {
    try { clearTimeout(scheduleTimer) } catch {}
  }
  scheduleTimer = null
}

const _scheduleTick = (delayMs = 0) => {
  _clearSchedule()
  scheduleTimer = setTimeout(async () => {
    if (!settingsStore.mainSettings.displaySeisNet.emsdNet) return
    await _tick()
    _scheduleTick(_computeNextDelayMs())
  }, Math.max(0, Number(delayMs) || 0))
}

onMounted(() => {
  // 60s-based update, but fetch as soon as possible after each server update.
  if (settingsStore.mainSettings.displaySeisNet.emsdNet) _scheduleTick(0)
})

onBeforeUnmount(() => {
  _clearSchedule()

  if (map && zoomListenerAttached) {
    try { map.off('zoomend', _renderAll) } catch {}
  }
  zoomListenerAttached = false

  _clearAll()
  map = null
})

watch(
  () => statusStore.map,
  (newVal) => {
    if (!newVal) return
    map = newVal
    if (!emsdRenderer) {
      try { emsdRenderer = L.canvas({ padding: 0.5, pane: 'emsdStationPane0' }) } catch {}
    }
    if (!zoomListenerAttached) {
      zoomListenerAttached = true
      try { map.on('zoomend', _renderAll) } catch {}
    }
    _renderAll()
  },
  { immediate: true }
)

watch(
  () => settingsStore.mainSettings.displaySeisNet.emsdNet,
  (enabled) => {
    if (!enabled) {
      _clearSchedule()
      _clearAll()
      return
    }
    _scheduleTick(0)
  },
  { immediate: true }
)

watch(
  () => settingsStore.mainSettings.displaySeisNet.hideNoData,
  () => {
    // 色のno-data挙動が変わるため再描画
    _renderAll()
  }
)
</script>
