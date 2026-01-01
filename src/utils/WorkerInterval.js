export const startWorkerInterval = (intervalMs, onTick) => {
  const worker = new Worker(new URL('../workers/interval-timer.js', import.meta.url), {
    type: 'module',
  });

  let disposed = false;

  worker.onmessage = (ev) => {
    if (disposed) return;
    const msg = ev?.data;
    if (msg?.type !== 'tick') return;
    try {
      onTick?.(msg.nowMs);
    } catch {}
  };

  worker.postMessage({ type: 'start', intervalMs });

  return () => {
    disposed = true;
    try {
      worker.postMessage({ type: 'stop' });
    } catch {}
    try {
      worker.terminate();
    } catch {}
  };
};
