import { fetchText } from "../lib/http.js";

const apiOrigin = "https://www.qnap.com";
const historyLimit = 30;
const comparable = (value = "") => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
const releaseNotesProductLine = (os) => os === "qvp" ? "qucpe" : "nas";

function releaseDate(note) {
  const value = String(note?.publish_date || "").trim();
  const date = new Date(value.replaceAll("/", "-"));
  return value && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

function plainText(value = "") {
  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function qpkgAssets(app) {
  return Object.values(app.download_links ?? {})
    .map((item) => ({ name: "QPKG 下载", url: item.link }))
    .filter((item) => item.url);
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
  const currentVersion = String(app.version || "").trim();
  const notes = [];
  const seen = new Set();
  for (const note of releaseNotes.release_note_list ?? []) {
    const version = String(note.version || "").trim();
    if (!version || seen.has(version)) continue;
    seen.add(version);
    notes.push(note);
    if (notes.length >= historyLimit) break;
  }
  if (currentVersion && !seen.has(currentVersion)) {
    notes.unshift({
      version: currentVersion,
      title: `${app.display_name || app.app_name} ${currentVersion}`,
      text: app.detail || "",
      publish_date: ""
    });
  }

  const displayName = app.display_name || app.app_name;
  const artworkUrl = app.icon?.[100] || "";
  const assets = qpkgAssets(app);
  const fallbackSummary = "QNAP App Center 已发布新版本。";

  return notes.map((note) => {
    const version = String(note.version || "").trim();
    const isCurrent = Boolean(currentVersion) && version === currentVersion;
    const publishedAt = releaseDate(note);
    const summary = plainText(note.text) || (isCurrent ? (app.detail || fallbackSummary) : `${displayName} ${version}`);
    return {
      externalId: `${source.qnapOs}:${osVersion}:${app.app_name}:${version}`,
      version,
      title: note.title || `${displayName} ${version}`,
      url: releaseNotesUrl,
      publishedAt,
      summary,
      metadata: {
        appName: app.app_name,
        appCenterOs: source.qnapOs,
        appCenterVersion: osVersion,
        releaseDateAvailable: Boolean(publishedAt),
        artworkUrl,
        assets: isCurrent ? assets : [],
        historical: !isCurrent
      }
    };
  });
}
