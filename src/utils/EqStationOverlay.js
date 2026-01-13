import L from 'leaflet'
import { getShindoLeafletIcon, getIntensityLeafletIcon, computeNiedStyleColorRadius } from '@/classes/StationClasses'
import { getShindoFromInstShindo } from '@/utils/Utils'
import { useSettingsStore } from '@/stores/settings'

let _stationsCache = null
const loadStations = async () => {
    if (_stationsCache) return _stationsCache
    // try common public paths
    const candidates = ['/json/stations.json', '/stations.json', '/dist/json/stations.json']
    for (const url of candidates) {
        try {
            const res = await fetch(url, { cache: 'no-store' })
            if (!res.ok) continue
            const data = await res.json()
            _stationsCache = Array.isArray(data) ? data : (data?.stations || [])
            console.info(`[EqStationOverlay] loaded ${_stationsCache.length} stations from ${url}`)
            return _stationsCache
        } catch (e) {
            // try next
        }
    }
    _stationsCache = []
    return _stationsCache
}

const _valToStr = (v) => {
    if (v === null || v === undefined) return ''
    if (typeof v === 'string') return v
    if (typeof v === 'number') return String(v)
    if (typeof v === 'object') {
        // prefer common name fields
        return String(v.name || v.station || v.pref || v.addr || v.region || '')
    }
    return String(v)
}

// find a points array anywhere inside the eqMessage object
const findPointsArray = (obj) => {
    if (!obj || typeof obj !== 'object') return null
    const seen = new Set()
    const stack = [obj]
    while (stack.length) {
        const cur = stack.pop()
        if (!cur || typeof cur !== 'object') continue
        if (seen.has(cur)) continue
        seen.add(cur)
        if (Array.isArray(cur.points) && cur.points.length > 0) return cur.points
        for (const k of Object.keys(cur)) {
            try { stack.push(cur[k]) } catch (e) {}
        }
    }
    return null
}

const matchStationsByAreaName = (stations, areaName, opts = {}) => {
    if (!areaName) return []
    const name = String(areaName).trim()
    if (!name) return []
    console.info(`[EqStationOverlay] matching area="${name}" strict=${!!opts.strict}`)
    const out = []
    // detect pattern like '福島県会津' or '京都府南部' => prefPart='福島県', regionPart='会津'
    // Only consider pref+region when NOT in strict(addr) mode
    const m = name.match(/^(.+?[都道府県])(.+)$/)
    const prefRegion = (!opts.strict && m) ? { prefPart: m[1].trim(), regionPart: m[2].trim() } : null
    if (prefRegion) console.info(`[EqStationOverlay] detected pref+region: pref="${prefRegion.prefPart}", region="${prefRegion.regionPart}"`)
    for (const s of stations) {
        if (!s) continue
        const candidates = []
        candidates.push(_valToStr(s.name))
        candidates.push(_valToStr(s.code))
        candidates.push(_valToStr(s.station))
        candidates.push(_valToStr(s.addr))
        if (s.city) candidates.push(_valToStr(s.city.name))
        if (s.pref) candidates.push(_valToStr(s.pref.name))
        if (s.area) candidates.push(_valToStr(s.area.name))
        if (s.region) candidates.push(_valToStr(s.region))
        // also include combined city+name
        if (s.city && s.city.name && s.name) candidates.push(`${s.city.name}${s.name}`)

        // If pref+region pattern detected, restrict by prefecture and region match
        if (prefRegion) {
            const prefName = _valToStr(s.pref && s.pref.name)
            const areaNameField = _valToStr(s.area && s.area.name)
            const cityNameField = _valToStr(s.city && s.city.name)
            const stationNameField = _valToStr(s.name)
            const normalize = (str) => String(str || '').replace(/\s|　|\.|、|，|\(|\)|（|）/g, '')
            const prefN = normalize(prefRegion.prefPart)
            const regionN = normalize(prefRegion.regionPart)
            const prefFieldN = normalize(prefName)
            if (!prefFieldN.includes(prefN)) {
                // prefecture not match, skip
                continue
            }
            // require regionPart to appear in area/city/station name
            if (!(normalize(areaNameField).includes(regionN) || normalize(cityNameField).includes(regionN) || normalize(stationNameField).includes(regionN))) {
                continue
            }
            // passed pref+region filter; treat as strict (only this station)
            out.push(s)
            console.info(`[EqStationOverlay] prefRegion matched station "${stationNameField}" (code=${_valToStr(s.code)})`)
            continue
        }

        // If strict option is set (e.g., JMA point.addr), match ONLY when station.name exactly equals addr (normalized)
        if (opts.strict) {
            const normalize = (str) => String(str || '').replace(/\s|　|\.|、|，|\(|\)|（|）/g, '')
            const nameN = normalize(name)
            const stationName = _valToStr(s.name)
            const stationNameN = normalize(stationName)
            try {
                if (stationNameN && stationNameN === nameN) {
                    out.push(s)
                    console.info(`[EqStationOverlay] strict-exact matched station "${stationName}" (code=${_valToStr(s.code)}) for addr "${name}")`)
                }
            } catch (e) {
                // ignore
            }
        }
        else {
            for (const f of candidates.filter(Boolean)) {
                try {
                    if (f.includes(name) || name.includes(f)) {
                        out.push(s)
                        console.info(`[EqStationOverlay] fuzzy matched station "${_valToStr(s.name)}" (code=${_valToStr(s.code)}) for area "${name}")`)
                        break
                    }
                } catch (e) {
                    // ignore
                }
            }
        }
    }
    if (out.length === 0) console.info(`[EqStationOverlay] no stations matched for area="${name}" (strict=${!!opts.strict})`)
    return out
}

