import { fetchText } from "../lib/http.js";

export async function collectSteam(source, dependencies = { fetchText }) {
  const url = new URL("https://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/");
  url.searchParams.set("appid", source.steamAppId);
  url.searchParams.set("count", "30");
  url.searchParams.set("maxlength", "4000");
  url.searchParams.set("feeds", "steam_community_announcements");
  url.searchParams.set("format", "json");
  const payload = JSON.parse(await dependencies.fetchText(url));

  return (payload.appnews?.newsitems ?? []).map((item) => ({
    externalId: item.gid,
    title: item.title,
    url: item.url || `https://store.steampowered.com/news/app/${source.steamAppId}`,
    publishedAt: new Date(Number(item.date) * 1000 || Date.now()).toISOString(),
    summary: String(item.contents || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    metadata: { appId: source.steamAppId, feed: item.feedlabel || "Steam Announcements", external: item.is_external_url === true }
  }));
}
