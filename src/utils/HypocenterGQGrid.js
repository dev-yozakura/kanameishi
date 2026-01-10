// Simple JS implementation of a GlobalQuake-like grid search hypocenter estimator
// Uses tjma2001 travel-time table (distances in km, depths in km)
const EARTH_R = 6371.0 // km

function toRadians(v) { return (v * Math.PI) / 180.0 }
function toDegrees(v) { return (v * 180.0) / Math.PI }

function destination(lat, lon, bearingRad, distKm) {
  const lat1 = toRadians(lat)
  const lon1 = toRadians(lon)
  const dR = distKm / EARTH_R

  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dR) + Math.cos(lat1) * Math.sin(dR) * Math.cos(bearingRad))
  const lon2 = lon1 + Math.atan2(Math.sin(bearingRad) * Math.sin(dR) * Math.cos(lat1), Math.cos(dR) - Math.sin(lat1) * Math.sin(lat2))

  return [toDegrees(lat2), ((toDegrees(lon2) + 540) % 360) - 180]
}

function greatCircleDistanceKm(lat1, lon1, lat2, lon2) {
  const a1 = toRadians(lat1)
  const a2 = toRadians(lat2)
  const dlat = a2 - a1
  const dlon = toRadians(lon2 - lon1)
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(a1) * Math.cos(a2) * Math.sin(dlon / 2) ** 2
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)))
}

// GlobalQuake-like resampling constants
const SHARED_TRAVEL_TABLE_SIZE = 256
const MAX_ANG_VIRTUAL = 181.0 // used in host/device mapping
const ANGLE_TO_INDEX = (SHARED_TRAVEL_TABLE_SIZE - 1.0) / MAX_ANG_VIRTUAL
const GLOBAL_DEPTH_RESOLUTION = 0.5 // km, align with GlobalQuake default

function pWaveInterpolate(tt, distKm, depthKm) {
  // tt: {depths, distances, p_times}
  const depths = tt.depths
  const dists = tt.distances
  const rows = tt.p_times
  if (!depths.length || !dists.length) return NaN

  // clamp
  const depth = Math.max(depths[0], Math.min(depths[depths.length - 1], depthKm))
  const dist = Math.max(dists[0], Math.min(dists[dists.length - 1], distKm))

  // find indices
  let di = 0
  while (di + 1 < depths.length && depths[di + 1] < depth) di++
  let ri = 0
  while (ri + 1 < dists.length && dists[ri + 1] < dist) ri++

  const d0 = depths[di]
  const d1 = depths[Math.min(di + 1, depths.length - 1)]
  const r0 = dists[ri]
  const r1 = dists[Math.min(ri + 1, dists.length - 1)]

  const q11 = rows[di][ri]
  const q12 = rows[di][Math.min(ri + 1, dists.length - 1)]
  const q21 = rows[Math.min(di + 1, depths.length - 1)][ri]
  const q22 = rows[Math.min(di + 1, depths.length - 1)][Math.min(ri + 1, dists.length - 1)]

  const td = d1 === d0 ? 0 : (depth - d0) / (d1 - d0)
  const tr = r1 === r0 ? 0 : (dist - r0) / (r1 - r0)

  const interp = (1 - td) * ((1 - tr) * q11 + tr * q12) + td * ((1 - tr) * q21 + tr * q22)
  return interp
}

function pWaveInterpolateResampled(travelTime, distKm, depthKm) {
  // Emulate GlobalQuake host-side resampling + device lookup:
  // 1) convert distKm -> angular degrees
  // 2) compute fractional index in resampled table (SIZE=SHARED_TRAVEL_TABLE_SIZE, range MAX_ANG_VIRTUAL)
  // 3) map that to two ang values and convert back to km
  // 4) interpolate travel times from original table
  const angDeg = (distKm / EARTH_R) * (180.0 / Math.PI)
  const angIndex = angDeg * ANGLE_TO_INDEX
  const idx0 = Math.floor(Math.max(0, Math.min(SHARED_TRAVEL_TABLE_SIZE - 1, angIndex)))
  const idx1 = Math.min(SHARED_TRAVEL_TABLE_SIZE - 1, idx0 + 1)
  const t = angIndex - idx0

  const angA = (idx0 / (SHARED_TRAVEL_TABLE_SIZE - 1.0)) * MAX_ANG_VIRTUAL
  const angB = (idx1 / (SHARED_TRAVEL_TABLE_SIZE - 1.0)) * MAX_ANG_VIRTUAL

  const distA = (angA * Math.PI / 180.0) * EARTH_R
  const distB = (angB * Math.PI / 180.0) * EARTH_R

  const ta = pWaveInterpolate(travelTime, distA, depthKm)
  const tb = pWaveInterpolate(travelTime, distB, depthKm)
  if (!Number.isFinite(ta) && !Number.isFinite(tb)) return NaN
  if (!Number.isFinite(ta)) return tb
  if (!Number.isFinite(tb)) return ta
  return (1 - t) * ta + t * tb
}

