import { fetchText } from "./lib/http.js";

export async function searchAppStore({ term, country = "us", limit = 10 }, dependencies = { fetchText }) {
  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", term);
  url.searchParams.set("country", country);
  url.searchParams.set("media", "software");
  url.searchParams.set("entity", "software");
  url.searchParams.set("limit", String(Math.min(Math.max(Number(limit) || 10, 1), 20)));
  const payload = JSON.parse(await dependencies.fetchText(url));

  return (payload.results ?? []).filter((app) => app.trackId && app.trackName).map((app) => ({
    appId: String(app.trackId),
    name: app.trackName,
    version: app.version || "未知版本",
    developer: app.artistName || "未知开发者",
    genre: app.primaryGenreName || "App Store",
    artworkUrl: app.artworkUrl100 || app.artworkUrl60 || "",
    url: app.trackViewUrl || "",
    country
  }));
}
