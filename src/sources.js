import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseCompleteJsonDocuments } from "./lib/json-recovery.js";

const kinds = new Set(["github-releases", "github-commits", "docker-hub", "rss", "app-store", "mac-app-store", "google-play", "qnap-app", "official-website", "nintendo-switch", "steam", "playstation", "xbox"]);

export class SourceValidationError extends Error {}

function required(value, field) {
  const text = String(value ?? "").trim();
  if (!text) throw new SourceValidationError(`请填写${field}`);
  return text;
}

export function isPrivateOrLocalhost(hostname) {
  // 标准化主机名为小写
  const host = hostname.toLowerCase();
  
  // 检查 localhost 和 127.x.x.x
  if (host === "localhost" || host.startsWith("127.")) return true;
  
  // 检查 IPv6 localhost
  if (host === "::1" || host === "[::1]") return true;
  
  // 检查 0.0.0.0
  if (host === "0.0.0.0") return true;
  
  // 检查常见内网域名
  const localDomains = [".local", ".internal", ".private", ".localhost"];
  if (localDomains.some(domain => host.endsWith(domain))) return true;
  
  // 尝试解析为 IPv4 地址
  const ipv4Match = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1, 5).map(Number);
    // 验证每个八位组在 0-255 范围内
    if (octets.some(octet => octet < 0 || octet > 255)) return false;
    
    const [a, b, c, d] = octets;
    
    // 10.0.0.0/8 - 私有网络 A 类
    if (a === 10) return true;
    
    // 172.16.0.0/12 - 私有网络 B 类
    if (a === 172 && b >= 16 && b <= 31) return true;
    
    // 192.168.0.0/16 - 私有网络 C 类
    if (a === 192 && b === 168) return true;
    
    // 169.254.0.0/16 - Link-local 地址（包括云服务元数据 169.254.169.254）
    if (a === 169 && b === 254) return true;
    
    // 127.0.0.0/8 - 环回地址
    if (a === 127) return true;
    
    // 0.0.0.0/8 - 当前网络
    if (a === 0) return true;
    
    // 224.0.0.0/4 - 组播地址
    if (a >= 224 && a <= 239) return true;
    
    // 240.0.0.0/4 - 保留地址
    if (a >= 240) return true;
    
    // 100.64.0.0/10 - 共享地址空间（RFC 6598）
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  
  // 检查 IPv6 私有地址（简化版）
  if (host.includes(":")) {
    const ipv6Lower = host.replace(/[\[\]]/g, "");
    // fc00::/7 - 唯一本地地址
    if (ipv6Lower.startsWith("fc") || ipv6Lower.startsWith("fd")) return true;
    // fe80::/10 - 链路本地地址
    if (ipv6Lower.startsWith("fe8") || ipv6Lower.startsWith("fe9") || 
        ipv6Lower.startsWith("fea") || ipv6Lower.startsWith("feb")) return true;
  }
  
  return false;
}

