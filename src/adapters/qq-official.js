import { fetchText } from "../lib/http.js";

const configUrl = "https://qq-web.cdn-go.cn/im.qq.com_new/latest/rainbow/pcConfig.json";
const downloadPageUrl = "https://im.qq.com/index/";
const platforms = { windows: "Windows", macos: "macOS", linux: "Linux" };

function downloadAssets(value, label = "") {
  if (typeof value === "string") return value ? [{ name: label || "QQ 官方下载", url: value }] : [];
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, item]) => downloadAssets(item, label ? `${label} ${key}` : key));
}

export async function collectQqOfficial(source, dependencies = { fetchText }) {
  const platform = platforms[source.qqPlatform || "windows"];
  if (!platform) throw new Error(`Unsupported QQ platform: ${source.qqPlatform}`);

  const payload = JSON.parse(await dependencies.fetchText(configUrl));
  const release = payload[platform];
  if (!release?.version) throw new Error(`QQ official configuration does not provide ${platform} version`);

  const assets = Object.entries(release)
    .filter(([key]) => /download/i.test(key))
    .flatMap(([key, value]) => downloadAssets(value, key.replace(/DownloadUrl$/i, "") || platform));
  const publishedAt = release.updateDate ? `${release.updateDate}T00:00:00.000Z` : new Date().toISOString();

  return [{
    externalId: `${source.qqPlatform}:${release.version}`,
    version: release.version,
    title: `QQ ${platform} ${release.version}`,
    url: downloadPageUrl,
    publishedAt,
    summary: `腾讯 QQ 官网已发布 ${platform} ${release.version}。`,
    metadata: { platform, officialConfigUrl: configUrl, assets }
  }];
}
