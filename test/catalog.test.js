import assert from "node:assert/strict";
import test from "node:test";
import { searchAppStore, searchDockerHubRepositories, searchGithubRepositories, searchNintendoSwitchGames, searchQnapApps, searchSteamGames } from "../src/catalog.js";

test("App Store search normalizes official catalog results", async () => {
  let requestedUrl;
  const results = await searchAppStore({ term: "Things", country: "us", limit: 5 }, {
    fetchText: async (url) => {
      requestedUrl = new URL(url);
      return JSON.stringify({ results: [{
        trackId: 904280696, trackName: "Things 3", version: "3.21", artistName: "Cultured Code",
        primaryGenreName: "Productivity", artworkUrl100: "https://example.test/icon.png", trackViewUrl: "https://example.test/app"
      }] });
    }
  });
  assert.equal(requestedUrl.searchParams.get("term"), "Things");
  assert.equal(requestedUrl.searchParams.get("media"), "software");
  assert.deepEqual(results, [{
    appId: "904280696", name: "Things 3", version: "3.21", developer: "Cultured Code", genre: "Productivity",
    artworkUrl: "https://example.test/icon.png", url: "https://example.test/app", country: "us"
  }]);
});

test("GitHub repository search normalizes official repository results", async () => {
  let requestedUrl;
  const results = await searchGithubRepositories({ query: "node", limit: 5 }, {
    fetchText: async (url) => {
      requestedUrl = new URL(url);
      return JSON.stringify({ items: [{ owner: { login: "nodejs" }, name: "node", full_name: "nodejs/node", description: "JavaScript runtime", html_url: "https://github.com/nodejs/node", stargazers_count: 123 }] });
    }
  });
  assert.equal(requestedUrl.searchParams.get("q"), "node");
  assert.deepEqual(results, [{ owner: "nodejs", repo: "node", name: "nodejs/node", description: "JavaScript runtime", url: "https://github.com/nodejs/node", stars: 123 }]);
});

test("Docker Hub search normalizes official image repositories", async () => {
  const results = await searchDockerHubRepositories({ query: "nginx" }, { fetchText: async () => JSON.stringify({ results: [{ repo_name: "nginx", is_official: true, short_description: "Official image", pull_count: 10, star_count: 2 }] }) });
  assert.deepEqual(results, [{ repository: "library/nginx", name: "library/nginx", description: "Official image", pulls: 10, stars: 2, official: true }]);
});

test("QNAP search uses the latest selected App Center release", async () => {
  const responses = [JSON.stringify({ results: { qts: { version: [{ version: "5.2.9" }] } } }), JSON.stringify({ app_list: [{ app_name: "ContainerStation", display_name: "Container Station", version: "3.1.2", detail: "Containers", icon: { 100: "https://example.test/icon.png" } }] })];
  const results = await searchQnapApps({ term: "container", os: "qts" }, { fetchText: async () => responses.shift() });
  assert.equal(results[0].appName, "ContainerStation");
  assert.equal(results[0].osVersion, "5.2.9");
});

test("Nintendo Switch search lists matching official update announcements", async () => {
  const state = { props: { pageProps: { initialApolloState: { one: { __typename: "NewsArticle", title: "Mario Kart World update available now", publishDate: "2026-01-02T00:00:00Z" } } } } };
  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(state)}</script>`;
  const results = await searchNintendoSwitchGames({ term: "mario kart" }, { fetchText: async () => html });
  assert.equal(results[0].gameName, "Mario Kart World");
});

test("Steam search supports Chinese game names", async () => {
  const results = await searchSteamGames({ term: "艾尔登法环" }, { fetchText: async () => JSON.stringify({ items: [{ type: "app", id: 1245620, name: "艾尔登法环", tiny_image: "https://example.test/elden.jpg", platforms: { windows: true, mac: false, linux: false } }] }) });
  assert.deepEqual(results, [{ appId: "1245620", name: "艾尔登法环", artworkUrl: "https://example.test/elden.jpg", meta: "windows" }]);
});
