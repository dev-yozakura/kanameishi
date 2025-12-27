import tls from "node:tls";

const host = process.argv[2] ?? "server.globalquake.net";
const port = Number(process.argv[3] ?? 38000);
const timeoutMs = Number(process.argv[4] ?? 8000);

const socket = tls.connect({
  host,
  port,
  servername: host,
  rejectUnauthorized: false,
});

socket.setTimeout(timeoutMs);

socket.on("secureConnect", () => {
  // eslint-disable-next-line no-console
  console.log(`TLS secureConnect: ${host}:${port}`);
  const cert = socket.getPeerCertificate();
  if (cert && Object.keys(cert).length > 0) {
    // eslint-disable-next-line no-console
    console.log(`TLS peer CN: ${cert.subject?.CN ?? "(unknown)"}`);
    // eslint-disable-next-line no-console
    console.log(`TLS issuer CN: ${cert.issuer?.CN ?? "(unknown)"}`);
  } else {
    // eslint-disable-next-line no-console
    console.log("TLS: no peer certificate info");
  }
});

socket.on("data", (chunk) => {
  // eslint-disable-next-line no-console
  console.log(`TLS data: ${chunk.length} bytes`);
  // eslint-disable-next-line no-console
  console.log(chunk.subarray(0, 512).toString("utf8"));
});

socket.on("timeout", () => {
  // eslint-disable-next-line no-console
  console.log(`TLS timeout after ${timeoutMs}ms`);
  socket.end();
});

socket.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("TLS error:", err);
  process.exitCode = 1;
});

socket.on("end", () => {
  // eslint-disable-next-line no-console
  console.log("TLS socket ended");
});

socket.on("close", () => {
  // eslint-disable-next-line no-console
  console.log("TLS socket closed");
});
