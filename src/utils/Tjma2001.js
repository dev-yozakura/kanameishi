import tjma2001Text from '../../hypodetect/tjma2001?raw'

let cached = null

const parseTjma2001 = () => {
  // Format (per line):
  // P <p_sec> S <s_sec> <depth_km> <dist_km>
  const depthMap = new Map() // depth -> Map(dist -> {p,s})
  const depthSet = new Set()
  const distSet = new Set()

  const lines = tjma2001Text.split(/\r?\n/)
  for (const line of lines) {
    if (!line || line[0] !== 'P') continue
    const m = /^P\s+([0-9.]+)\s+S\s+([0-9.]+)\s+(\d+)\s+(\d+)\s*$/.exec(line)
    if (!m) continue
    const p = Number(m[1])
    const s = Number(m[2])
    const depth = Number(m[3])
    const dist = Number(m[4])
    if (!Number.isFinite(p) || !Number.isFinite(s) || !Number.isFinite(depth) || !Number.isFinite(dist)) continue

    depthSet.add(depth)
    distSet.add(dist)

    let dm = depthMap.get(depth)
    if (!dm) {
      dm = new Map()
      depthMap.set(depth, dm)
    }
    dm.set(dist, { p, s })
  }

  const depths = Array.from(depthSet).sort((a, b) => a - b)
  const distances = Array.from(distSet).sort((a, b) => a - b)

  const p_times = depths.map((depth) => {
    const dm = depthMap.get(depth)
    return distances.map((dist) => dm?.get(dist)?.p ?? NaN)
  })
  const s_times = depths.map((depth) => {
    const dm = depthMap.get(depth)
    return distances.map((dist) => dm?.get(dist)?.s ?? NaN)
  })

  return { depths, distances, p_times, s_times }
}

export const getTjma2001TravelTime = () => {
  if (cached) return cached
  cached = parseTjma2001()
  return cached
}
