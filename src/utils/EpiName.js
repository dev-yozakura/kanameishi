let _csvLoadedPromise = null
let _grid = null

const _escapeKeyPart = (v) => String(v).trim()

const _mkKey = (latDeg, latMin, lonDeg, lonMin) => {
  return `${_escapeKeyPart(latDeg)},${_escapeKeyPart(latMin)},${_escapeKeyPart(lonDeg)},${_escapeKeyPart(lonMin)}`
}

const _normalizeDegMin = (deg, min) => {
  let d = Number(deg)
  let m = Number(min)
  if (!Number.isFinite(d) || !Number.isFinite(m)) return null

  while (m < 0) {
    m += 60
    d -= 1
  }
  while (m >= 60) {
    m -= 60
    d += 1
  }
  return { deg: d, min: m }
}

const _degMinToDecimal = (deg, min) => {
  return Number(deg) + Number(min) / 60
}

// Haversine distance in km
const _haversineKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (x) => (x * Math.PI) / 180
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

const _loadCsv = async () => {
  if (_grid) return _grid
  if (_csvLoadedPromise) return _csvLoadedPromise

  _csvLoadedPromise = (async () => {
    const url = `${import.meta.env.BASE_URL}ll2epiname.csv`
    const res = await fetch(url, { cache: 'force-cache' })
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
    const text = await res.text()

    const lines = text.split(/\r?\n/)
    const grid = new Map()

    // header: latDeg,latMin,lonDeg,lonMin,name
    for (let i = 1; i < lines.length; i += 1) {
      const line = lines[i]
      if (!line) continue
      const cols = line.split(',')
      if (cols.length < 5) continue

      const latDeg = Number(cols[0])
      const latMin = Number(cols[1])
      const lonDeg = Number(cols[2])
      const lonMin = Number(cols[3])
      const name = cols.slice(4).join(',').trim()
      if (!name) continue
      if (!Number.isFinite(latDeg) || !Number.isFinite(latMin) || !Number.isFinite(lonDeg) || !Number.isFinite(lonMin)) continue

      grid.set(_mkKey(latDeg, latMin, lonDeg, lonMin), name)
    }

    _grid = grid
    return grid
  })()

  return _csvLoadedPromise
}

// Returns nearest epicenter name (string) or ''
export const getNearestEpiName = async (lat, lon, options = {}) => {
  const radiusMin = Number.isFinite(options.radiusMin) ? options.radiusMin : 2

  const latitude = Number(lat)
  const longitude = Number(lon)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return ''

  const grid = await _loadCsv()

  const baseLatDeg = Math.floor(latitude)
  const baseLatMin = Math.floor((latitude - baseLatDeg) * 60)
  const baseLonDeg = Math.floor(longitude)
  const baseLonMin = Math.floor((longitude - baseLonDeg) * 60)

  let best = { name: '', distKm: Infinity }

  for (let dLat = -radiusMin; dLat <= radiusMin; dLat += 1) {
    for (let dLon = -radiusMin; dLon <= radiusMin; dLon += 1) {
      const latNorm = _normalizeDegMin(baseLatDeg, baseLatMin + dLat)
      const lonNorm = _normalizeDegMin(baseLonDeg, baseLonMin + dLon)
      if (!latNorm || !lonNorm) continue

      const key = _mkKey(latNorm.deg, latNorm.min, lonNorm.deg, lonNorm.min)
      const name = grid.get(key)
      if (!name) continue

      const candLat = _degMinToDecimal(latNorm.deg, latNorm.min)
      const candLon = _degMinToDecimal(lonNorm.deg, lonNorm.min)
      const distKm = _haversineKm(latitude, longitude, candLat, candLon)

      if (distKm < best.distKm) best = { name, distKm }
    }
  }

  return best.name || ''
}
