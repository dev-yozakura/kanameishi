import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const root = path.resolve(__dirname, '..')
const outDir = path.join(root, 'public', 'json')

const taiwanBox = [119.0, 20.8, 122.3, 26.6]
const hkBox = [113.8, 22.1, 114.5, 22.6]
const moBox = [113.45, 22.05, 113.75, 22.3]

const walkCoords = (coords, cb) => {
  if (!coords) return
  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    cb(coords)
    return
  }
  for (const c of coords) walkCoords(c, cb)
}

const bboxCenterLngLat = (feature) => {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
  walkCoords(feature?.geometry?.coordinates, ([lng, lat]) => {
    if (lng < minLng) minLng = lng
    if (lat < minLat) minLat = lat
    if (lng > maxLng) maxLng = lng
    if (lat > maxLat) maxLat = lat
  })
  if (!Number.isFinite(minLng) || !Number.isFinite(minLat) || !Number.isFinite(maxLng) || !Number.isFinite(maxLat)) return null
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2]
}

const isInBox = ([lng, lat], box) => {
  const [minLng, minLat, maxLng, maxLat] = box
  return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat
}

const pickName = (props = {}) =>
  props.shapeNameLocal ||
  props.shapeName ||
  props.name_local ||
  props.name ||
  props.NAME_LOCAL ||
  props.NAME ||
  props.admin ||
  props.Admin ||
  ''

const fetchJson = async (url) => {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'kanameishi-map-builder/1.0' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.json()
}

const fetchGeoBoundariesGeoJson = async (iso3, adm) => {
  const metaUrl = `https://www.geoboundaries.org/api/current/gbOpen/${iso3}/${adm}/`
  const meta = await fetchJson(metaUrl)

  // APIの戻りは object か array のことがある
  const record = Array.isArray(meta) ? meta[0] : meta
  const gjUrl = record?.gjDownloadURL
  if (!gjUrl) throw new Error(`No gjDownloadURL from ${metaUrl}`)

  const geo = await fetchJson(gjUrl)
  if (!geo || geo.type !== 'FeatureCollection') throw new Error(`Invalid GeoJSON from ${gjUrl}`)
  return geo
}

const normalizeToRegionGeo = (geo, { filterFeature } = {}) => {
  const features = (geo.features || [])
    .filter((f) => (typeof filterFeature === 'function' ? filterFeature(f) : true))
    .map((f) => {
      const name = pickName(f.properties)
      return {
        ...f,
        properties: {
          ...f.properties,
          name,
        },
      }
    })

  return { type: 'FeatureCollection', features }
}

const writeJson = async (filePath, obj) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(obj))
}

const roundCoord = (v) => Math.round(v * 1e5) / 1e5

// Polygon群から「共有される辺」だけを抽出して、外周線（海岸線など）を除いた内部境界線にする
const buildInternalBoundaryLines = (geo) => {
  if (!geo || geo.type !== 'FeatureCollection' || !Array.isArray(geo.features)) {
    throw new Error('buildInternalBoundaryLines: invalid FeatureCollection')
  }

  const segCount = new Map()
  const segPoints = new Map()

  const keyOfPoint = ([lng, lat]) => `${roundCoord(lng)},${roundCoord(lat)}`
  const order2 = (a, b) => (a < b ? [a, b] : [b, a])

  const addRing = (ring) => {
    if (!Array.isArray(ring) || ring.length < 2) return
    for (let i = 0; i < ring.length - 1; i++) {
      const p1 = ring[i]
      const p2 = ring[i + 1]
      if (!p1 || !p2) continue
      const k1 = keyOfPoint(p1)
      const k2 = keyOfPoint(p2)
      if (k1 === k2) continue
      const [a, b] = order2(k1, k2)
      const segKey = `${a}|${b}`
      segCount.set(segKey, (segCount.get(segKey) || 0) + 1)
      if (!segPoints.has(segKey)) {
        const [lng1, lat1] = a.split(',').map(Number)
        const [lng2, lat2] = b.split(',').map(Number)
        segPoints.set(segKey, [
          [lng1, lat1],
          [lng2, lat2],
        ])
      }
    }
  }

  const addPolygon = (poly) => {
    if (!Array.isArray(poly) || poly.length === 0) return
    // 外周リングのみ（poly[0]）を対象にする
    addRing(poly[0])
  }

  for (const f of geo.features) {
    const g = f?.geometry
    if (!g) continue
    if (g.type === 'Polygon') {
      addPolygon(g.coordinates)
    } else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates || []) addPolygon(poly)
    }
  }

  const lines = []
  for (const [segKey, count] of segCount.entries()) {
    if (count >= 2) {
      const pts = segPoints.get(segKey)
      if (pts) lines.push(pts)
    }
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'TWN ADM1 internal boundaries' },
        geometry: {
          type: 'MultiLineString',
          coordinates: lines,
        },
      },
    ],
  }
}

const main = async () => {
  await fs.mkdir(outDir, { recursive: true })

  // 中国（省）: CHN ADM1 から 台湾/HK/澳门 を除外して「中国本土」に寄せる
  const cnAdm1 = await fetchGeoBoundariesGeoJson('CHN', 'ADM1')
  const cnGeo = normalizeToRegionGeo(cnAdm1, {
    filterFeature: (f) => {
      const name = pickName(f.properties)
      if (/hong\s*kong|macao|macau|taiwan/i.test(name)) return false
      const center = bboxCenterLngLat(f)
      if (!center) return true
      if (isInBox(center, taiwanBox) || isInBox(center, hkBox) || isInBox(center, moBox)) return false
      return true
    },
  })
  await writeJson(path.join(outDir, 'cn.mainland.adm1.geo.json'), cnGeo)
  await writeJson(path.join(outDir, 'cn.mainland.adm1.internal.geo.json'), buildInternalBoundaryLines(cnGeo))

  // 韓国（道/行政1）: KOR ADM1
  const krAdm1 = await fetchGeoBoundariesGeoJson('KOR', 'ADM1')
  const krGeo = normalizeToRegionGeo(krAdm1)
  await writeJson(path.join(outDir, 'kr.adm1.geo.json'), krGeo)
  await writeJson(path.join(outDir, 'kr.adm1.internal.geo.json'), buildInternalBoundaryLines(krGeo))

  // 台湾（県/市相当）: TWN ADM1
  // geoBoundaries の TWN ADM2 は「District」レベルまで降りるため、県/市の区切りは ADM1 を使う
  const twAdm1 = await fetchGeoBoundariesGeoJson('TWN', 'ADM1')
  const twGeo = normalizeToRegionGeo(twAdm1)
  await writeJson(path.join(outDir, 'tw.adm1.geo.json'), twGeo)
  await writeJson(path.join(outDir, 'tw.adm1.internal.geo.json'), buildInternalBoundaryLines(twGeo))

  console.log('Wrote:')
  console.log('- public/json/cn.mainland.adm1.geo.json')
  console.log('- public/json/cn.mainland.adm1.internal.geo.json')
  console.log('- public/json/kr.adm1.geo.json')
  console.log('- public/json/kr.adm1.internal.geo.json')
  console.log('- public/json/tw.adm1.geo.json')
  console.log('- public/json/tw.adm1.internal.geo.json')
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
