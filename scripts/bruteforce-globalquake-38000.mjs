import net from "node:net";

const host = process.argv[2] ?? "server.globalquake.net";
const port = Number(process.argv[3] ?? 38000);
const perTryTimeoutMs = Number(process.argv[4] ?? 1200);

const candidates = [
  { name: "(send nothing)", data: null },
  { name: "\\n", data: Buffer.from("\n", "utf8") },
  { name: "\\r\\n", data: Buffer.from("\r\n", "utf8") },
  { name: "HELLO", data: Buffer.from("HELLO", "utf8") },
  { name: "HELLO\\r\\n", data: Buffer.from("HELLO\r\n", "utf8") },
  { name: "SLPROTO 3\\r\\n", data: Buffer.from("SLPROTO 3\r\n", "utf8") },
  { name: "SLPROTO 3.1\\r\\n", data: Buffer.from("SLPROTO 3.1\r\n", "utf8") },
  { name: "CAPABILITIES\\r\\n", data: Buffer.from("CAPABILITIES\r\n", "utf8") },
  { name: "INFO\\r\\n", data: Buffer.from("INFO\r\n", "utf8") },
  { name: "ping\\n", data: Buffer.from("ping\n", "utf8") },
  { name: "PING\\n", data: Buffer.from("PING\n", "utf8") },
  { name: "hello\\n", data: Buffer.from("hello\n", "utf8") },
  { name: "HELLO\\n", data: Buffer.from("HELLO\n", "utf8") },
  { name: "info\\n", data: Buffer.from("info\n", "utf8") },
  { name: "INFO\\n", data: Buffer.from("INFO\n", "utf8") },
  { name: "subscribe\\n", data: Buffer.from("subscribe\n", "utf8") },
  { name: "SUBSCRIBE\\n", data: Buffer.from("SUBSCRIBE\n", "utf8") },
  { name: "{}\\n", data: Buffer.from("{}\n", "utf8") },
  { name: '{"type":"subscribe"}\\n', data: Buffer.from('{"type":"subscribe"}\n', "utf8") },
  { name: "GQ\\n", data: Buffer.from("GQ\n", "utf8") },
  { name: "GLOBALQUAKE\\n", data: Buffer.from("GLOBALQUAKE\n", "utf8") },
  { name: "0x00", data: Buffer.from([0x00]) },
  { name: "0x01", data: Buffer.from([0x01]) },
  { name: "0xff", data: Buffer.from([0xff]) },
];

function tryOnce({ name, data }) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    socket.setNoDelay(true);

    let received = Buffer.alloc(0);
    let ended = false;
    let errored = null;

    const t = setTimeout(() => {
      socket.end();
    }, perTryTimeoutMs);

    socket.on("connect", () => {
      if (data) socket.write(data);
    });

    socket.on("data", (chunk) => {
      received = Buffer.concat([received, chunk]);
    });

    socket.on("end", () => {
      ended = true;
    });

    socket.on("error", (err) => {
      errored = err;
    });

    socket.on("close", () => {
      clearTimeout(t);
      const preview = received.subarray(0, 120).toString("utf8").replace(/\r/g, "\\r").replace(/\n/g, "\\n");
      resolve({ name, sentBytes: data?.length ?? 0, recvBytes: received.length, ended, error: errored?.code ?? null, preview });
    });
  });
}

// eslint-disable-next-line no-console
console.log(`Bruteforce ${host}:${port} (timeout ${perTryTimeoutMs}ms per try)`);

for (const candidate of candidates) {
  // eslint-disable-next-line no-console
  process.stdout.write(`- trying ${candidate.name} ... `);
  const r = await tryOnce(candidate);
  // eslint-disable-next-line no-console
  console.log(`sent=${r.sentBytes} recv=${r.recvBytes} ended=${r.ended} err=${r.error ?? "-"} preview="${r.preview}"`);
}
