import { fetchText } from "../lib/http.js";
import { fetchInAppPurchase } from "./app-store-purchase.js";

// Apple's lookup endpoint accepts many comma-separated ids in one call, so a large
// catalog costs a handful of requests instead of one per app. Requests are grouped
// by country first, and the group is then chunked: a long id list is exactly the
// kind of oversized request that trips the 431 responses this adapter must avoid.
const lookupChunkSize = () => Math.min(Math.max(Number(process.env.APP_STORE_LOOKUP_CHUNK ?? "25") || 25, 1), 100);
const inAppPurchaseDelayMs = () => Math.min(Math.max(Number(process.env.APP_STORE_PURCHASE_DELAY_MS ?? "800") || 0, 0), 10_000);

function appPrice(app, country) {
  const numericPrice = Number(app.price);
  const formattedPrice = String(app.formattedPrice ?? "").trim();
  const price = numericPrice === 0 || /^(free|免费)$/i.test(formattedPrice)
    ? "免费"
    : formattedPrice || (Number.isFinite(numericPrice) ? `${app.currency || ""} ${numericPrice}`.trim() : "");
  return price ? { price, country, currency: app.currency || "" } : null;
}

function appScreenshots(app) {
  return [...new Set([
    ...(app.screenshotUrls ?? []),
    ...(app.ipadScreenshotUrls ?? []),
    ...(app.appletvScreenshotUrls ?? [])
  ].filter((url) => typeof url === "string" && url.trim()))].slice(0, 10);
}

function toUpdate(app, country, inAppPurchase) {
  return {
    externalId: `${app.trackId}:${app.version}${inAppPurchase ? `:${inAppPurchase.fingerprint}` : ""}`,
    version: app.version,
    title: `${app.trackName} ${app.version}`,
    url: inAppPurchase?.url ?? app.trackViewUrl,
    publishedAt: app.currentVersionReleaseDate,
    summary: app.releaseNotes || "",
    metadata: {
      bundleId: app.bundleId, artist: app.artistName, store: country,
      artworkUrl: app.artworkUrl512 || app.artworkUrl100 || app.artworkUrl60 || "",
      storePrice: appPrice(app, country),
      inAppPurchase,
      screenshots: appScreenshots(app)
    }
  };
}

export async function collectAppStore(source, dependencies = { fetchText }) {
  const country = source.country ?? "us";
  const entity = source.kind === "mac-app-store" ? "&entity=macSoftware" : "";
  const url = `https://itunes.apple.com/lookup?id=${encodeURIComponent(source.appId)}&country=${encodeURIComponent(country)}${entity}`;
  const payload = JSON.parse(await dependencies.fetchText(url));
  const app = payload.results?.[0];
  if (!app) return [];
  const inAppPurchase = await fetchInAppPurchase(source, app, dependencies);
  return [toUpdate(app, country, inAppPurchase)];
}

// Collects many App Store sources at once and reports one entry per source so a
// single failed id cannot discard the updates of its whole group.
export async function collectAppStoreBatch(sources, dependencies = { fetchText }) {
  const groups = new Map();
  sources.forEach((source) => {
    const country = source.country ?? "us";
    const entity = source.kind === "mac-app-store" ? "macSoftware" : "";
    const key = `${country}|${entity}`;
    if (!groups.has(key)) groups.set(key, { country, entity, sources: [] });
    groups.get(key).sources.push(source);
  });

  const results = [];
  const purchaseTasks = [];
  for (const { country, entity, sources: grouped } of groups.values()) {
    const chunkSize = lookupChunkSize();
    for (let index = 0; index < grouped.length; index += chunkSize) {
      const chunk = grouped.slice(index, index + chunkSize);
      const ids = chunk.map((source) => encodeURIComponent(source.appId)).join(",");
      const url = `https://itunes.apple.com/lookup?id=${ids}&country=${encodeURIComponent(country)}${entity ? `&entity=${entity}` : ""}`;
      let apps = [];
      try {
        apps = JSON.parse(await dependencies.fetchText(url)).results ?? [];
      } catch (error) {
        // Report the chunk's failure against each member instead of aborting the run.
        chunk.forEach((source) => results.push({
          sourceId: source.id,
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        }));
        continue;
      }
      const appById = new Map(apps.map((app) => [String(app.trackId), app]));
      for (const source of chunk) {
        const app = appById.get(String(source.appId));
        if (!app) {
          results.push({ sourceId: source.id, ok: true, updates: [] });
          continue;
        }
        if (source.subscriptionId) purchaseTasks.push({ source, app, country });
        else results.push({ sourceId: source.id, ok: true, updates: [toUpdate(app, country, null)] });
      }
    }
  }

  // In-app purchase detail comes from a separate apps.apple.com page per app, so it
  // stays sequential with a pause between pages to keep that host's burst low.
  for (const [index, task] of purchaseTasks.entries()) {
    if (index > 0) await new Promise((resolve) => { setTimeout(resolve, inAppPurchaseDelayMs()); });
    const { source, app, country } = task;
    try {
      results.push({ sourceId: source.id, ok: true, updates: [toUpdate(app, country, await fetchInAppPurchase(source, app, dependencies))] });
    } catch (error) {
      // The lookup succeeded, so keep the version update instead of failing the source.
      results.push({ sourceId: source.id, ok: true, updates: [toUpdate(app, country, null)] });
    }
  }
  return results;
}
