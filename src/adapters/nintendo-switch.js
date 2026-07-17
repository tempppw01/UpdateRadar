import { fetchText } from "../lib/http.js";

function comparable(value = "") {
  return String(value).normalize("NFKD").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
}

function newsArticles(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) return [];
  const state = JSON.parse(match[1]).props?.pageProps?.initialApolloState ?? {};
  return Object.values(state).filter((item) => item?.__typename === "NewsArticle");
}

function articleText(article) {
  return Object.entries(article.body ?? {}).find(([key, value]) => key.startsWith("text") && typeof value === "string")?.[1] ?? "";
}

function articleUrl(article) {
  const value = Object.entries(article).find(([key, candidate]) => key.startsWith("url") && typeof candidate === "string")?.[1] ?? "";
  return value.startsWith("http") ? value : `https://www.nintendo.com${value}`;
}

export async function collectNintendoSwitch(source, dependencies = { fetchText }) {
  const region = source.nintendoRegion ?? "us";
  const indexUrl = `https://www.nintendo.com/${region}/whatsnew/`;
  const query = comparable(source.gameName);
  const updatePattern = /\b(update|updates|patch|patches|version)\b/i;

  return newsArticles(await dependencies.fetchText(indexUrl))
    .filter((article) => {
      const content = `${article.title ?? ""} ${articleText(article)}`;
      return comparable(content).includes(query) && updatePattern.test(content);
    })
    .map((article) => ({
      externalId: article.id,
      title: article.title,
      url: articleUrl(article),
      publishedAt: article.publishDate || new Date().toISOString(),
      summary: articleText(article),
      metadata: { gameName: source.gameName, region, officialNews: true }
    }));
}
