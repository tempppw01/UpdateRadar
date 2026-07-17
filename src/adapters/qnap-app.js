import { fetchText } from "../lib/http.js";

const apiOrigin = "https://www.qnap.com";
const comparable = (value = "") => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "");

export async function collectQnapApp(source, dependencies = { fetchText }) {
  const catalog = JSON.parse(await dependencies.fetchText(`${apiOrigin}/api/v1/app-center`));
  const versions = catalog.results?.[source.qnapOs]?.version ?? [];
  const osVersion = source.qnapVersion || versions[0]?.version;
  if (!osVersion) throw new Error(`QNAP App Center does not provide ${source.qnapOs} versions`);

  const url = `${apiOrigin}/api/v1/app-center/detail?os=${encodeURIComponent(source.qnapOs)}&version=${encodeURIComponent(osVersion)}&locale=en`;
  const payload = JSON.parse(await dependencies.fetchText(url));
  if (payload.code !== 200) throw new Error(`QNAP App Center could not load ${source.qnapOs} ${osVersion}`);
  const appName = comparable(source.qnapAppName);
  const app = (payload.app_list ?? []).find((candidate) => comparable(candidate.app_name) === appName || comparable(candidate.display_name) === appName);
  if (!app) throw new Error(`QNAP App Center could not find ${source.qnapAppName} for ${source.qnapOs} ${osVersion}`);

  const releaseNotesUrl = app.release_notes_link || "https://www.qnap.com/en/app-center/";
  return [{
    externalId: `${source.qnapOs}:${osVersion}:${app.app_name}:${app.version}`,
    version: app.version,
    title: `${app.display_name || app.app_name} ${app.version}`,
    url: releaseNotesUrl,
    publishedAt: new Date().toISOString(),
    summary: app.detail || "QNAP App Center 已发布新版本。",
    metadata: {
      appName: app.app_name,
      appCenterOs: source.qnapOs,
      appCenterVersion: osVersion,
      artworkUrl: app.icon?.[100] || "",
      assets: Object.values(app.download_links ?? {}).map((item) => ({ name: "QPKG 下载", url: item.link })).filter((item) => item.url)
    }
  }];
}
