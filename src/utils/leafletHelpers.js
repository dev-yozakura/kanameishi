export function safeRemoveLayer(map, layer) {
  if (!layer) return
  try {
    // remove tooltip/popup bindings
    if (typeof layer.unbindTooltip === 'function') {
      try { layer.unbindTooltip() } catch {}
    }
    if (typeof layer.unbindPopup === 'function') {
      try { layer.unbindPopup() } catch {}
    }
    // remove event listeners attached to the layer
    if (typeof layer.off === 'function') {
      try { layer.off() } catch {}
    }
    // prefer map.removeLayer when available to keep internal state
    if (map && typeof map.hasLayer === 'function' && map.hasLayer(layer)) {
      try { map.removeLayer(layer) } catch {}
    } else if (typeof layer.remove === 'function') {
      try { layer.remove() } catch {}
    }
  } catch (e) {
    // swallow errors - best-effort cleanup
  }
}

export function safeAddToMap(map, layer) {
  if (!map || !layer) return
  try { layer.addTo(map) } catch {}
}
