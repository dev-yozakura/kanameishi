import net from "node:net";
import http from "node:http"; // add
import { WebSocketServer } from "ws";

const WS_PORT = Number(process.env.SEEDLINK_WS_PORT || 8787);
const HTTP_PORT = Number(process.env.SEEDLINK_HTTP_PORT || 8788); // add

// IRIS SeedLink (例): rtserve.iris.washington.edu:18000
// 実際のホスト/ポートは IRIS の案内に合わせて変更
const SEEDLINK_HOST = process.env.SEEDLINK_HOST || "rtserve.iris.washington.edu";
const SEEDLINK_PORT = Number(process.env.SEEDLINK_PORT || 18000);

// まずは固定リスト運用（後でUI/設定から編集できるようにしても良い）
const SUBSCRIPTIONS = [
  // 例: IU.ANMO の BHZ を購読（selectors は SeedLink の SELECT に渡す想定）
  { id: "IU_ANMO_BHZ", net: "IU", sta: "ANMO", selectors: ["BHZ"] },
];

// SeedLink は実装/サーバにより細部が違うので、必要に応じて調整する
function buildSeedLinkCommands(sub) {
  const lines = [];
  // SeedLink 典型コマンド列（詳細は提供元の仕様に合わせて要調整）
  lines.push(`STATION ${sub.sta} ${sub.net}`);
  for (const sel of sub.selectors || []) lines.push(`SELECT ${sel}`);
  lines.push("DATA");
  return lines.map(l => l + "\r\n").join("");
}

function createSeedLinkConnection(sub, broadcast) {
  const socket = net.createConnection(
    { host: SEEDLINK_HOST, port: SEEDLINK_PORT },
    () => {
      socket.setNoDelay(true);
      socket.write(buildSeedLinkCommands(sub));
      broadcast({
        type: "seedlink_status",
        id: sub.id,
        net: sub.net,
        sta: sub.sta,
        ok: true,
        message: "connected",
        ts: Date.now(),
      });
    }
  );

  socket.on("error", err => {
    broadcast({
      type: "seedlink_status",
      id: sub.id,
      net: sub.net,
      sta: sub.sta,
      ok: false,
      message: String(err?.message || err),
      ts: Date.now(),
    });
  });

  // 最初は「受信した」という事実だけをWSへ流す（波形デコードは後で）
  socket.on("data", chunk => {
    broadcast({
      type: "seedlink_data",
      id: sub.id,
      net: sub.net,
      sta: sub.sta,
      bytes: chunk.length,
      ts: Date.now(),
      // 必要なら chunk を base64 で渡す（後でデコードしたい場合）
      // payloadB64: chunk.toString("base64"),
    });
  });

  socket.on("close", () => {
    broadcast({
      type: "seedlink_status",
      id: sub.id,
      net: sub.net,
      sta: sub.sta,
      ok: false,
      message: "closed",
      ts: Date.now(),
    });
  });

  return socket;
}

const wss = new WebSocketServer({ port: WS_PORT });
const clients = new Set();

wss.on("connection", ws => {
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
  ws.send(JSON.stringify({ type: "hello", ts: Date.now() }));
});

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}

for (const sub of SUBSCRIPTIONS) {
  createSeedLinkConnection(sub, broadcast);
}

console.log(
  `[seedlink-proxy] ws://localhost:${WS_PORT} -> seedlink ${SEEDLINK_HOST}:${SEEDLINK_PORT}`
);

// add: tiny cache (URL -> {ts, body, headers, status})
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h
const cache = new Map();

function sendJson(res, status, obj) {
  const body = Buffer.from(JSON.stringify(obj));
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": body.length,
    "cache-control": "no-store",
  });
  res.end(body);
}

const httpServer = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    // GET /iris/stations?net=IU&level=station
    if (req.method === "GET" && url.pathname === "/iris/stations") {
      const netParam = url.searchParams.get("net") || "IU";
      const levelParam = url.searchParams.get("level") || "station";

      // IRIS FDSN Station (GeoJSON)
      const irisUrl = new URL("https://service.iris.edu/fdsnws/station/1/query");
      irisUrl.searchParams.set("format", "geojson");
      irisUrl.searchParams.set("level", levelParam);
      irisUrl.searchParams.set("net", netParam);
      // 必要なら絞り込み: sta / cha / time など
      // irisUrl.searchParams.set("cha", "BHZ");

      const key = irisUrl.toString();
      const hit = cache.get(key);
      if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
        res.writeHead(hit.status, hit.headers);
        res.end(hit.body);
        return;
      }

      const upstream = await fetch(key);
      const body = Buffer.from(await upstream.arrayBuffer());

      const headers = {
        "content-type": upstream.headers.get("content-type") || "application/geo+json",
        "content-length": body.length,
        "cache-control": `public, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`,
        // 同一オリジン想定だが、必要なら許可
        "access-control-allow-origin": "*",
      };

      cache.set(key, { ts: Date.now(), body, headers, status: upstream.status });
      res.writeHead(upstream.status, headers);
      res.end(body);
      return;
    }

    sendJson(res, 404, { ok: false, error: "not_found" });
  } catch (e) {
    sendJson(res, 500, { ok: false, error: String(e?.message || e) });
  }
});

httpServer.listen(HTTP_PORT, () => {
  console.log(`[seedlink-proxy] http://localhost:${HTTP_PORT} (iris stations proxy)`);
});
