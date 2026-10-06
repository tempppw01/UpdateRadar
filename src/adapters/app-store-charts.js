import { fetchText } from "../lib/http.js";

// Two independent upstreams expose the same ranking tables. Neither is complete
// everywhere, so both are tried: the web page carries rank numbers and bundle ids
// but only renders server-side for some storefronts, while the legacy RSS feed
// covers every storefront yet has to infer the rank from array position.
const chartFeeds = {
  "top-free": { rss: "topfreeapplications", label: "免费榜" },
  "top-paid": { rss: "toppaidapplications", label: "付费榜" },
  "top-grossing": { rss: "topgrossingapplications", label: "畅销榜" }
};

const defaultChartLimit = () => Math.min(Math.max(Number(process.env.APP_STORE_CHART_LIMIT ?? "50") || 50, 1), 200);
const lookupChunkSize = () => Math.min(Math.max(Number(process.env.APP_STORE_LOOKUP_CHUNK ?? "25") || 25, 1), 100);

function decodeSerializedJson(raw) {
  return JSON.parse(raw
    .replace(/\\u003C/g, "<")
    .replace(/\\u003E/g, ">")
    .replace(/\\u0026/g, "&")
    .replace(/\\u002F/g, "/"));
}

function parseEmbeddedChartData(html) {
  const match = html.match(/id="serialized-server-data"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return [];
  let payload;
  try {
    payload = decodeSerializedJson(match[1]);
  } catch {
    // Apple occasionally reserializes the page differently; the RSS feed still works.
    return [];
  }
  const segments = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node.$kind === "TopChartSegment") segments.push(node);
    Object.values(node).forEach(visit);
  };
  visit(payload);
  return segments;
}

function normalizeSegment(segment, { country }) {
  const items = segment?.shelves?.[0]?.items ?? [];
  return items.map((item) => ({
    appId: String(item.adamId ?? ""),
    ordinal: Number(item.ordinal) || 0,
    title: String(item.title ?? ""),
    developer: String(item.developerName ?? ""),
    bundleId: String(item.bundleId ?? ""),
    icon: artworkTemplate(item.icon),
    country
  })).filter((entry) => entry.appId && entry.title);
}

// The ranking page ships icons as a size/format template rather than a ready URL,
// so the placeholders have to be filled in before the image can be requested.
function artworkTemplate(artwork) {
  const template = String(artwork?.template ?? artwork?.url ?? "");
  if (!template) return "";
  return template
    .replace("{w}", "512")
    .replace("{h}", "512")
    .replace("{c}", "bb")
    .replace("{f}", "png");
}

async function fromWebPage(source, dependencies) {
  const country = source.country ?? "cn";
  const platform = source.platform ?? "iphone";
  // 36 is Apple's "全部类别" genre, which is what the rankings page falls back to
  // when no category is picked, and the segment it renders is the overall chart.
  const genre = encodeURIComponent(source.categoryId || "36");
  const url = `https://apps.apple.com/${encodeURIComponent(country)}/${encodeURIComponent(platform)}/charts/${genre}`;
  const segments = parseEmbeddedChartData(await dependencies.fetchText(url, { headers: { Accept: "text/html" } }));
  const wanted = segments.filter((segment) => segment.chart === source.chart);
  return wanted.flatMap((segment) => normalizeSegment(segment, { country }));
}

async function fromRssFeed(source, dependencies) {
  const country = source.country ?? "cn";
  const feed = chartFeeds[source.chart]?.rss;
  if (!feed) return [];
  const limit = Math.min(defaultChartLimit(), 200);
  const url = `https://itunes.apple.com/${encodeURIComponent(country)}/rss/${feed}/limit=${limit}/json`;
  const payload = JSON.parse(await dependencies.fetchText(url));
  return (payload?.feed?.entry ?? []).map((entry, index) => ({
    appId: String(entry?.id?.label ?? "").match(/\/id(\d+)/)?.[1] ?? "",
    // The feed carries no rank field, so array position is the rank.
    ordinal: index + 1,
    title: String(entry?.["im:name"]?.label ?? ""),
    developer: String(entry?.["im:artist"]?.label ?? ""),
    bundleId: "",
    icon: String(entry?.["im:image"]?.[0]?.label ?? ""),
    country
  })).filter((entry) => entry.appId && entry.title);
}

// The page is the richer source when it renders, and the feed covers the storefronts
// where it does not. Trying both keeps one storefront's layout change from blinding
// the monitor instead of only degrading its detail.
export async function fetchAppStoreChart(source, dependencies = { fetchText }) {
  const limit = defaultChartLimit();
  const attempts = [fromWebPage, fromRssFeed];
  let errors = [];
  for (const attempt of attempts) {
    try {
      const entries = (await attempt(source, dependencies)).slice(0, limit);
      if (entries.length) return entries;
      errors.push(new Error(`${source.chart} 榜单返回空数据`));
    } catch (error) {
      errors.push(error);
    }
  }
  throw new Error(`无法获取 App Store ${chartFeeds[source.chart]?.label ?? source.chart}：${errors.map((error) => error.message).join(" / ")}`);
}

function rankChanges(previous, current) {
  const before = new Map((previous ?? []).map((entry) => [entry.appId, entry]));
  const changes = [];
  const present = new Set();
  current.forEach((entry) => {
    present.add(entry.appId);
    const last = before.get(entry.appId);
    if (!last) {
      if (before.size) changes.push({ ...entry, movement: "new", previousOrdinal: null });
      return;
    }
    const delta = last.ordinal - entry.ordinal;
    // Only real movement is reported; an unchanged rank is not news.
    if (delta !== 0) changes.push({ ...entry, movement: delta > 0 ? "up" : "down", previousOrdinal: last.ordinal });
  });
  (previous ?? []).forEach((entry) => {
    if (!present.has(entry.appId)) changes.push({ ...entry, movement: "dropped" });
  });
  return changes;
}

