import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const kinds = new Set(["github-releases", "github-commits", "docker-hub", "rss", "app-store", "google-play", "qnap-app", "qq-official", "nintendo-switch", "steam", "playstation", "xbox"]);

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
  const cooldownMinutes = Number(input.cooldownMinutes ?? 60);
  if (!Number.isInteger(cooldownMinutes) || cooldownMinutes < 0 || cooldownMinutes > 10_080) throw new SourceValidationError("更新后冷却时间应为 0 到 10080 分钟的整数");
  source.cooldownMinutes = cooldownMinutes;
  if (["github-releases", "github-commits"].includes(kind)) {
    source.owner = required(input.owner, "GitHub Owner");
    source.repo = required(input.repo, "GitHub Repository");
    source.branch = String(input.branch || "").trim();
  }
  if (kind === "github-releases") {
    source.includePrereleases = input.includePrereleases === true;
  }
  if (kind === "docker-hub") {
    source.repository = required(input.repository, "Docker Hub 镜像仓库").replace(/^\/+|\/+$/g, "").toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)+$/.test(source.repository)) {
      throw new SourceValidationError("Docker Hub 镜像仓库应为 namespace/image 格式");
    }
    source.tagsFilter = Array.isArray(input.tagsFilter) ? [...new Set(input.tagsFilter.map((tag) => String(tag).trim()).filter(Boolean))] : [];
  }
  if (kind === "rss") source.feedUrl = validUrl(input.feedUrl, "RSS/Atom 地址");
  if (kind === "app-store") {
    source.appId = required(input.appId, "App Store 应用 ID");
    source.country = String(input.country || "us").trim().toLowerCase();
    source.subscriptionId = String(input.subscriptionId || "").trim();
    source.planName = String(input.planName || "").trim();
    source.storefrontId = String(input.storefrontId || "").trim();
    source.artworkUrl = String(input.artworkUrl || "").trim();
  }
  if (kind === "google-play") {
    source.packageId = required(input.packageId, "Google Play 包名");
    source.country = String(input.country || "US").trim().toUpperCase();
    source.language = String(input.language || "en").trim().toLowerCase();
  }
  if (kind === "qnap-app") {
    source.qnapAppName = required(input.qnapAppName, "QNAP App Center 应用名称");
    source.qnapOs = String(input.qnapOs || "qts").trim().toLowerCase();
    if (!new Set(["qts", "quts_hero", "qutscloud", "qvp"]).has(source.qnapOs)) throw new SourceValidationError("不支持的 QNAP 系统类型");
    source.qnapVersion = String(input.qnapVersion || "").trim();
  }
  if (kind === "qq-official") {
    source.qqPlatform = String(input.qqPlatform || "windows").trim().toLowerCase();
    if (!new Set(["windows", "macos", "linux"]).has(source.qqPlatform)) throw new SourceValidationError("不支持的 QQ 平台");
  }
  if (["nintendo-switch", "playstation", "xbox"].includes(kind)) {
    source.gameName = required(input.gameName, "游戏官方名称或关键词");
    source.gameAliases = Array.isArray(input.gameAliases) ? [...new Set(input.gameAliases.map((item) => String(item).trim()).filter(Boolean))] : [];
  }
  if (kind === "nintendo-switch") {
    source.nintendoRegion = String(input.nintendoRegion || "us").trim().toLowerCase();
    if (!/^[a-z]{2}$/.test(source.nintendoRegion)) throw new SourceValidationError("Nintendo 地区代码应为两个小写字母");
  }
  if (kind === "steam") {
    source.steamAppId = required(input.steamAppId, "Steam App ID");
    if (!/^\d+$/.test(source.steamAppId)) throw new SourceValidationError("Steam App ID 应为数字");
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

  async removeMany(ids) {
    const selected = new Set(ids.map((id) => String(id)));
    if (!selected.size) return 0;
    const sources = await this.list();
    const remaining = sources.filter((source) => !selected.has(source.id));
    const removed = sources.length - remaining.length;
    if (removed) await this.save(remaining);
    return removed;
  }

  async replaceAll(inputs) {
    if (!Array.isArray(inputs)) throw new SourceValidationError("sources must be an array");
    const sources = inputs.map((input) => normalizeSource(input));
    if (new Set(sources.map((source) => source.id)).size !== sources.length) {
      throw new SourceValidationError("Source IDs must be unique");
    }
    await this.save(sources);
    return sources;
  }
}
