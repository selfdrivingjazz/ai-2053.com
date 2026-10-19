import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("public/", import.meta.url));
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 4333);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

// Refuse to report ready without the exploration hub.
await stat(join(root, "index.html"));

async function resolve(pathname) {
  const relative = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, "");
  const candidate = join(root, relative);
  if (candidate !== root.slice(0, -1) && !candidate.startsWith(root)) return null;
  if (relative.split(sep).some((part) => part.startsWith("."))) return null;
  const info = await stat(candidate).catch(() => null);
  if (info?.isFile()) return candidate;
  if (info?.isDirectory()) {
    const index = join(candidate, "index.html");
    if ((await stat(index).catch(() => null))?.isFile()) return index;
  }
  return null;
}

// Media and fonts change rarely: cache for a week. Everything else is live source
// and is revalidated on every load (cheap 304s via ETag).
const cacheFor = (pathname) => (/^\/(media|shared)\//.test(pathname) ? "public, max-age=604800" : "no-cache");

const server = createServer(async (request, response) => {
  const send = (status, type, body, extra = {}) => {
    response.writeHead(status, {
      "Content-Type": type,
      "Content-Length": Buffer.byteLength(body),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
      ...extra,
    });
    response.end(request.method === "HEAD" ? undefined : body);
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  let pathname;
  try {
    pathname = new URL(request.url, "http://localhost").pathname;
  } catch {
    send(400, "text/plain; charset=utf-8", "Bad request");
    return;
  }
  if (pathname === "/healthz") {
    send(200, "text/plain; charset=utf-8", "ai2053-ready");
    return;
  }
  // The retired exploration URLs all lead into the house now.
  if (pathname.startsWith("/x/")) {
    response.writeHead(308, { Location: "/" }).end();
    return;
  }
  // Directory URLs need a trailing slash so relative asset paths resolve.
  if (!pathname.endsWith("/") && !extname(pathname)) {
    const file = await resolve(pathname).catch(() => null);
    if (file?.endsWith(`${sep}index.html`)) {
      response.writeHead(308, { Location: `${pathname}/` }).end();
      return;
    }
  }
  try {
    const file = await resolve(pathname);
    if (!file) {
      send(404, "text/plain; charset=utf-8", "Not found");
      return;
    }
    const info = await stat(file);
    const etag = `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
    const caching = { "Cache-Control": cacheFor(pathname), ETag: etag, "Last-Modified": info.mtime.toUTCString() };
    if (request.headers["if-none-match"] === etag) {
      response.writeHead(304, { ...caching, "X-Robots-Tag": "noindex, nofollow" }).end();
      return;
    }
    const bytes = await readFile(file);
    send(200, types[extname(file).toLowerCase()] ?? "application/octet-stream", bytes, caching);
  } catch (error) {
    console.error(error);
    send(500, "text/plain; charset=utf-8", "Unable to load AI-2053");
  }
});
server.listen(port, host, () => console.log(`AI-2053 exploration ready at http://${host}:${port}`));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
