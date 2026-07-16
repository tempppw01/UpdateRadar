import { fetchText } from "../lib/http.js";

export async function collectAppStore(source, dependencies = { fetchText }) {
  const country = source.country ?? "us";
  const url = `https://itunes.apple.com/lookup?id=${encodeURIComponent(source.appId)}&country=${encodeURIComponent(country)}`;
  const payload = JSON.parse(await dependencies.fetchText(url));
  const app = payload.results?.[0];
  if (!app) return [];

  return [{
    externalId: `${app.trackId}:${app.version}`,
    version: app.version,
    title: `${app.trackName} ${app.version}`,
    url: app.trackViewUrl,
    publishedAt: app.currentVersionReleaseDate,
    summary: app.releaseNotes || "",
    metadata: { bundleId: app.bundleId, artist: app.artistName, store: country }
  }];
}
