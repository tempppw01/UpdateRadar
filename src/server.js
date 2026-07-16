import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { searchAppStore } from "./catalog.js";
import { pollAll } from "./radar.js";
import { JsonSourceStore, SourceValidationError } from "./sources.js";
import { JsonEventStore } from "./store.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const publicPath = join(root, "public");
const sourcesPath = process.env.SOURCES_PATH ?? join(root, "data/sources.json");
const eventStore = new JsonEventStore(process.env.EVENTS_PATH ?? join(root, "data/events.json"));
const sourceStore = new JsonSourceStore(sourcesPath);

async function sources() {
  return sourceStore.list();
}

function send(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(body)}\n`);
}

async function requestBody(request) {
  let text = "";
  for await (const chunk of request) {
    text += chunk;
    if (text.length > 100_000) throw new SourceValidationError("请求内容过大");
  }
  try {
    return JSON.parse(text || "{}");
  } catch {
    throw new SourceValidationError("请求内容必须是 JSON");
  }
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".html": "text/html; charset=utf-8"
};

async function sendPublicFile(response, path, method) {
  const requested = path === "/" ? "index.html" : path.slice(1);
  const file = join(publicPath, requested);
  if (!file.startsWith(`${publicPath}/`) || !(await stat(file)).isFile()) return false;
  const extension = file.slice(file.lastIndexOf("."));
  response.writeHead(200, { "Content-Type": contentTypes[extension] ?? "application/octet-stream" });
  response.end(method === "HEAD" ? undefined : await readFile(file));
  return true;
}

export function createApp({ store = eventStore, getSources = sources, sourceRepository = sourceStore, appStoreSearch = searchAppStore } = {}) {
  return createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
    try {
      if (request.method === "GET" && url.pathname === "/health") {
        return send(response, 200, { status: "ok" });
      }
      if (request.method === "GET" && url.pathname === "/v1/sources") {
        return send(response, 200, await getSources());
      }
      if (request.method === "GET" && url.pathname === "/v1/catalog/app-store") {
        const term = url.searchParams.get("term")?.trim() ?? "";
        if (term.length < 2) throw new SourceValidationError("请至少输入两个字符来搜索 App Store");
        const country = (url.searchParams.get("country") ?? "us").trim().toLowerCase();
        if (!/^[a-z]{2}$/.test(country)) throw new SourceValidationError("App Store 国家/地区代码应为两个字母");
        return send(response, 200, await appStoreSearch({ term, country, limit: url.searchParams.get("limit") }));
      }
      if (request.method === "POST" && url.pathname === "/v1/sources") {
        return send(response, 201, await sourceRepository.create(await requestBody(request)));
      }
      const sourceMatch = url.pathname.match(/^\/v1\/sources\/([a-z0-9-]+)$/);
      if (sourceMatch && request.method === "PUT") {
        const source = await sourceRepository.update(sourceMatch[1], await requestBody(request));
        return source ? send(response, 200, source) : send(response, 404, { error: "Source not found" });
      }
      if (sourceMatch && request.method === "DELETE") {
        return (await sourceRepository.remove(sourceMatch[1]))
          ? send(response, 200, { removed: true })
          : send(response, 404, { error: "Source not found" });
      }
      if (request.method === "GET" && url.pathname === "/v1/events") {
        return send(response, 200, await store.list({
          sourceId: url.searchParams.get("sourceId") ?? undefined,
          tag: url.searchParams.get("tag") ?? undefined,
          limit: url.searchParams.get("limit") ?? undefined
        }));
      }
      if (request.method === "POST" && url.pathname === "/v1/poll") {
        return send(response, 200, await pollAll(await getSources(), { store }));
      }
      if (["GET", "HEAD"].includes(request.method) && !url.pathname.startsWith("/v1/")) {
        try {
          if (await sendPublicFile(response, url.pathname, request.method)) return;
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }
      return send(response, 404, { error: "Not found" });
    } catch (error) {
      const status = error instanceof SourceValidationError ? 400 : 500;
      return send(response, status, { error: status === 400 ? "Validation error" : "Internal error", message: error.message });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 8787);
  createApp().listen(port, () => console.log(`UpdateRadar listening on http://localhost:${port}`));
}
