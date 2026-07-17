import { fetchText } from "../lib/http.js";

function valueAtPath(value, path) {
  return String(path || "").split(".").filter(Boolean).reduce((current, key) => current?.[key], value);
}

function regexValue(content, expression) {
  if (!expression) return "";
  const match = new RegExp(expression, "i").exec(content);
  return match?.[1] || match?.[0] || "";
}

function downloadAssets(value, label = "官方下载", baseUrl) {
  if (typeof value === "string") {
    try {
      const candidate = value.trim();
      if (!/^(https?:)?\/\//i.test(candidate) && !/^(\/|\.\/|\.\.\/)/.test(candidate) && !/\.(zip|dmg|exe|msi|deb|rpm|appimage|pkg)(?:[?#]|$)/i.test(candidate)) return [];
      const url = new URL(candidate, baseUrl);
      return ["http:", "https:"].includes(url.protocol) ? [{ name: label, url: url.href }] : [];
    } catch {
      return [];
    }
  }
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, item]) => downloadAssets(item, `${label} ${key}`, baseUrl));
}

function readField(content, source, field) {
  const expression = source[`${field}Path`];
  return source.officialFormat === "html" ? regexValue(content, expression) : valueAtPath(JSON.parse(content), expression);
}

export async function collectOfficialWebsite(source, dependencies = { fetchText }) {
  const content = await dependencies.fetchText(source.officialUrl);
  const version = String(readField(content, source, "version") || "").trim();
  if (!version) throw new Error("官网数据未找到版本号，请检查提取规则");

  const releaseDate = String(readField(content, source, "publishedAt") || "").trim();
  const downloadValue = source.downloadPath ? readField(content, source, "download") : null;
  const summary = source.summaryPath ? String(readField(content, source, "summary") || "").trim() : "";
  const parsedReleaseDate = new Date(releaseDate);
  const publishedAt = releaseDate && !Number.isNaN(parsedReleaseDate.getTime()) ? parsedReleaseDate.toISOString() : new Date().toISOString();

  return [{
    externalId: version,
    version,
    title: `${source.name} ${version}`,
    url: source.homepageUrl || source.officialUrl,
    publishedAt,
    summary: summary || `${source.name} 官网已发布 ${version}。`,
    metadata: { officialUrl: source.officialUrl, officialFormat: source.officialFormat, assets: downloadAssets(downloadValue, "官方下载", source.officialUrl) }
  }];
}
