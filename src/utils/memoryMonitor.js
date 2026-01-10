// Lightweight memory monitor util for Chromium-based browsers.
// startMemoryMonitor({ thresholdMB, checkIntervalMs, onBeforeReload, enabled })

export function formatMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(1)
}

export function startMemoryMonitor({ thresholdMB = 1500, checkIntervalMs = 5000, onBeforeReload = null, enabled = true } = {}) {
  if (!enabled) return { stop: () => {} }
  if (typeof performance === 'undefined' || !performance.memory) {
    console.warn('memoryMonitor: performance.memory not available in this browser.')
    return { stop: () => {} }
  }

  let triggered = false
  const intervalId = setInterval(() => {
    try {
      const mem = performance.memory
      const used = mem.usedJSHeapSize || 0
      const limit = mem.jsHeapSizeLimit || 0
      const usedMB = used / 1024 / 1024
      // trigger when used exceeds thresholdMB OR used / limit > 0.85
      const ratio = limit ? used / limit : 0
      if (!triggered && (usedMB >= thresholdMB || ratio >= 0.85)) {
        triggered = true
        console.warn(`memoryMonitor: threshold exceeded used=${formatMB(used)}MB limit=${formatMB(limit)}MB ratio=${(ratio*100).toFixed(1)}%`) 
        if (typeof onBeforeReload === 'function') {
          try { onBeforeReload({ usedMB, limitMB: limit/1024/1024, ratio }) } catch (e) { console.error(e) }
        }
        // try to hint GC if available (only in some Chrome flags)
        try { if (typeof window.gc === 'function') window.gc() } catch (e) {}
        // short delay to allow logs / cleanup
        setTimeout(() => { location.reload() }, 1200)
      }
    } catch (e) {
      console.error('memoryMonitor: error reading performance.memory', e)
    }
  }, checkIntervalMs)

  return {
    stop() { clearInterval(intervalId) }
  }
}