export function locateHypocenterGQGrid({ travelTime, observations, fromLat, fromLon, points = 200, maxDistKm = 100, p_wave_threshold = 2.2, options = {} }) {
  if (!observations || observations.length < 4) return null

  // Performance safeguards and multi-stage search parameters
  const maxObservations = options.maxObservations || 24 // cap number of obs to use
  const coarsePoints = options.coarsePoints || Math.min(400, Math.max(100, Math.floor(points / 2)))
  const coarseDepthStep = options.coarseDepthStep || 5.0 // km
  const refinePoints = options.refinePoints || Math.max(400, points)
  const refineRadiusFactor = options.refineRadiusFactor || 0.25

  // limit observations by weight (weight calculation mirrors previous code: distance/level weighting)
  const obs = observations.map(o => ({ ...o }))
  obs.sort((a, b) => (b.weight || 1) - (a.weight || 1))
  const usedObservations = obs.slice(0, Math.max(4, Math.min(maxObservations, obs.length)))

  const PHI2 = 2.618033989

  // cache for travel time lookup to avoid repeated interpolation
  const ttCache = new Map()

  // quickselect median for small arrays (O(n)) to avoid full sort
  function quickSelectMedian(arr) {
    const k = Math.floor(arr.length / 2)
    function swap(a, i, j) { const t = a[i]; a[i] = a[j]; a[j] = t }
    function partition(a, left, right, pivotIndex) {
      const pivotValue = a[pivotIndex]
      swap(a, pivotIndex, right)
      let storeIndex = left
      for (let i = left; i < right; i++) {
        if (a[i] < pivotValue) { swap(a, storeIndex, i); storeIndex++ }
      }
      swap(a, right, storeIndex)
      return storeIndex
    }
    function select(a, left, right, k) {
      if (left === right) return a[left]
      let pivotIndex = left + Math.floor(Math.random() * (right - left + 1))
      pivotIndex = partition(a, left, right, pivotIndex)
      if (k === pivotIndex) return a[k]
      else if (k < pivotIndex) return select(a, left, pivotIndex - 1, k)
      else return select(a, pivotIndex + 1, right, k)
    }
    const copy = arr.slice()
    const m = select(copy, 0, copy.length - 1, k)
    if (arr.length % 2 === 1) return m
    // even length: need average of two middle
    const m2 = Math.max(...copy.slice(0, k))
    return (m + m2) / 2
  }

  // helper: evaluate grid given center, point count, depthSamples, maxDist
  function evaluateGrid(centerLat, centerLon, pointCount, depthSamples, gridMaxDistKm) {
    let localBest = null
    // preallocate arrays to avoid repeated allocations in hot loops
    const stationDists = new Array(usedObservations.length)
    const predictedOrigins = new Array(usedObservations.length)

    for (let idx = 0; idx < pointCount; idx++) {
      const ang = (2.0 * Math.PI * idx) / PHI2
      const dist = Math.sqrt(idx) * (gridMaxDistKm / Math.sqrt(Math.max(1, pointCount - 1)))
      const [clat, clon] = destination(centerLat, centerLon, ang, dist)

      // precompute distances to stations for this candidate (fill reusable array)
      for (let i = 0; i < usedObservations.length; i++) {
        stationDists[i] = greatCircleDistanceKm(clat, clon, usedObservations[i].lat, usedObservations[i].lon)
      }

      for (let di = 0; di < depthSamples.length; di++) {
        const depthKm = depthSamples[di]
        // fill predictedOrigins using the precomputed distances
        for (let i = 0; i < usedObservations.length; i++) {
          const dKm = stationDists[i]
          const key = `${Math.round(dKm)}:${depthKm}` // 1km dist quantization
          let ttSec
          if (ttCache.has(key)) ttSec = ttCache.get(key)
          else {
            ttSec = pWaveInterpolateResampled(travelTime, dKm, depthKm)
            ttCache.set(key, ttSec)
          }
          predictedOrigins[i] = usedObservations[i].tObsSec - ttSec
        }

        // robust origin estimate: median (quickselect)
        const origin = quickSelectMedian(predictedOrigins)

        let err = 0
        let correct = 0
        for (let i = 0; i < usedObservations.length; i++) {
          const _err = Math.abs(predictedOrigins[i] - origin)
          err += _err
          correct += Math.max(0, p_wave_threshold - _err)
        }

        const heuristic = err <= 0 ? (correct > 0 ? Infinity : -Infinity) : (correct * correct) / (err * err)

        if (!localBest || heuristic > localBest.heuristic) {
          localBest = { heuristic, lat: clat, lon: clon, depthKm, originSec: origin, err }
        }
      }
    }
    return localBest
  }

  // Stage 1: coarse global scan with reduced depth resolution
  const maxDepth = (travelTime.depths && travelTime.depths.length) ? Math.max(...travelTime.depths) : 750
  const coarseDepths = []
  for (let d = 0; d <= maxDepth; d += coarseDepthStep) coarseDepths.push(Number(d))

  const coarseBest = evaluateGrid(fromLat, fromLon, coarsePoints, coarseDepths, maxDistKm)
  if (!coarseBest) return null

  // Stage 2: local refinement around coarse best
  const refineMaxDist = Math.max(1.0, maxDistKm * refineRadiusFactor)
  // depth window around coarseBest
  const depthWindow = 20 // km
  const minDepth = Math.max(0, coarseBest.depthKm - depthWindow)
  const maxDepthRef = Math.min(maxDepth, coarseBest.depthKm + depthWindow)
  const refineDepths = []
  for (let d = minDepth; d <= maxDepthRef; d += GLOBAL_DEPTH_RESOLUTION) refineDepths.push(Number(d))

  const refineBest = evaluateGrid(coarseBest.lat, coarseBest.lon, refinePoints, refineDepths, refineMaxDist)
  const finalBest = refineBest || coarseBest

  return {
    lat: finalBest.lat,
    lon: finalBest.lon,
    depthKm: finalBest.depthKm,
    originSec: finalBest.originSec,
    rmsSec: finalBest.err / Math.max(1, usedObservations.length),
    converged: true,
  }
}
