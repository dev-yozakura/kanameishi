import net from "node:net";

const host = process.argv[2] ?? "server.globalquake.net";
const port = Number(process.argv[3] ?? 38000);

const socket = net.connect({ host, port });
socket.setNoDelay(true);

let totalBytes = 0;

socket.on("connect", () => {
  // eslint-disable-next-line no-console
  console.log(`connected: ${host}:${port}`);
});

socket.on("data", (chunk) => {
  totalBytes += chunk.length;

  const preview = chunk.subarray(0, 512);
  // eslint-disable-next-line no-console
  console.log(`data: +${chunk.length} bytes (total ${totalBytes})`);
  // eslint-disable-next-line no-console
  console.log(preview.toString("utf8"));

  if (totalBytes >= 4096) {
    // eslint-disable-next-line no-console
    console.log("received >= 4096 bytes; closing");
    socket.end();
  }
});

socket.on("end", () => {
  // eslint-disable-next-line no-console
  console.log("socket ended");
});

socket.on("close", () => {
  // eslint-disable-next-line no-console
  console.log("socket closed");
});

socket.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("socket error:", err);
  process.exitCode = 1;
});
