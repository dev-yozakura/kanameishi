let points = []

const rgbToHsv = (r, g, b) => {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min

  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }

  const s = max === 0 ? 0 : d / max
  const v = max
  return { h: h / 360, s, v }
}

// Python版と同じ多項式（フランソワ式）
const color2position = (r, g, b) => {
  const { h, s, v } = rgbToHsv(r, g, b)
  if (!(v > 0.05 && s > 0.75)) return null

  let p
  if (h > 0.1476) {
    p = 280.31 * (h ** 6) - 916.05 * (h ** 5) + 1142.6 * (h ** 4)
      - 709.95 * (h ** 3) + 234.65 * (h ** 2) - 40.27 * h + 3.2217
  } else if (h > 0.001) {
    p = 151.4 * (h ** 4) - 49.32 * (h ** 3) + 6.753 * (h ** 2) - 2.481 * h + 0.9033
  } else {
    p = -0.005171 * (v ** 2) - 0.3282 * v + 1.2236
  }
  return Math.max(p, 0)
}

self.onmessage = async (ev) => {
  const msg = ev.data || {}
  if (msg.type === 'init') {
    points = Array.isArray(msg.points) ? msg.points : []
    return
  }

  if (msg.type !== 'decode') return

  const { imageBitmap, tsMs } = msg
  if (!imageBitmap || !points.length) return

  const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(imageBitmap, 0, 0)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data

  const inst = new Float32Array(points.length)
  const valid = new Uint8Array(points.length)

  for (let i = 0; i < points.length; i += 1) {
    const p = points[i]
    if (p?.suspended) {
      inst[i] = 7.0
      valid[i] = 0
      continue
    }

    const x = p?.x
    const y = p?.y
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      inst[i] = 7.0
      valid[i] = 0
      continue
    }

    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
      inst[i] = 7.0
      valid[i] = 0
      continue
    }

    const idx = (Math.floor(y) * canvas.width + Math.floor(x)) * 4
    const r = data[idx]
    const g = data[idx + 1]
    const b = data[idx + 2]
    const a = data[idx + 3]

    if (!a) {
      inst[i] = 7.0
      valid[i] = 0
      continue
    }

    const pos = color2position(r, g, b)
    if (pos === null) {
      inst[i] = 7.0
      valid[i] = 0
      continue
    }

    const shindo = 10.0 * pos - 3.0
    inst[i] = Math.round(shindo * 10) / 10
    valid[i] = 1
  }

  self.postMessage({ type: 'decoded', inst, valid, tsMs }, [inst.buffer, valid.buffer])
}
