import http from "node:http";
import https from "node:https";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { createServer as createViteServer } from "vite";
import { connectionOverlay, readUploadPaths } from "./configuration.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const canvas = new URL(process.env.CANVAS_DEV_URL || "http://127.0.0.1:4200");
const rasterex = new URL(process.env.RASTEREX_SERVER_URL || "https://sandbox.rasterex.com/");
const api = new URL(process.env.RASTEREX_API_URL || rasterex.href);
const canvasPort = Number(process.env.CANVAS_PROXY_PORT || 4201);
const parentPort = Number(process.env.PARENT_PORT || 5175);
// This standard localhost subdomain avoids Canvas's exact-host C: override.
const origin = `http://canvas.localhost:${canvasPort}`;
for (const url of [canvas, rasterex, api]) {
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Development targets must be HTTP(S) URLs without credentials.");
  }
}
const serverConfig = await fetch(new URL("assets/scripts/rxconfig.js", rasterex));
if (!serverConfig.ok) throw new Error(`Could not read the selected Rasterex server upload paths: ${serverConfig.status}`);
const uploadPaths = readUploadPaths(await serverConfig.text());

function forward(request, response, target) {
  const transport = target.protocol === "https:" ? https : http;
  const headers = { ...request.headers, host: target.host };
  delete headers.connection;
  const upstream = transport.request(target, { method: request.method, headers }, incoming => {
    console.log("Upstream:", request.method, target.pathname, incoming.statusCode);
    const responseHeaders = { ...incoming.headers };
    delete responseHeaders.connection;
    // The local runtime uses these fixed proxy paths for native server requests.
    if (responseHeaders.location?.startsWith(rasterex.origin)) {
      responseHeaders.location = origin + "/rasterex" + responseHeaders.location.slice(rasterex.origin.length);
    }
    response.writeHead(incoming.statusCode || 502, responseHeaders);
    incoming.pipe(response);
  });
  upstream.on("error", error => {
    console.error("Proxy request failed:", target.pathname, error.message);
    if (!response.headersSent) response.writeHead(502, { "content-type": "text/plain" });
    response.end("Development upstream unavailable. Check the terminal for details.");
  });
  request.on("aborted", () => upstream.destroy());
  request.pipe(upstream);
}

const proxy = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", origin);
  if (url.pathname === "/assets/scripts/rxconfig.js") {
    try {
      const upstream = await fetch(new URL(url.pathname, canvas));
      if (!upstream.ok) throw new Error(`Canvas configuration returned ${upstream.status}`);
      const config = connectionOverlay(await upstream.text(), origin + "/rasterex/", origin + "/rasterex-api/", uploadPaths, "/rasterex/RxBinweb");
      response.writeHead(200, { "content-type": "application/javascript", "cache-control": "no-store" });
      response.end(config);
    } catch (error) {
      response.writeHead(502, { "content-type": "text/plain" });
      response.end(error.message);
    }
    return;
  }
  if (url.pathname.startsWith("/rasterex/")) {
    forward(request, response, new URL(url.pathname.slice("/rasterex/".length) + url.search, rasterex));
  } else if (url.pathname.startsWith("/rasterex-api/")) {
    forward(request, response, new URL(url.pathname.slice("/rasterex-api/".length) + url.search, api));
  } else {
    forward(request, response, new URL(url.pathname + url.search, canvas));
  }
});
// Forward only the local Angular live-reload connection.
proxy.on("upgrade", (request, socket, head) => {
  const upstream = net.connect(Number(canvas.port || 80), canvas.hostname, () => {
    const headers = { ...request.headers, host: canvas.host };
    upstream.write(`${request.method} ${request.url} HTTP/${request.httpVersion}\r\n` +
      Object.entries(headers).map(([name, value]) => `${name}: ${value}\r\n`).join("") + "\r\n");
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});
await new Promise((accept, reject) => {
  proxy.once("error", reject);
  proxy.listen(canvasPort, "127.0.0.1", accept);
});
let vite;
try {
  vite = await createViteServer({
    configFile: false, root,
    cacheDir: resolve(tmpdir(), "rasterex-annotation-vite-cache"),
    server: { host: "127.0.0.1", port: parentPort, strictPort: true }
  });
  await vite.listen();
} catch (error) { proxy.close(); throw error; }
console.log(`\nParent: http://127.0.0.1:${parentPort}/examples/annotation-tools/`);
console.log(`Canvas frontend: ${canvas.origin} (unchanged files)`);
console.log(`Canvas test URL: ${origin}/`);
console.log(`Real Rasterex backend: ${rasterex.origin}`);
console.log("Only rxconfig.js connection values are overlaid in memory. No mocked broker, licensing or document responses.");
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, async () => { proxy.close(); await vite.close(); process.exit(0); });
}