function validUrl(value, field, { allowPrivate = false } = {}) {
  const text = required(value, field);
  try {
    const url = new URL(text);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new SourceValidationError(`${field}必须是有效的 http(s) 地址`);
    }
    
    // SSRF 防护：阻止访问内网地址
    if (!allowPrivate && isPrivateOrLocalhost(url.hostname)) {
      throw new SourceValidationError(`${field}不能指向内网或本地地址`);
    }
  } catch (error) {
    if (error instanceof SourceValidationError) throw error;
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
  const cooldownMinutes = Number(input.cooldownMinutes ?? (kind === "qnap-app" ? 1440 : 60));
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
  if (["app-store", "mac-app-store"].includes(kind)) {
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
  if (kind === "official-website") {
    source.officialUrl = validUrl(input.officialUrl, "官网数据地址");
    source.homepageUrl = String(input.homepageUrl || "").trim();
    if (source.homepageUrl) source.homepageUrl = validUrl(source.homepageUrl, "官网页面地址");
    source.officialFormat = String(input.officialFormat || "json").trim().toLowerCase();
    if (!new Set(["json", "html"]).has(source.officialFormat)) throw new SourceValidationError("官网数据格式应为 JSON 或 HTML");
    source.versionPath = required(input.versionPath, source.officialFormat === "json" ? "版本字段路径" : "版本正则表达式");
    source.publishedAtPath = String(input.publishedAtPath || "").trim();
    source.downloadPath = String(input.downloadPath || "").trim();
    source.summaryPath = String(input.summaryPath || "").trim();
    if (source.officialFormat === "html" && [source.versionPath, source.publishedAtPath, source.downloadPath, source.summaryPath].some((pattern) => pattern.length > 200)) {
      throw new SourceValidationError("网页提取正则表达式不能超过 200 个字符");
    }
    if (source.officialFormat === "html") {
      try {
        [source.versionPath, source.publishedAtPath, source.downloadPath, source.summaryPath].filter(Boolean).forEach((pattern) => new RegExp(pattern, "i"));
      } catch {
        throw new SourceValidationError("网页提取规则不是有效的正则表达式");
      }
    }
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
  constructor(path) {
    this.path = path;
    this.writeQueue = Promise.resolve();
  }

  async list() {
    try {
      return JSON.parse(await readFile(this.path, "utf8"));
    } catch (error) {
      const text = await readFile(this.path, "utf8");
      const { documents, discardedTail } = parseCompleteJsonDocuments(text);
      const sourcesById = new Map();
      documents.filter(Array.isArray).flat().forEach((source) => {
        if (source?.id) sourcesById.set(source.id, source);
      });
      if (!sourcesById.size) throw error;
      const sources = [...sourcesById.values()];
      await this.save(sources);
      const recovery = discardedTail ? " and discarded a corrupted trailing fragment" : "";
      console.warn(`Recovered ${documents.length} concatenated source snapshots${recovery} in ${this.path}`);
      return sources;
    }
  }

  async save(sources) {
    await mkdir(dirname(this.path), { recursive: true });
    const temporaryPath = `${this.path}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(sources, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.path);
  }

  // Source mutations may arrive from manual saves and one-click catalog adds together.
  // Serializing read-modify-write prevents lost updates and shared temporary-file races.
  async mutate(callback) {
    const task = this.writeQueue.then(callback, callback);
    this.writeQueue = task.catch(() => undefined);
    return task;
  }

  async create(input) {
    return this.mutate(async () => {
      const sources = await this.list();
      const source = normalizeSource(input);
      if (sources.some((candidate) => candidate.id === source.id)) throw new SourceValidationError("唯一 ID 已存在");
      sources.push(source);
      await this.save(sources);
      return source;
    });
  }

  async update(id, input) {
    return this.mutate(async () => {
      const sources = await this.list();
      const index = sources.findIndex((source) => source.id === id);
      if (index === -1) return null;
      const source = normalizeSource({ ...sources[index], ...input }, { id });
      sources[index] = source;
      await this.save(sources);
      return source;
    });
  }

  async remove(id) {
    return this.mutate(async () => {
      const sources = await this.list();
      const remaining = sources.filter((source) => source.id !== id);
      if (remaining.length === sources.length) return false;
      await this.save(remaining);
      return true;
    });
  }

  async removeMany(ids) {
    return this.mutate(async () => {
      const selected = new Set(ids.map((id) => String(id)));
      if (!selected.size) return 0;
      const sources = await this.list();
      const remaining = sources.filter((source) => !selected.has(source.id));
      const removed = sources.length - remaining.length;
      if (removed) await this.save(remaining);
      return removed;
    });
  }

  async replaceAll(inputs) {
    return this.mutate(async () => {
      if (!Array.isArray(inputs)) throw new SourceValidationError("sources must be an array");
      const sources = inputs.map((input) => normalizeSource(input));
      if (new Set(sources.map((source) => source.id)).size !== sources.length) {
        throw new SourceValidationError("Source IDs must be unique");
      }
      await this.save(sources);
      return sources;
    });
  }
}
