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

export async function searchGithubRepositories({ query, limit = 10 }, dependencies = { fetchText }) {
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", query);
  url.searchParams.set("per_page", String(Math.min(Math.max(Number(limit) || 10, 1), 20)));
  const payload = JSON.parse(await dependencies.fetchText(url, { headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } }));
  return (payload.items ?? []).filter((repository) => repository.owner?.login && repository.name).map((repository) => ({
    owner: repository.owner.login,
    repo: repository.name,
    name: repository.full_name,
    description: repository.description || "",
    url: repository.html_url,
    stars: repository.stargazers_count || 0
  }));
}

export async function searchDockerHubRepositories({ query, limit = 10 }, dependencies = { fetchText }) {
  const url = new URL("https://hub.docker.com/v2/search/repositories/");
  url.searchParams.set("query", query);
  url.searchParams.set("page_size", String(Math.min(Math.max(Number(limit) || 10, 1), 20)));
  const payload = JSON.parse(await dependencies.fetchText(url));
  return (payload.results ?? []).filter((item) => item.repo_name).map((item) => {
    const repository = item.is_official && !item.repo_name.includes("/") ? `library/${item.repo_name}` : item.repo_name;
    return { repository, name: repository, description: item.short_description || "", pulls: item.pull_count || 0, stars: item.star_count || 0, official: item.is_official === true };
  });
}

export async function searchQnapApps({ term, os = "qts", limit = 10 }, dependencies = { fetchText }) {
  const catalog = JSON.parse(await dependencies.fetchText("https://www.qnap.com/api/v1/app-center"));
  const osVersion = catalog.results?.[os]?.version?.[0]?.version;
  if (!osVersion) return [];
  const url = new URL("https://www.qnap.com/api/v1/app-center/detail");
  url.searchParams.set("os", os);
  url.searchParams.set("version", osVersion);
  url.searchParams.set("locale", "en");
  const payload = JSON.parse(await dependencies.fetchText(url));
  const query = term.toLowerCase();
  return (payload.app_list ?? []).filter((app) => `${app.app_name} ${app.display_name}`.toLowerCase().includes(query)).slice(0, Math.min(Math.max(Number(limit) || 10, 1), 20)).map((app) => ({
    appName: app.app_name,
    name: app.display_name || app.app_name,
    version: app.version || "未知版本",
    description: app.detail || "",
    artworkUrl: app.icon?.[100] || "",
    os,
    osVersion
  }));
}

export async function searchNintendoSwitchGames({ term, limit = 10 }, dependencies = { fetchText }) {
  const html = await dependencies.fetchText("https://www.nintendo.com/us/whatsnew/");
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) return [];
  const state = JSON.parse(match[1]).props?.pageProps?.initialApolloState ?? {};
  const query = term.toLowerCase();
  const seen = new Set();
  return Object.values(state).filter((item) => item?.__typename === "NewsArticle" && /\b(update|updates|patch|patches|version)\b/i.test(item.title ?? "") && item.title.toLowerCase().includes(query)).map((item) => {
    const gameName = item.title.replace(/\s+(update|updates|patch|patches|version)\b[\s\S]*/i, "").trim();
    return { gameName, title: item.title, publishedAt: item.publishDate || "" };
  }).filter((item) => item.gameName && !seen.has(item.gameName.toLowerCase()) && seen.add(item.gameName.toLowerCase())).slice(0, Math.min(Math.max(Number(limit) || 10, 1), 20));
}