export const showEqStations = async (map, eqMessage) => {
    if (!map || !eqMessage) return null
    try {
        // If hypocenter marker is not present on the map, do not display station markers.
        // This keeps station overlays visible only when the epicenter marker is shown.
        try {
            const lat = Number(eqMessage.lat ?? eqMessage.latitude ?? eqMessage.y ?? (eqMessage.hypocenter && eqMessage.hypocenter.split(',')[0]))
            const lng = Number(eqMessage.lng ?? eqMessage.longitude ?? eqMessage.x ?? (eqMessage.hypocenter && eqMessage.hypocenter.split(',')[1]))
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
                let foundMarker = false
                map.eachLayer(layer => {
                    try {
                        if (layer && layer instanceof L.Marker && typeof layer.getLatLng === 'function') {
                            const p = layer.getLatLng()
                            if (Math.abs(p.lat - lat) < 1e-4 && Math.abs(p.lng - lng) < 1e-4) {
                                // try to determine marker opacity; prefer DOM style if available
                                let opacity = null
                                try {
                                    if (layer._icon && layer._icon.style && layer._icon.style.opacity !== undefined) {
                                        opacity = parseFloat(layer._icon.style.opacity)
                                    }
                                } catch (e) {}
                                try {
                                    if (opacity === null && layer.options && typeof layer.options.opacity === 'number') opacity = layer.options.opacity
                                } catch (e) {}
                                // treat missing opacity as fully opaque
                                opacity = opacity === null ? 1 : opacity
                                // only consider marker present if sufficiently opaque (not semi-transparent)
                                if (opacity >= 0.5) foundMarker = true
                            }
                        }
                    } catch (e) {}
                })
                if (!foundMarker) {
                    // ensure any previous station layer for this message is removed
                    try { if (eqMessage._stationLayer && map.hasLayer(eqMessage._stationLayer)) map.removeLayer(eqMessage._stationLayer) } catch (e) {}
                    eqMessage._stationLayer = null
                    return null
                }
            }
        } catch (e) {}
        const stations = await loadStations()
        if (!stations.length) return null

        // parse warnArea if available
        let areas = []
        try { areas = JSON.parse(eqMessage.warnArea || '[]') } catch (e) { areas = [] }

        // If eqMessage contains a points array (JMA style) anywhere, prefer it
        const foundPoints = findPointsArray(eqMessage)
        let useStrictMatch = false
        console.info(`[EqStationOverlay] foundPoints => ${Array.isArray(foundPoints) ? foundPoints.length : 0}`)
        if (Array.isArray(foundPoints) && foundPoints.length > 0) {
            console.info(`[EqStationOverlay] foundPoints sample: ${foundPoints.map(p => p.addr || p.name).slice(0,5).join(',')}`)
            areas = foundPoints.map(p => ({ name: p.addr || p.name || '', intensity: p.intensity || p.scale || null }))
            useStrictMatch = true
        }
        // Also respect top-level eqMessage.points if present (defensive)
        if (!useStrictMatch && Array.isArray(eqMessage.points) && eqMessage.points.length > 0) {
            console.info(`[EqStationOverlay] eqMessage.points detected at top-level, prefer addr-based matching (${eqMessage.points.length})`)
            areas = eqMessage.points.map(p => ({ name: p.addr || p.name || '', intensity: p.intensity || p.scale || null }))
            useStrictMatch = true
        }
        if (!useStrictMatch) console.info(`[EqStationOverlay] using warnArea (if any): ${eqMessage.warnArea ? 'present' : 'none'}`)

        // per-area strict detection: if area name looks like an addr (contains 市町村郡区 and not 都道府県), treat as strict
        const isAddrLike = (n) => {
            if (!n) return false
            const s = String(n)
            // if contains prefecture kanji it's likely a pref+region, not addr-only
            if (/[都道府県]/.test(s)) return false
            return /[市町村郡区]/.test(s)
        }
        areas = areas.map(a => ({ ...(typeof a === 'string' ? { name: a } : a), strict: useStrictMatch || isAddrLike(a?.name) }))

        const layer = L.layerGroup()
        const settingsStore = useSettingsStore()
        const useShindo = !!eqMessage.useShindo
        const zoom = map.getZoom ? map.getZoom() : 6

        for (const a of areas) {
            console.info(`[EqStationOverlay] processing area entry: "${a.name}" intensity=${a.intensity} strict=${!!a.strict}`)
            const matched = matchStationsByAreaName(stations, a.name, { strict: !!a.strict })
            for (const s of matched) {
                const lat = Number(s.lat ?? s.latitude ?? s.y ?? s.latlng?.[0])
                const lon = Number(s.lon ?? s.longitude ?? s.x ?? s.latlng?.[1])
                if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
                const intensity = a.intensity || a.scale || a.int || null
                let marker
                if (useShindo) {
                    // Prefer NIED/intensity icons when intensity is numeric; otherwise fall back to shindo icons
                    const n = Number(intensity)
                    let icon = null
                    if (Number.isFinite(n)) {
                        // JMA points.scale is in tenths (e.g., 10 -> 1.0).
                        // Map to shindo label and use shindo icons instead of int icons.
                        const v = n / 10
                        const shindo = getShindoFromInstShindo(v)
                        icon = getShindoLeafletIcon(shindo, zoom)
                    }
                    if (!icon) {
                        const shindo = String(intensity || '0')
                        icon = getShindoLeafletIcon(shindo, zoom)
                    }
                    if (icon && typeof icon.createIcon === 'function') {
                        marker = L.marker([lat, lon], { icon })
                    } else {
                        // fallback to colored circle if no icon available
                        const level = Number.isFinite(n) ? Math.max(-1, Math.floor(n) - 1) : -1
                        const style = computeNiedStyleColorRadius(level, zoom)
                        marker = L.circleMarker([lat, lon], {
                            radius: style?.radius || 3,
                            color: style?.color || '#999999',
                            fillColor: style?.color || '#999999',
                            weight: 0,
                            fillOpacity: 1,
                        })
                    }
                } else {
                    // fallback: draw a colored circle based on intensity
                    const n = Number(intensity)
                    const level = Number.isFinite(n) ? Math.max(-1, Math.floor(n) - 1) : -1
                    const style = computeNiedStyleColorRadius(level, zoom)
                    marker = L.circleMarker([lat, lon], {
                        radius: style?.radius || 3,
                        color: style?.color || '#999999',
                        fillColor: style?.color || '#999999',
                        weight: 0,
                        fillOpacity: 1,
                    })
                }
                // display: convert numeric intensity (e.g., 10) -> 震度 = 10/10 = 1.0
                const displayShindo = (() => {
                    const n = Number(intensity)
                    if (Number.isFinite(n)) {
                        const v = (n / 10)
                        // show one decimal unless .0
                        const fmt = v % 1 === 0 ? String(v) : v.toFixed(1)
                        return fmt
                    }
                    if (typeof intensity === 'string' && intensity) return intensity
                    return '不明'
                })()
                marker.bindTooltip(`${s.name || s.station || ''}\n${a.name || ''}\n震度: ${displayShindo}`, { direction: 'top' })
                marker.addTo(layer)
            }
        }

        layer.addTo(map)
        // attach to eqMessage for later removal
        try { eqMessage._stationLayer && map.removeLayer(eqMessage._stationLayer) } catch (e) {}
        eqMessage._stationLayer = layer
        return layer
    } catch (e) {
        console.error('showEqStations failed', e)
        return null
    }
}

export const hideEqStations = (map, eqMessage) => {
    if (!map || !eqMessage) return
    try {
        if (eqMessage._stationLayer && map.hasLayer(eqMessage._stationLayer)) map.removeLayer(eqMessage._stationLayer)
        eqMessage._stationLayer = null
    } catch (e) {}
}

export default { showEqStations, hideEqStations }
