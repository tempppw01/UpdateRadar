import { fetchText } from "../lib/http.js";
import { fetchInAppPurchase } from "./app-store-purchase.js";

export async function collectAppStore(source, dependencies = { fetchText }) {
  const country = source.country ?? "us";
  const url = `https://itunes.apple.com/lookup?id=${encodeURIComponent(source.appId)}&country=${encodeURIComponent(country)}`;
  const payload = JSON.parse(await dependencies.fetchText(url));
  const app = payload.results?.[0];
  if (!app) return [];
  const inAppPurchase = await fetchInAppPurchase(source, app, dependencies);

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
      inAppPurchase
    }
  }];
}
