import { fetchText } from "../lib/http.js";
import { parseFeed } from "../lib/xml.js";

function comparable(value = "") {
  return String(value).normalize("NFKD").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
}

export async function collectOfficialGameNews(source, { feedUrl, provider, fetchText: fetch = fetchText, parseFeed: parse = parseFeed } = {}) {
  const terms = [source.gameName, ...(source.gameAliases ?? [])].map(comparable).filter(Boolean);
  const updates = /\b(update|updates|patch|patches|version|hotfix|title update)\b/i;
  return parse(await fetch(feedUrl)).filter((item) => {
    const content = `${item.title} ${item.summary}`;
    return terms.some((term) => comparable(content).includes(term)) && updates.test(content);
  }).map((item) => ({
    externalId: item.id,
    title: item.title,
    url: item.url || feedUrl,
    publishedAt: item.publishedAt || new Date().toISOString(),
    summary: item.summary || "",
    metadata: { gameName: source.gameName, provider, officialNews: true }
  }));
}

export const collectPlayStation = (source, dependencies = {}) => collectOfficialGameNews(source, { ...dependencies, feedUrl: "https://blog.playstation.com/feed/", provider: "PlayStation Blog" });
export const collectXbox = (source, dependencies = {}) => collectOfficialGameNews(source, { ...dependencies, feedUrl: "https://news.xbox.com/en-us/feed/", provider: "Xbox Wire" });
