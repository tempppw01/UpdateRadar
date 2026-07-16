import { fetchText } from "../lib/http.js";
import { parseFeed } from "../lib/xml.js";

export async function collectRss(source, dependencies = { fetchText, parseFeed }) {
  const xml = await dependencies.fetchText(source.feedUrl);
  return dependencies.parseFeed(xml).map((item) => ({
    externalId: item.id,
    title: item.title,
    url: item.url || source.feedUrl,
    publishedAt: item.publishedAt || new Date().toISOString(),
    summary: item.summary,
    metadata: { feedUrl: source.feedUrl }
  }));
}