const movementLabels = {
  new: (entry) => `新进榜 · 第 ${entry.ordinal} 名`,
  up: (entry) => `上升 ${entry.previousOrdinal - entry.ordinal} 位 → 第 ${entry.ordinal} 名`,
  down: (entry) => `下降 ${entry.ordinal - entry.previousOrdinal} 位 → 第 ${entry.ordinal} 名`,
  dropped: (entry) => `已跌出榜单（原第 ${entry.ordinal} 名）`
};

async function lookupVersions(entries, { country }, dependencies) {
  const appsById = new Map();
  const chunkSize = lookupChunkSize();
  for (let index = 0; index < entries.length; index += chunkSize) {
    const ids = entries.slice(index, index + chunkSize).map((entry) => encodeURIComponent(entry.appId)).join(",");
    const url = `https://itunes.apple.com/lookup?id=${ids}&country=${encodeURIComponent(country)}`;
    try {
      const payload = JSON.parse(await dependencies.fetchText(url));
      (payload?.results ?? []).forEach((app) => {
        if (app?.trackId) appsById.set(String(app.trackId), app);
      });
    } catch {
      // Ranking data is still worth reporting even when the version lookup fails.
    }
  }
  return appsById;
}

function artworkUrl(app, entry) {
  return String(app?.artworkUrl512 || app?.artworkUrl100 || app?.artworkUrl60 || entry.icon || "");
}

// Chart sources watch rank movement, and the same ids feed the version lookup so a
// charted app also reports its releases without becoming a separate source.
export async function collectAppStoreChart(source, dependencies = { fetchText }) {
  const country = source.country ?? "cn";
  const chart = chartFeeds[source.chart] ? source.chart : "top-free";
  const current = await fetchAppStoreChart({ ...source, chart }, dependencies);
  const previous = source.previousChart ?? [];
  const changes = rankChanges(previous, current);
  const watched = current.filter((entry) => source.watchVersions !== false).slice(0, Math.min(defaultChartLimit(), 200));
  const apps = await lookupVersions(watched.length ? watched : current, { country }, dependencies);

  const updates = changes.map((change) => {
    const app = apps.get(change.appId);
    const label = movementLabels[change.movement](change);
    return {
      externalId: `rank:${change.appId}:${change.movement}:${change.previousOrdinal ?? "-"}>${change.ordinal}`,
      // A rank move is not a release, so no version is claimed for it: the
      // movement lives in the title and the rank metadata instead.
      title: `${change.title} ${label}`,
      url: app?.trackViewUrl ?? `https://apps.apple.com/${country}/app/id${change.appId}`,
      publishedAt: new Date().toISOString(),
      summary: [
        chartFeeds[chart].label,
        change.developer || app?.artistName || "",
        app?.version ? `当前版本 ${app.version}` : ""
      ].filter(Boolean).join(" · "),
      metadata: {
        appId: change.appId,
        rank: change.ordinal,
        previousRank: change.previousOrdinal,
        movement: change.movement,
        chart,
        country,
        // Reuse the app-store metadata keys so one storefront chip and one price
        // row serve every Apple source instead of a chart-only variant.
        store: country,
        bundleId: change.bundleId || app?.bundleId || "",
        developer: change.developer || app?.artistName || "",
        artist: change.developer || app?.artistName || "",
        artworkUrl: artworkUrl(app, change),
        storePrice: app ? priceLabel(app, country) : null,
        appVersion: app?.version || "",
        screenshots: screenshots(app)
      }
    };
  });

  // Version updates are reported under the chart source so the ranked apps stay
  // monitored even when the user never added them one by one.
  if (source.watchVersions !== false) {
    const latestVersions = new Map();
    (source.previousVersions ?? []).forEach((entry) => latestVersions.set(entry.appId, entry.version));
    watched.forEach((entry) => {
      const app = apps.get(entry.appId);
      if (!app?.version) return;
      if (latestVersions.get(entry.appId) === app.version) return;
      updates.push({
        externalId: `version:${entry.appId}:${app.version}`,
        version: app.version,
        title: `${app.trackName} ${app.version}`,
        url: app.trackViewUrl ?? `https://apps.apple.com/${country}/app/id${entry.appId}`,
        publishedAt: app.currentVersionReleaseDate || new Date().toISOString(),
        summary: app.releaseNotes || "",
        metadata: {
          appId: entry.appId,
          rank: entry.ordinal,
          chart,
          country,
          store: country,
          bundleId: app.bundleId || "",
          developer: app.artistName || entry.developer || "",
          artist: app.artistName || entry.developer || "",
          artworkUrl: artworkUrl(app, entry),
          storePrice: priceLabel(app, country),
          appVersion: app.version,
          screenshots: screenshots(app)
        }
      });
    });
  }

  return {
    updates,
    chart,
    // The snapshot feeds the next run's diff, so it is returned next to the updates
    // instead of being written by the adapter.
    snapshot: {
      previousChart: current,
      previousVersions: watched.map((entry) => ({ appId: entry.appId, version: apps.get(entry.appId)?.version || "" })).filter((entry) => entry.version)
    }
  };
}

function priceLabel(app, country) {
  const formatted = String(app.formattedPrice ?? "").trim();
  const price = Number(app.price) === 0 || /^(free|免费)$/i.test(formatted) ? "免费" : formatted;
  return price ? { price, country, currency: app.currency || "" } : null;
}

function screenshots(app) {
  return [...new Set([
    ...(app?.screenshotUrls ?? []),
    ...(app?.ipadScreenshotUrls ?? [])
  ].filter((url) => typeof url === "string" && url.trim()))].slice(0, 10);
}
