let intervalId = null;
let intervalMs = 1000;

const start = (ms) => {
  const next = Number(ms);
  intervalMs = Number.isFinite(next) && next > 0 ? next : 1000;

  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(() => {
    try {
      postMessage({ type: 'tick', nowMs: Date.now() });
    } catch {}
  }, intervalMs);
};

const stop = () => {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
};

self.onmessage = (ev) => {
  const msg = ev?.data || {};
  if (msg.type === 'start') start(msg.intervalMs);
  else if (msg.type === 'stop') stop();
};
