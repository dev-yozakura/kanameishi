<template>
  <div class="panel">
    <div class="title">GQ: ユジノサハリンスク（テスト）</div>
    <div class="row"><span class="k">SSE</span><span class="v">{{ connected ? 'connected' : 'disconnected' }}</span></div>
    <div class="row"><span class="k">Nearest</span><span class="v">{{ nearest || '-' }}</span></div>
    <div class="row"><span class="k">Last waveform</span><span class="v">{{ lastWaveform || '-' }}</span></div>
    <div class="row"><span class="k">Wave packets</span><span class="v">{{ waveformPackets }}</span></div>
    <div class="row"><span class="k">Last msg</span><span class="v mono">{{ lastLine || '-' }}</span></div>
    <div v-if="error" class="error mono">{{ error }}</div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const connected = ref(false)
const nearest = ref('')
const lastWaveform = ref('')
const waveformPackets = ref(0)
const lastLine = ref('')
const error = ref('')

let es

function handleJson(obj) {
  if (!obj || typeof obj !== 'object') return
  if (obj.type === 'nearest') {
    nearest.value = `${obj.identifier} (≈${obj.distanceKm}km)`
  }
  if (obj.type === 'waveform') {
    waveformPackets.value++
    lastWaveform.value = `${obj.identifier} ${obj.bytes}B ${obj.time}`
  }
}

onMounted(() => {
  // Node proxy (seedlink-proxy.mjs) provides this endpoint
  const url = 'http://localhost:8788/gq/yuzhno/stream'
  es = new EventSource(url)

  es.addEventListener('open', () => {
    connected.value = true
    error.value = ''
  })

  es.onmessage = ev => {
    lastLine.value = String(ev.data || '')
    try {
      handleJson(JSON.parse(ev.data))
    } catch {
      // ignore non-JSON messages
    }
  }

  es.onerror = () => {
    connected.value = false
    error.value = 'SSE error (proxy起動/ポートを確認)'
  }
})

onBeforeUnmount(() => {
  if (es) es.close()
})
</script>

<style scoped lang="scss">
.panel {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 999;
  width: 360px;
  padding: 10px 12px;
  border-radius: 12px;
  background-color: #ffffff9f;
  backdrop-filter: blur(1px);
  box-shadow: 0 0 10px 2px #0000003f;
  user-select: text;
}
.title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 8px;
}
.row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
  margin: 2px 0;
}
.k {
  color: #7f7f7f;
  white-space: nowrap;
}
.v {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
.error {
  margin-top: 8px;
  font-size: 12px;
  color: #b00020;
  white-space: pre-wrap;
}
</style>
