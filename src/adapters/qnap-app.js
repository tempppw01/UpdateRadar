import { fetchText } from "../lib/http.js";

const apiOrigin = "https://www.qnap.com";
const comparable = (value = "") => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
const releaseNotesProductLine = (os) => os === "qvp" ? "qucpe" : "nas";

function officialRelease(app, releaseNotes) {
  const version = String(app.version || "").trim();
  return (releaseNotes.release_note_list ?? []).find((note) => String(note.version || "").trim() === version);
}

function releaseDate(note) {
  const value = String(note?.publish_date || "").trim();
  const date = new Date(value.replaceAll("/", "-"));
  return value && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

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
  const notesUrl = `${apiOrigin}/api/v1/app-release-notes/${releaseNotesProductLine(source.qnapOs)}/${encodeURIComponent(app.app_name)}?locale=en-us`;
  const releaseNotes = JSON.parse(await dependencies.fetchText(notesUrl));
  const note = officialRelease(app, releaseNotes);
  const publishedAt = releaseDate(note);
  return [{
    externalId: `${source.qnapOs}:${osVersion}:${app.app_name}:${app.version}`,
    version: app.version,
    title: `${app.display_name || app.app_name} ${app.version}`,
    url: releaseNotesUrl,
    publishedAt,
    summary: app.detail || "QNAP App Center 已发布新版本。",
    metadata: {
      appName: app.app_name,
      appCenterOs: source.qnapOs,
      appCenterVersion: osVersion,
      releaseDateAvailable: Boolean(publishedAt),
      artworkUrl: app.icon?.[100] || "",
      assets: Object.values(app.download_links ?? {}).map((item) => ({ name: "QPKG 下载", url: item.link })).filter((item) => item.url)
    }
  }];
}
