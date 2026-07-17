import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const kinds = new Set(["github-releases", "rss", "app-store", "app-store-price", "google-play"]);

export class SourceValidationError extends Error {}

function required(value, field) {
  const text = String(value ?? "").trim();
  if (!text) throw new SourceValidationError(`请填写${field}`);
  return text;
}

function validUrl(value, field) {
  const text = required(value, field);
  try {
    const url = new URL(text);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
  } catch {
    throw new SourceValidationError(`${field}必须是有效的 http(s) 地址`);
  }
  return text;
}

export function normalizeSource(input, { id } = {}) {
  const kind = required(input.kind, "数据源类型");
  if (!kinds.has(kind)) throw new SourceValidationError("不支持的数据源类型");
  const sourceId = required(id ?? input.id, "唯一 ID").toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(sourceId)) {
    throw new SourceValidationError("唯一 ID 只能包含小写字母、数字和连字符");
  }

  const source = {
    id: sourceId,
    name: required(input.name, "名称"),
    kind,
    enabled: input.enabled !== false,
    tags: Array.isArray(input.tags) ? [...new Set(input.tags.map((tag) => String(tag).trim()).filter(Boolean))] : []
  };
  if (kind === "github-releases") {
    source.owner = required(input.owner, "GitHub Owner");
    source.repo = required(input.repo, "GitHub Repository");
    source.includePrereleases = input.includePrereleases === true;
  }
  if (kind === "rss") source.feedUrl = validUrl(input.feedUrl, "RSS/Atom 地址");
  if (kind === "app-store") {
    source.appId = required(input.appId, "App Store 应用 ID");
    source.country = String(input.country || "us").trim().toLowerCase();
  }
  if (kind === "app-store-price") {
    source.appId = required(input.appId, "App Store 应用 ID");
    source.subscriptionId = required(input.subscriptionId, "订阅套餐 ID");
    source.planName = String(input.planName || "").trim();
    source.locale = String(input.locale || "zh").trim().toLowerCase();
  }
  if (kind === "google-play") {
    source.packageId = required(input.packageId, "Google Play 包名");
    source.country = String(input.country || "US").trim().toUpperCase();
    source.language = String(input.language || "en").trim().toLowerCase();
  }
  return source;
}

export class JsonSourceStore {
  constructor(path) { this.path = path; }

  async list() { return JSON.parse(await readFile(this.path, "utf8")); }

  async save(sources) {
    await mkdir(dirname(this.path), { recursive: true });
    const temporaryPath = `${this.path}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(sources, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.path);
  }

  async create(input) {
    const sources = await this.list();
    const source = normalizeSource(input);
    if (sources.some((candidate) => candidate.id === source.id)) throw new SourceValidationError("唯一 ID 已存在");
    sources.push(source);
    await this.save(sources);
    return source;
  }

  async update(id, input) {
    const sources = await this.list();
    const index = sources.findIndex((source) => source.id === id);
    if (index === -1) return null;
    const source = normalizeSource({ ...sources[index], ...input }, { id });
    sources[index] = source;
    await this.save(sources);
    return source;
  }

  async remove(id) {
    const sources = await this.list();
    const remaining = sources.filter((source) => source.id !== id);
    if (remaining.length === sources.length) return false;
    await this.save(remaining);
    return true;
  }
}
