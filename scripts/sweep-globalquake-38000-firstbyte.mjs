import net from "node:net";

const host = process.argv[2] ?? "server.globalquake.net";
const port = Number(process.argv[3] ?? 38000);
const perTryTimeoutMs = Number(process.argv[4] ?? 250);

function tryByte(b) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    socket.setNoDelay(true);

    let receivedBytes = 0;
    let ended = false;
    let errored = null;
    let timedOut = false;

    const t = setTimeout(() => {
      timedOut = true;
      socket.end();
    }, perTryTimeoutMs);

    socket.on("connect", () => {
      socket.write(Buffer.from([b]));
    });

    socket.on("data", (chunk) => {
      receivedBytes += chunk.length;
    });

    socket.on("end", () => {
      ended = true;
    });

    socket.on("error", (err) => {
      errored = err;
    });

    socket.on("close", () => {
      clearTimeout(t);
      resolve({ b, receivedBytes, ended, error: errored?.code ?? null, timedOut });
    });
  });
}

// eslint-disable-next-line no-console
console.log(`Sweep first byte for ${host}:${port} (${perTryTimeoutMs}ms each)`);

const results = [];
for (let b = 0; b <= 255; b++) {
  // eslint-disable-next-line no-console
  process.stdout.write(`\r${b}/255`);
  // eslint-disable-next-line no-console
  const r = await tryByte(b);
  results.push(r);
}
// eslint-disable-next-line no-console
console.log("\rDone           ");

const openish = results.filter((r) => r.timedOut && !r.error && !r.ended && r.receivedBytes === 0);
const ended = results.filter((r) => r.ended && !r.error);
const reset = results.filter((r) => r.error === "ECONNRESET");
const otherClose = results.filter((r) => !r.timedOut && !r.error && !r.ended && r.receivedBytes === 0);

function hex(b) {
  return "0x" + b.toString(16).padStart(2, "0");
}

// eslint-disable-next-line no-console
console.log(`openish (no response, no close until timeout): ${openish.length}`);
if (openish.length) {
  // eslint-disable-next-line no-console
  console.log(openish.map((r) => hex(r.b)).join(" "));
}

// eslint-disable-next-line no-console
console.log(`ended gracefully: ${ended.length}`);
// eslint-disable-next-line no-console
console.log(`reset: ${reset.length}`);
// eslint-disable-next-line no-console
console.log(`closed (no end/error): ${otherClose.length}`);

const interesting = results.filter((r) => r.receivedBytes > 0);
// eslint-disable-next-line no-console
console.log(`received any bytes: ${interesting.length}`);
if (interesting.length) {
  for (const r of interesting) {
    // eslint-disable-next-line no-console
    console.log(`${hex(r.b)} recv=${r.receivedBytes} ended=${r.ended} err=${r.error ?? "-"}`);
  }
}

// eslint-disable-next-line no-console
console.log("sample results (first 10):");
for (const r of results.slice(0, 10)) {
  // eslint-disable-next-line no-console
  console.log(r);
}
