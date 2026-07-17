import { fetchText } from "../lib/http.js";
import { fetchInAppPurchase } from "./app-store-purchase.js";

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

export async function collectAppStore(source, dependencies = { fetchText }) {
  const country = source.country ?? "us";
  const url = `https://itunes.apple.com/lookup?id=${encodeURIComponent(source.appId)}&country=${encodeURIComponent(country)}`;
  const payload = JSON.parse(await dependencies.fetchText(url));
  const app = payload.results?.[0];
  if (!app) return [];
  const inAppPurchase = await fetchInAppPurchase(source, app, dependencies);
  const storePrice = appPrice(app, country);
  const screenshots = appScreenshots(app);

  return [{
    externalId: `${app.trackId}:${app.version}${inAppPurchase ? `:${inAppPurchase.fingerprint}` : ""}`,
    version: app.version,
    title: `${app.trackName} ${app.version}`,
    url: inAppPurchase?.url ?? app.trackViewUrl,
    publishedAt: app.currentVersionReleaseDate,
    summary: app.releaseNotes || "",
    metadata: {
      bundleId: app.bundleId, artist: app.artistName, store: country,
      artworkUrl: app.artworkUrl512 || app.artworkUrl100 || app.artworkUrl60 || "",
      storePrice,
      inAppPurchase,
      screenshots
    }
  }];
}
