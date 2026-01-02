<template>
    <div />
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, inject } from 'vue'
import Http from '@/classes/Http'
import { useStatusStore } from '@/stores/status'
import { useSettingsStore } from '@/stores/settings'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { computeNiedStyleColorRadius } from '@/classes/StationClasses'
import { startWorkerInterval } from '@/utils/WorkerInterval'

const statusStore = useStatusStore()
const settingsStore = useSettingsStore()

const stationList = reactive({})
const stations = reactive({})
let map = null

const rshakeUpdateTime = inject('rshakeUpdateTime', ref('1970-01-01 00:00:00'))

const pad2 = (n) => String(n).padStart(2, '0')
const nowTimeStr = () => {
    const d = new Date()
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth()+1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`
}

const clearReactiveObject = (obj) => { if (obj) for (const k in obj) delete obj[k] }

// Helpers (small subset copied from PAlertNet logic)
const normalizePgaToGal = (pga) => {
    let v = Number(pga)
    if (!Number.isFinite(v) || v <= 0) return 0
    if (v >= 5000) v = v / 1000
    return v
}
const normalizePgvToCms = (pgv) => {
    let v = Number(pgv)
    if (!Number.isFinite(v) || v <= 0) return 0
    if (v >= 5000) v = v / 1000
    return v
}
const calcRecentPgaRms = (pgaGalSeries) => {
    const N = 3
    const recent = Array.isArray(pgaGalSeries) ? pgaGalSeries.slice(0, N) : []
    const vals = recent.map(x => Number(x)).filter(x => Number.isFinite(x) && x >= 0)
    if (vals.length === 0) return 0
    while (vals.length < N) vals.push(0)
    const meanSq = vals.reduce((s, x) => s + x * x, 0) / N
    const rms = Math.sqrt(meanSq)
    return Number.isFinite(rms) ? rms : 0
}
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
const pgaSeriesToPalertLevel = (pgaGalSeries, pgvCmsSeries) => {
    const pgaEff = calcRecentPgaRms(pgaGalSeries)
    const pgaLabel = pgaToShindoLabel(pgaEff)
    const pgaLevel = shindoLabelToLevel(pgaLabel)
    if (pgaLevel < 0) return -1
    if (pgaLevel <= 15) return pgaLevel
    let pgvEff = 0
    if (Array.isArray(pgvCmsSeries) && pgvCmsSeries.length > 0) {
        const N = 3
        const recent = pgvCmsSeries.slice(0, N)
        const vals = recent.map(x => normalizePgvToCms(x)).filter(x => Number.isFinite(x) && x >= 0)
        while (vals.length < N) vals.push(0)
        const meanSq = vals.reduce((s, x) => s + x * x, 0) / N
        pgvEff = Math.sqrt(meanSq)
    } else {
        pgvEff = estimatePgvFromPga(pgaEff)
    }
    const pgvLabel = pgvToShindoLabel(pgvEff)
    return shindoLabelToLevel(pgvLabel)
}

const extractPgaPgv = (raw) => {
    if (Array.isArray(raw)) return { pga: raw[0], pgv: raw[1] }
    if (raw && typeof raw === 'object') {
        return {
            pga: raw.pga ?? raw.PGA ?? raw.acc ?? raw.Acc ?? raw.value,
            pgv: raw.pgv ?? raw.PGV ?? raw.vel ?? raw.Vel,
        }
    }
    return { pga: raw, pgv: undefined }
}

const parseGMEntry = (raw) => {
    if(!raw) return null
    if(typeof raw === 'object'){
        const id = raw.id || raw.ID || raw.station || raw.sta
        const acc = raw.acc ?? raw.pga ?? raw.PGA ?? raw.value
        const vel = raw.vel ?? raw.pgv ?? raw.PGV
        return { id, acc, vel, raw }
    }
    const s = String(raw).replace(/^@?\{?/, '').replace(/\}?$/, '')
    const parts = s.split(';').map(p => p.trim()).filter(Boolean)
    const out = {}
    for(const p of parts){
        const m = p.match(/^([^=:\s]+)\s*[:=]\s*(.*)$/)
        if(m){
            const k = m[1].toLowerCase()
            let v = m[2].trim()
            // strip surrounding quotes
            if(v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
            if(k === 'id') out.id = v
            else if(k === 'acc' || k === 'pga' || k === 'value') out.acc = Number(v)
            else if(k === 'vel' || k === 'pgv') out.vel = Number(v)
            else out[k] = isNaN(Number(v)) ? v : Number(v)
        }
    }
    return out
}

class RShakeStation {
    constructor(map, id, latLng){
        this.map = map
        this.id = id
        this.latLng = latLng
        this.recentPga = []
        this.recentPgv = []
        this.level = -1
        this.marker = null
        this.paneName = `rshakeStationPane${id}`
        // do not render immediately; only render when valid data arrives
    }
    update(pga, pgv){
        // Server provides values in micrometers (μm): convert to centimeters (cm)
        // 1 μm = 1e-4 cm
        const pgaIn = Number(pga)
        const pgvIn = Number(pgv)
        const pgaCm = Number.isFinite(pgaIn) ? pgaIn * 1e-4 : pgaIn
        const pgvCm = Number.isFinite(pgvIn) ? pgvIn * 1e-4 : pgvIn
        const pgaGal = normalizePgaToGal(pgaCm)
        const pgvCms = normalizePgvToCms(pgvCm)
        // if no valid incoming measurements, hide marker
        // treat zero or non-finite as "no data" (hide marker)
        const hasPga = Number.isFinite(pgaIn) && pgaIn > 0
        const hasPgv = Number.isFinite(pgvIn) && pgvIn > 0
        if(!hasPga && !hasPgv){
            this.level = -1
            if(this.marker && this.map && this.map.hasLayer(this.marker)){
                try{ this.map.removeLayer(this.marker) }catch(e){}
            }
            this.marker = null
            return
        }

        this.recentPga.unshift(pgaGal)
        this.recentPga.splice(10)
        this.recentPgv.unshift(pgvCms)
        this.recentPgv.splice(10)
        const level = pgaSeriesToPalertLevel(this.recentPga, this.recentPgv)
        if(level !== this.level) this.level = level
        // only render when we have a non-negative level
        if(this.level >= 0) this.render()
    }
    render(){
        if(!this.map) return
        const zoom = this.map.getZoom()
        const lr = computeNiedStyleColorRadius(this.level, zoom)
        const color = lr.color
        const radius = Math.max(1, Math.round(lr.radius))
        if(this.marker && this.map.hasLayer(this.marker)){
            this.marker.setStyle({ color, fillColor: color }).setRadius(radius)
        } else {
            // ensure pane exists to avoid Leaflet appendChild errors
            try{
                if(this.map && typeof this.map.getPane === 'function' && !this.map.getPane(this.paneName)){
                    this.map.createPane(this.paneName)
                    const p = this.map.getPane(this.paneName)
                    if(p && p.style) p.style.zIndex = 650
                }
            } catch (e) {
                if(import.meta.env.DEV) console.debug('RShake: createPane err', e)
            }

            this.marker = L.circleMarker(this.latLng, {
                radius,
                opacity: 1,
                fillOpacity: 1,
                color,
                fillColor: color,
                weight: 0,
                pane: this.paneName,
                interactive: false
            }).addTo(this.map)
        }
    }
    terminate(){
        if(this.marker && this.map.hasLayer(this.marker)) this.map.removeLayer(this.marker)
        this.map = null
        this.marker = null
    }
}

let stationListInterval = null
let requestWorker = null

    const fetchStationList = async () => {
    try {
        const base = import.meta.env.DEV ? '/rshake' : 'https://stationview.raspberryshake.org'
        const url = `${base}/stations?online=true&net=AM`
        const fullUrl = (url) + `&t=${Date.now()}`
        if(import.meta.env.DEV) console.log('RShake: fetchStationList url', fullUrl)
        const res = await Http.get(fullUrl)
        if(!res) return
        if(import.meta.env.DEV) console.log('RShake: stationList fetched type', Array.isArray(res) ? 'array' : typeof res, 'count', Array.isArray(res) ? res.length : Object.keys(res).length)
        // response may be an array or object; try to normalize to { id: { lat, lon } }
        const newList = {}
        if(Array.isArray(res)){
            res.forEach(s => {
                const rawId = s.sta || s.id || s.station || s.code
                const id = rawId ? (String(rawId).startsWith('AM.') ? String(rawId) : `AM.${rawId}`) : null
                const lat = s.lat ?? s.latitude
                const lon = s.lon ?? s.longitude
                if(id && Number.isFinite(lat) && Number.isFinite(lon)) newList[id] = { lat, lon }
            })
        } else if(res && typeof res === 'object'){
            // might be object keyed by id
            for(const k of Object.keys(res)){
                const s = res[k]
                const rawId = k || s.sta || s.id || s.station || s.code
                const id = rawId ? (String(rawId).startsWith('AM.') ? String(rawId) : `AM.${rawId}`) : k
                const lat = s.lat ?? s.latitude ?? s.location?.lat
                const lon = s.lon ?? s.longitude ?? s.location?.lon
                if(Number.isFinite(lat) && Number.isFinite(lon)) newList[id] = { lat, lon }
            }
        }
        if(Object.keys(newList).length > 0){
            clearReactiveObject(stationList)
            Object.assign(stationList, newList)
        }
    } catch (err) {
        console.log('RShake: station list fetch err', err)
    }
}

onMounted(()=>{
    stationListInterval = setInterval(fetchStationList, 180000)
    fetchStationList()
    const tryFetchObjects = async () => {
        try {
            const base = import.meta.env.DEV ? '/rshake' : 'https://stationview.raspberryshake.org'
            const url = `${base}/query/objects.json?QC&GM`
            if(import.meta.env.DEV) console.log('RShake: tryFetchObjects url', url)
            const res = await Http.get(url)
            if(import.meta.env.DEV) {
                try{
                    const type = Array.isArray(res) ? 'array' : typeof res
                    const gmListLen = res && res.GM && Array.isArray(res.GM.list) ? res.GM.list.length : 0
                    console.log('RShake: tryFetchObjects response type', type, 'gmEntries', gmListLen)
                    if(typeof res === 'string'){
                        try{
                            const parsed = JSON.parse(res)
                            console.log('RShake: parsed string->json keys', Object.keys(parsed))
                        } catch(err){ console.log('RShake: tryFetchObjects string not json') }
                    } else if(res && typeof res === 'object'){
                        const keys = Object.keys(res)
                        console.log('RShake: tryFetchObjects keys', keys)
                        if(keys.length === 1 && keys[0] === 'request'){
                            try{
                                console.log('RShake: tryFetchObjects request object', res.request)
                                try{ console.log('RShake: tryFetchObjects request JSON', JSON.stringify(res.request)) } catch(e){}
                            } catch(e){ console.log('RShake: err logging res.request', e) }
                        }
                        if(Array.isArray(res)) console.log('RShake: sample entry', res[0])
                        else if(res.GM && Array.isArray(res.GM.list)) console.log('RShake: sample GM.entry', res.GM.list[0])
                    }
                } catch(e){ console.log('RShake: tryFetchObjects inspect err', e) }
            }
            return res
        } catch (e) {
            return null
        }
    }

    requestWorker = startWorkerInterval(1000, async () => {
        try {
            const res = await tryFetchObjects()
            if(!res) return
            // update time
            rshakeUpdateTime.value = nowTimeStr()
            // normalize entries: try GM.list, res.list, res (array), res.GM, or wrapper in res.request
            let entries = []
            if(res.GM && Array.isArray(res.GM.list)) entries = res.GM.list
            else if(res.request && res.request.GM && Array.isArray(res.request.GM.list)) { entries = res.request.GM.list; if(import.meta.env.DEV) console.debug('RShake: using res.request.GM.list (wrapper)') }
            else if(Array.isArray(res)) entries = res
            else if(res.request && Array.isArray(res.request)) { entries = res.request; if(import.meta.env.DEV) console.debug('RShake: using res.request array (wrapper)') }
            else if(res.list && Array.isArray(res.list)) entries = res.list
            else if(res.request && res.request.list && Array.isArray(res.request.list)) { entries = res.request.list; if(import.meta.env.DEV) console.debug('RShake: using res.request.list (wrapper)') }
            else if(res.GM && Array.isArray(res.GM)) entries = res.GM
            else if(res.request && res.request.GM && Array.isArray(res.request.GM)) { entries = res.request.GM; if(import.meta.env.DEV) console.debug('RShake: using res.request.GM (wrapper)') }
            // iterate and apply
            let matched = 0, unmatched = 0
            for(const raw of entries){
                try{
                    const parsed = parseGMEntry(raw)
                    if(!parsed || !parsed.id){ unmatched++; continue }
                    const id = String(parsed.id).startsWith('AM.') ? String(parsed.id) : `AM.${parsed.id}`
                    const st = stations[id]
                    if(!st){ unmatched++; if(import.meta.env.DEV) console.debug('RShake: no station for', id); continue }
                    const ex = extractPgaPgv(parsed)
                    st.update(ex.pga ?? parsed.acc, ex.pgv ?? parsed.vel)
                    matched++
                } catch(e){ unmatched++; if(import.meta.env.DEV) console.debug('RShake: parse entry err', e) }
            }
            if(import.meta.env.DEV) console.debug(`RShake: objects parsed matched=${matched} unmatched=${unmatched} entries=${entries.length}`)
        } catch (err) {
            // ignore
        }
    })
})

onBeforeUnmount(()=>{
    if(stationListInterval) clearInterval(stationListInterval)
    if(requestWorker) requestWorker()
    for(const id in stations) stations[id].terminate()
    clearReactiveObject(stations)
    try{
        if(map && map.off) map.off('moveend')
    } catch {}
})

let unwatchStationList
watch(()=>statusStore.map, newVal => {
    if(newVal){
        map = newVal
        // create panes for markers
        // dynamic panes handled by station instances
        const maxCreate = 1500
        const updateVisibleStations = () => {
            try{
                if(!map) return
                const bounds = map.getBounds ? map.getBounds().pad(0.2) : null
                // remove out-of-bounds stations
                for(const id in stations){
                    const st = stationList[id]
                    if(!st){ stations[id].terminate(); delete stations[id]; continue }
                    if(bounds){
                        const lat = st.lat, lon = st.lon
                        if(!Number.isFinite(lat) || !Number.isFinite(lon) || !bounds.contains(L.latLng(lat, lon))){
                            stations[id].terminate(); delete stations[id]
                        }
                    }
                }
                // add visible stations up to limit
                let created = 0
                for(const id of Object.keys(stationList)){
                    if(created >= maxCreate) break
                    if(stations[id]) continue
                    const info = stationList[id]
                    if(!info) continue
                    if(bounds){
                        const lat = info.lat, lon = info.lon
                        if(!Number.isFinite(lat) || !Number.isFinite(lon) || !bounds.contains(L.latLng(lat, lon))) continue
                    }
                    stations[id] = new RShakeStation(map, id, [info.lat, info.lon])
                    created++
                }
                if(import.meta.env.DEV) console.debug('RShake: created stations', Object.keys(stations).length, 'createdThisCycle', created)
            } catch(e){ if(import.meta.env.DEV) console.debug('RShake: updateVisibleStations err', e) }
        }

        unwatchStationList = watch(stationList, newVal => {
            // when stationList changes, update visible set
            updateVisibleStations()
        }, { immediate: true })

        // update on map move/zoom
        map.on && map.on('moveend', updateVisibleStations)
        // remember to remove listener on unmount
    }
}, { immediate: true })

</script>

<style scoped>

</style>
