const host = process.argv[2] ?? "server.globalquake.net";
const port = Number(process.argv[3] ?? 38000);
const timeoutMs = Number(process.argv[4] ?? 8000);

const httpUrl = `http://${host}:${port}/`;
const wsUrl = `ws://${host}:${port}/`;

async function probeHttp() {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // eslint-disable-next-line no-console
    console.log(`HTTP GET ${httpUrl}`);
    const res = await fetch(httpUrl, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
    });

    // eslint-disable-next-line no-console
    console.log(`HTTP status: ${res.status} ${res.statusText}`);
    // eslint-disable-next-line no-console
    console.log("HTTP headers:");
    for (const [k, v] of res.headers.entries()) {
      // eslint-disable-next-line no-console
      console.log(`  ${k}: ${v}`);
    }

    const body = await res.text();
    // eslint-disable-next-line no-console
    console.log("HTTP body preview:");
    // eslint-disable-next-line no-console
    console.log(body.slice(0, 800));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log("HTTP error:", e?.name ?? e, e?.message ?? "");
  } finally {
    clearTimeout(t);
  }
}

async function probeWs() {
  // eslint-disable-next-line no-console
  console.log(`WS connect ${wsUrl}`);

  if (typeof WebSocket === "undefined") {
    // eslint-disable-next-line no-console
    console.log("WebSocket global is not available in this Node version.");
    return;
  }

  await new Promise((resolve) => {
    const ws = new WebSocket(wsUrl);

    const t = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.log(`WS timeout after ${timeoutMs}ms; closing`);
      try {
        ws.close();
      } catch {
        // ignore
      }
    }, timeoutMs);

    ws.addEventListener("open", () => {
      // eslint-disable-next-line no-console
      console.log("WS open");
    });

    ws.addEventListener("message", (ev) => {
      const data = typeof ev.data === "string" ? ev.data : "[non-string message]";
      // eslint-disable-next-line no-console
      console.log("WS message:");
      // eslint-disable-next-line no-console
      console.log(data.slice(0, 800));
    });

    ws.addEventListener("error", (err) => {
      // eslint-disable-next-line no-console
      console.log("WS error:", err?.message ?? err);
    });

    ws.addEventListener("close", (ev) => {
      clearTimeout(t);
      // eslint-disable-next-line no-console
      console.log(`WS close code=${ev.code} reason=${ev.reason}`);
      resolve();
    });
  });
}

await probeHttp();
// eslint-disable-next-line no-console
console.log("---");
await probeWs();
