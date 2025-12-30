import L from 'leaflet'
import { calcReachTime } from '@/utils/Utils'

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
const degToRad = (d) => (d * Math.PI) / 180

const kmToDegLat = (km) => km / 110.574
const kmToDegLon = (km, latDeg) => km / (111.320 * Math.cos(degToRad(latDeg)))

const travelTimeSecP = (travelTime, depthKm, distKm) => {
  const t = calcReachTime(travelTime, true, depthKm, distKm)
  return Number.isFinite(t) ? t : NaN
}

const computeCost = ({
  travelTime,
  lat,
  lon,
  depthKm,
  originSec,
  arrivals,
  nonArrivals,
  nowSec,
  lambda,
  useStationElevation,
}) => {
  if (!travelTime) return Infinity
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(depthKm) || !Number.isFinite(originSec)) return Infinity
  if (!Array.isArray(arrivals) || arrivals.length < 4) return Infinity

  const hypo = L.latLng(lat, lon)
  let cost = 0

  for (const o of arrivals) {
    if (!o?.ll || !Number.isFinite(o?.tObsSec)) return Infinity
    const distKm = hypo.distanceTo(o.ll) / 1000
    const elevKm = useStationElevation && Number.isFinite(o?.elevM) ? o.elevM / 1000 : 0
    const effDepthKm = clamp(depthKm + elevKm, 0, 700)
    const tp = travelTimeSecP(travelTime, effDepthKm, distKm)
    if (!Number.isFinite(tp)) return Infinity
    const pred = originSec + tp
    const r = o.tObsSec - pred
    const w = Number.isFinite(o?.weight) && o.weight > 0 ? o.weight : 1
    cost += w * r * r
  }

  if (Array.isArray(nonArrivals) && nonArrivals.length > 0 && Number.isFinite(nowSec) && lambda > 0) {
    for (const s of nonArrivals) {
      if (!s?.ll) continue
      const distKm = hypo.distanceTo(s.ll) / 1000
      const elevKm = useStationElevation && Number.isFinite(s?.elevM) ? s.elevM / 1000 : 0
      const effDepthKm = clamp(depthKm + elevKm, 0, 700)
      const tp = travelTimeSecP(travelTime, effDepthKm, distKm)
      if (!Number.isFinite(tp)) continue
      const predArrive = originSec + tp
      const violation = Math.max(0, nowSec - predArrive)
      if (!(violation > 0)) continue
      const w = Number.isFinite(s?.weight) && s.weight > 0 ? s.weight : 1
      cost += lambda * w * violation * violation
    }
  }

  return cost
}

/**
 * 着未着法の「未到着局」ペナルティを使い、既存Geiger解を軽量にリファインする。
 * - arrivals: 到着(観測)データ。locateHypocenterGeigerRobust と同等の {ll,tObsSec,weight,elevM?}
 * - nonArrivals: 未到着(未検知)局の候補。{ll,weight?,elevM?}
 */
export const refineHypocenterArrivalNonArrival = ({
  travelTime,
  hypo,
  arrivals,
  nonArrivals,
  nowSec,
  options,
}) => {
  const lat0 = hypo?.lat
  const lon0 = hypo?.lon
  const depth0 = hypo?.depthKm
  const origin0 = hypo?.originSec

  if (!travelTime) return null
  if (!Array.isArray(arrivals) || arrivals.length < 4) return null
  if (!Array.isArray(nonArrivals) || nonArrivals.length === 0) return { lat: lat0, lon: lon0, depthKm: depth0, originSec: origin0 }

  const {
    lambda = 0.25,
    searchKm = 10,
    depthKm = 6,
    timeSec = 0.6,
    useStationElevation = false,
    acceptImprovementRatio = 0.98,
  } = options || {}

  const base = computeCost({
    travelTime,
    lat: lat0,
    lon: lon0,
    depthKm: depth0,
    originSec: origin0,
    arrivals,
    nonArrivals,
    nowSec,
    lambda,
    useStationElevation,
  })

  if (!Number.isFinite(base)) return { lat: lat0, lon: lon0, depthKm: depth0, originSec: origin0 }

  const kmSteps = [0, searchKm, -searchKm]
  const depthSteps = [0, depthKm, -depthKm]
  const timeSteps = [0, timeSec, -timeSec]

  let best = { lat: lat0, lon: lon0, depthKm: depth0, originSec: origin0 }
  let bestCost = base

  for (const dyKm of kmSteps) {
    const lat = lat0 + kmToDegLat(dyKm)
    for (const dxKm of kmSteps) {
      const lon = lon0 + kmToDegLon(dxKm, lat)
      for (const dzKm of depthSteps) {
        const depthKmVal = clamp(depth0 + dzKm, 0, 700)
        for (const dtSec of timeSteps) {
          const originSec = origin0 + dtSec
          const cost = computeCost({
            travelTime,
            lat,
            lon,
            depthKm: depthKmVal,
            originSec,
            arrivals,
            nonArrivals,
            nowSec,
            lambda,
            useStationElevation,
          })
          if (cost < bestCost) {
            bestCost = cost
            best = { lat, lon, depthKm: depthKmVal, originSec }
          }
        }
      }
    }
  }

  // 微小な揺れを避けるため、一定割合以上改善したときだけ採用
  if (bestCost <= base * acceptImprovementRatio) return best
  return { lat: lat0, lon: lon0, depthKm: depth0, originSec: origin0 }
}
