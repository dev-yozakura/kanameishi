export function estimateMagnitudeJointRegression(
  RKm,
  pgaGal,
  {
    a = 0.8,
    b = 1.05,
    c = 0.002,
    d = -1.0,
    minPgaGal = 0.3,
    weightBy = 'distance2',
    minRkm = 0.1,
  } = {}
) {
  const R = Array.isArray(RKm) ? RKm : Array.from(RKm ?? [])
  const PGA = Array.isArray(pgaGal) ? pgaGal : Array.from(pgaGal ?? [])
  const n = Math.min(R.length, PGA.length)

  let sumNum = 0
  let sumDen = 0
  let nUsed = 0

  for (let i = 0; i < n; i += 1) {
    const r0 = Number(R[i])
    const p0 = Number(PGA[i])
    if (!Number.isFinite(r0) || !Number.isFinite(p0)) continue
    if (p0 < minPgaGal) continue

    const r = Math.max(minRkm, r0)
    if (r <= 0) continue

    const logPga = Math.log10(p0)
    const logR = Math.log10(r)
    if (!Number.isFinite(logPga) || !Number.isFinite(logR)) continue

    let w = 1
    if (weightBy === 'distance') {
      w = 1 / r
    } else if (weightBy === 'distance2') {
      w = 1 / (r * r)
    }

    if (!Number.isFinite(w) || w <= 0) continue

    sumNum += w * (logPga + b * logR + c * r - d)
    sumDen += w * a
    nUsed += 1
  }

  if (!(nUsed > 0) || !Number.isFinite(sumDen) || sumDen === 0) {
    return { M: NaN, nUsed: 0 }
  }

  return { M: sumNum / sumDen, nUsed }
}
