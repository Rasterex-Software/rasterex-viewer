import { randomUUID } from "node:crypto";

const endpoint = "/__rasterex-local/rxml";
const maxBytes = 2 * 1024 * 1024;
const maxEntries = 16;
const lifetimeMs = 120_000;

export function createLocalRxmlStore(canvasOrigin, parentOrigin) {
  const entries = new Map();

  async function store(request, response, next) {
    if (request.url !== endpoint) {
      return next();
    }
    if (request.method !== "POST") {
      response.writeHead(405, { Allow: "POST" }).end();
      return;
    }
    if (request.headers.origin !== parentOrigin) {
      response.writeHead(403).end();
      return;
    }
    if (request.headers["content-type"] !== "application/xml") {
      response.writeHead(415).end();
      return;
    }

    const chunks = [];
    let size = 0;
    try {
      for await (const chunk of request.iterator({ destroyOnReturn: false })) {
        size += chunk.length;
        if (size > maxBytes) {
          response.writeHead(413, { Connection: "close" }).end();
          return;
        }
        chunks.push(chunk);
      }
    } catch {
      response.writeHead(400).end();
      return;
    }

    const xml = Buffer.concat(chunks);
    if (!xml.toString("utf8").trim() || /<!DOCTYPE\b/i.test(xml.toString("utf8"))) {
      response.writeHead(400).end();
      return;
    }
    if (entries.size >= maxEntries) {
      response.writeHead(429).end();
      return;
    }

    const path = `${endpoint}/${randomUUID()}.rxml`;
    entries.set(path, xml);
    // Canvas can fetch the file twice when it falls back to its native URL loader.
    setTimeout(() => entries.delete(path), lifetimeMs).unref();
    response.writeHead(201, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }).end(JSON.stringify({ url: new URL(path, canvasOrigin).href }));
  }

  function serve(request, response, path) {
    if (!path.startsWith(`${endpoint}/`)) {
      return false;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" }).end();
      return true;
    }

    const xml = entries.get(path);
    if (!xml) {
      response.writeHead(404).end();
      return true;
    }

    response.writeHead(200, {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Length": xml.length,
      "Cache-Control": "no-store",
      "Content-Security-Policy": "sandbox; default-src 'none'",
      "X-Content-Type-Options": "nosniff"
    }).end(request.method === "HEAD" ? undefined : xml);
    return true;
  }

  return { store, serve };
}
