import L from 'leaflet'
import { calcReachTime } from '@/utils/Utils'

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

const degToRad = (d) => (d * Math.PI) / 180

const kmToDegLat = (km) => km / 110.574
const kmToDegLon = (km, latDeg) => km / (111.320 * Math.cos(degToRad(latDeg)))

const solve4x4 = (A, b) => {
  // Gaussian elimination with partial pivoting
  const M = A.map((row, i) => row.slice().concat([b[i]]))
  const n = 4
  for (let col = 0; col < n; col += 1) {
    let pivot = col
    let best = Math.abs(M[col][col])
    for (let r = col + 1; r < n; r += 1) {
      const v = Math.abs(M[r][col])
      if (v > best) {
        best = v
        pivot = r
      }
    }
    if (!(best > 1e-12)) return null
    if (pivot !== col) {
      const tmp = M[col]
      M[col] = M[pivot]
      M[pivot] = tmp
    }
    const div = M[col][col]
    for (let c = col; c <= n; c += 1) M[col][c] /= div
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue
      const factor = M[r][col]
      if (factor === 0) continue
      for (let c = col; c <= n; c += 1) {
        M[r][c] -= factor * M[col][c]
      }
    }
  }
  return [M[0][4], M[1][4], M[2][4], M[3][4]]
}

const weightedNormalSolve = (rows, rhs, weights) => {
  // rows: N x 4, rhs: N
  // Solve (A^T W A) dm = (A^T W rhs)
  const ATA = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]
  const ATb = [0, 0, 0, 0]

  for (let i = 0; i < rows.length; i += 1) {
    const w = weights[i]
    if (!(w > 0)) continue
    const r = rows[i]
    const b = rhs[i]
    for (let a = 0; a < 4; a += 1) {
      ATb[a] += w * r[a] * b
      for (let c = 0; c < 4; c += 1) {
        ATA[a][c] += w * r[a] * r[c]
      }
    }
  }

  return solve4x4(ATA, ATb)
}

const travelTimeSec = (travelTime, depthKm, distKm) => {
  const t = calcReachTime(travelTime, true, depthKm, distKm)
  return Number.isFinite(t) ? t : NaN
}

const computeResiduals = (travelTime, lat, lon, depthKm, originSec, obs) => {
  const hypo = L.latLng(lat, lon)
  const res = []
  const dists = []
  for (const o of obs) {
    const distKm = hypo.distanceTo(o.ll) / 1000
    const tp = travelTimeSec(travelTime, depthKm, distKm)
    if (!Number.isFinite(tp)) return null
    const pred = originSec + tp
    res.push(o.tObsSec - pred)
    dists.push(distKm)
  }
  return { res, dists }
}

export const locateHypocenterGeiger = ({
  travelTime,
  observations,
  initial,
  maxIter = 8,
  dxKm = 1.0,
  dzKm = 2.0,
}) => {
  // observations: [{ lat, lon, tObsSec, ll, weight }]
  if (!travelTime) return null
  const obs = observations?.filter((o) => Number.isFinite(o?.tObsSec) && o?.ll)
  if (!obs || obs.length < 4) return null

  let lat = initial?.lat
  let lon = initial?.lon
  let depthKm = initial?.depthKm ?? 10
  let originSec = initial?.originSec

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    lat = obs[0].lat
    lon = obs[0].lon
  }
  if (!Number.isFinite(originSec)) {
    const tMin = Math.min(...obs.map((o) => o.tObsSec))
    originSec = tMin - 2.0
  }
  depthKm = clamp(depthKm, 0, 700)

  let converged = false
  let rms = Infinity

  for (let it = 0; it < maxIter; it += 1) {
    const base = computeResiduals(travelTime, lat, lon, depthKm, originSec, obs)
    if (!base) return null

    const latN = lat + kmToDegLat(dxKm)
    const latS = lat - kmToDegLat(dxKm)
    const lonE = lon + kmToDegLon(dxKm, lat)
    const lonW = lon - kmToDegLon(dxKm, lat)

    const resN = computeResiduals(travelTime, latN, lon, depthKm, originSec, obs)
    const resS = computeResiduals(travelTime, latS, lon, depthKm, originSec, obs)
    const resE = computeResiduals(travelTime, lat, lonE, depthKm, originSec, obs)
    const resW = computeResiduals(travelTime, lat, lonW, depthKm, originSec, obs)
    const resUp = computeResiduals(travelTime, lat, lon, clamp(depthKm + dzKm, 0, 700), originSec, obs)
    const resDn = computeResiduals(travelTime, lat, lon, clamp(depthKm - dzKm, 0, 700), originSec, obs)
    if (!resN || !resS || !resE || !resW || !resUp || !resDn) return null

    // We need dT/dx but we have residuals r = tObs - (t0+T)
    // so dr/dx = -(dT/dx). For linear system: dT/dx*dx + ... + dt0 = r
    // We'll compute dT/dx via -dr/dx.
    const rows = []
    const rhs = []
    const weights = []

    let wSum = 0
    let err2 = 0

    for (let i = 0; i < obs.length; i += 1) {
      const r0 = base.res[i]
      const dr_dy = (resN.res[i] - resS.res[i]) / (2 * dxKm)
      const dr_dx = (resE.res[i] - resW.res[i]) / (2 * dxKm)
      const dr_dz = (resUp.res[i] - resDn.res[i]) / (2 * dzKm)

      const dTdx = -dr_dx
      const dTdy = -dr_dy
      const dTdz = -dr_dz

      rows.push([dTdx, dTdy, dTdz, 1])
      rhs.push(r0)

      const w = obs[i].weight
      weights.push(w)
      wSum += w
      err2 += w * r0 * r0
    }

    rms = Math.sqrt(err2 / Math.max(wSum, 1e-9))

    const dm = weightedNormalSolve(rows, rhs, weights)
    if (!dm) break

    let [dX, dY, dZ, dT0] = dm

    // Step limiting for stability
    dX = clamp(dX, -50, 50)
    dY = clamp(dY, -50, 50)
    dZ = clamp(dZ, -50, 50)
    dT0 = clamp(dT0, -5, 5)

    lat += kmToDegLat(dY)
    lon += kmToDegLon(dX, lat)
    if (lon < -180) lon += 360
    if (lon > 180) lon -= 360
    depthKm = clamp(depthKm + dZ, 0, 700)
    originSec += dT0

    const moveKm = Math.sqrt(dX * dX + dY * dY + dZ * dZ)
    if (moveKm < 0.5 && Math.abs(dT0) < 0.1) {
      converged = true
      break
    }
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(depthKm) || !Number.isFinite(originSec)) return null
  return { lat, lon, depthKm, originSec, rmsSec: rms, converged }
}
