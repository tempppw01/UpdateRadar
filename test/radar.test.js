import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectGithubReleases } from "../src/adapters/github-releases.js";
import { collectGithubCommits } from "../src/adapters/github-commits.js";
import { collectAppStore } from "../src/adapters/app-store.js";
import { collectDockerHub } from "../src/adapters/docker-hub.js";
import { collectNintendoSwitch } from "../src/adapters/nintendo-switch.js";
import { collectQnapApp } from "../src/adapters/qnap-app.js";
import { collectOfficialWebsite } from "../src/adapters/official-website.js";
import { collectPlayStation, collectXbox } from "../src/adapters/game-news.js";
import { collectSteam } from "../src/adapters/steam.js";
import { pollAll, sourcesDueForPolling } from "../src/radar.js";
import { JsonEventStore } from "../src/store.js";

test("GitHub collector ignores draft and prerelease versions by default", async () => {
  const updates = await collectGithubReleases({ owner: "acme", repo: "tool", includePrereleases: false }, {
    fetchText: async () => JSON.stringify([
      { id: 1, tag_name: "v2.0.0", name: "2.0", html_url: "https://example.test/2", published_at: "2026-01-02T00:00:00Z", body: "stable", draft: false, prerelease: false, assets: [{ name: "tool.zip", size: 2048, browser_download_url: "https://example.test/tool.zip", content_type: "application/zip" }] },
      { id: 2, tag_name: "v2.1.0-rc1", draft: false, prerelease: true },
      { id: 3, tag_name: "v0", draft: true, prerelease: false }
    ])
  });
  assert.equal(updates.length, 1);
  assert.equal(updates[0].version, "v2.0.0");
  assert.deepEqual(updates[0].metadata.assets, [{ name: "tool.zip", size: 2048, url: "https://example.test/tool.zip", contentType: "application/zip" }]);
});

test("GitHub commit collector normalizes recent commits", async () => {
  const [commit] = await collectGithubCommits({ owner: "acme", repo: "tool", branch: "dev" }, { fetchText: async () => JSON.stringify([{ sha: "abcdef0123456789", html_url: "https://example.test/commit", commit: { message: "Fix sync failure\n\nRetry transient errors.", author: { name: "Ada", date: "2026-01-02T00:00:00Z" } } }]) });
  assert.equal(commit.externalId, "abcdef0123456789");
  assert.equal(commit.title, "Fix sync failure");
  assert.equal(commit.metadata.branch, "dev");
  assert.equal(commit.summary, "Retry transient errors.");
});

test("Apple App Store collector adds official in-app purchase data to the application update", async () => {
  const source = { id: "chatgpt", name: "ChatGPT", appId: "6448311069", subscriptionId: "chatgpt-plus", country: "us" };
  const lookup = { results: [{
    trackId: 6448311069, trackName: "ChatGPT", version: "1.2.3", trackViewUrl: "https://apps.apple.com/us/app/chatgpt/id6448311069?uo=4", price: 0, formattedPrice: "Free",
    currentVersionReleaseDate: "2026-01-02T00:00:00Z", artworkUrl100: "https://example.test/icon.jpg",
    screenshotUrls: ["https://example.test/iphone-1.jpg", "https://example.test/shared.jpg"],
    ipadScreenshotUrls: ["https://example.test/ipad-1.jpg", "https://example.test/shared.jpg"],
    appletvScreenshotUrls: ["https://example.test/tv-1.jpg"]
  }] };
  const page = JSON.stringify({ addOns: [{ name: "ChatGPT Plus", price: "$19.99", buyParams: "offerName=chatgpt-plus&appAdamId=6448311069" }] });
  const responses = [JSON.stringify(lookup), page];
  const [update] = await collectAppStore(source, { fetchText: async () => responses.shift() });
  assert.match(update.externalId, /^6448311069:1\.2\.3:[a-f0-9]{16}$/);
  assert.equal(update.version, "1.2.3");
  assert.equal(update.metadata.inAppPurchase.price, "$19.99");
  assert.deepEqual(update.metadata.storePrice, { price: "免费", country: "us", currency: "" });
  assert.equal(update.metadata.artworkUrl, "https://example.test/icon.jpg");
  assert.deepEqual(update.metadata.screenshots, ["https://example.test/iphone-1.jpg", "https://example.test/shared.jpg", "https://example.test/ipad-1.jpg", "https://example.test/tv-1.jpg"]);
});

test("Docker Hub collector tracks tag digests and optional tag filters", async () => {
  const [update] = await collectDockerHub({ name: "NGINX", repository: "library/nginx", tagsFilter: ["latest"] }, {
    fetchText: async () => JSON.stringify({ results: [{ name: "latest", last_updated: "2026-01-02T00:00:00Z", full_size: 1048576, images: [{ os: "linux", architecture: "amd64", digest: "sha256:abc" }] }, { name: "edge", images: [] }] })
  });
  assert.equal(update.externalId, "library/nginx:latest:sha256:abc");
  assert.equal(update.version, "latest");
  assert.deepEqual(update.metadata.architectures, ["linux/amd64"]);
});

test("QNAP App Center collector reads the official app version and download", async () => {
  const responses = [JSON.stringify({ results: { qts: { version: [{ version: "5.2.9" }] } } }), JSON.stringify({ code: 200, app_list: [{ app_name: "ContainerStation", display_name: "Container Station", version: "3.0.0", detail: "Containers", icon: { 100: "https://example.test/icon.png" }, release_notes_link: "https://example.test/notes", download_links: { "TS-X64": { link: "https://example.test/app.qpkg" } } }] })];
  const [update] = await collectQnapApp({ qnapAppName: "Container Station", qnapOs: "qts" }, { fetchText: async () => responses.shift() });
  assert.equal(update.version, "3.0.0");
  assert.equal(update.metadata.appCenterVersion, "5.2.9");
  assert.equal(update.metadata.assets[0].url, "https://example.test/app.qpkg");
});

test("official website collector reads configured JSON fields and downloads", async () => {
  const fixture = { Windows: { version: "9.9.32", updateDate: "2026-07-16", ntDownloadX64Url: "https://example.test/QQ.exe", ntDownloadARMUrl: "https://example.test/QQ-arm.exe" } };
  const [update] = await collectOfficialWebsite({ name: "QQ Windows", officialUrl: "https://example.test/qq.json", officialFormat: "json", versionPath: "Windows.version", publishedAtPath: "Windows.updateDate", downloadPath: "Windows" }, { fetchText: async () => JSON.stringify(fixture) });
  assert.equal(update.externalId, "9.9.32");
  assert.equal(update.publishedAt, "2026-07-16T00:00:00.000Z");
  assert.deepEqual(update.metadata.assets, [{ name: "官方下载 ntDownloadX64Url", url: "https://example.test/QQ.exe" }, { name: "官方下载 ntDownloadARMUrl", url: "https://example.test/QQ-arm.exe" }]);
});

test("official website collector reads a static HTML version with regex rules", async () => {
  const [update] = await collectOfficialWebsite({ name: "Example", officialUrl: "https://example.test/download", officialFormat: "html", versionPath: "Version\\s+([\\d.]+)", publishedAtPath: "Updated:\\s*([\\d-]+)", downloadPath: 'href="([^"]+\\.dmg)"' }, { fetchText: async () => '<p>Version 2.4.0</p><p>Updated: 2026-07-16</p><a href="https://example.test/Example.dmg">Download</a>' });
  assert.equal(update.version, "2.4.0");
  assert.equal(update.metadata.assets[0].url, "https://example.test/Example.dmg");
});

test("Nintendo Switch collector filters official update announcements by game", async () => {
  const state = { props: { pageProps: { initialApolloState: { one: { __typename: "NewsArticle", id: "update-1", title: "Mario Kart World update available now", body: { text: "A new patch is ready." }, publishDate: "2026-01-02T00:00:00Z", 'url({"relative":true})': "/us/whatsnew/mario-kart-world-update/" }, two: { __typename: "NewsArticle", id: "other-1", title: "Other game update", body: { text: "Patch notes" }, publishDate: "2026-01-03T00:00:00Z", 'url({"relative":true})': "/us/whatsnew/other/" } } } } };
  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(state)}</script>`;
  const [update] = await collectNintendoSwitch({ gameName: "Mario Kart World", nintendoRegion: "us" }, { fetchText: async () => html });
  assert.equal(update.externalId, "update-1");
  assert.equal(update.url, "https://www.nintendo.com/us/whatsnew/mario-kart-world-update/");
});

test("Steam collector reads official game announcements", async () => {
  const [update] = await collectSteam({ steamAppId: "1245620" }, { fetchText: async () => JSON.stringify({ appnews: { newsitems: [{ gid: "steam-1", title: "Patch 1.2", url: "https://example.test/news", date: 1767225600, contents: "<b>Balance</b> update", feedlabel: "Steam Announcements", is_external_url: false }] } }) });
  assert.equal(update.externalId, "steam-1");
  assert.equal(update.summary, "Balance update");
});

test("PlayStation and Xbox collectors filter official update articles", async () => {
  const feed = "<rss><channel><item><guid>patch-1</guid><title>Helldivers 2 patch update</title><link>https://example.test/patch</link><pubDate>2026-01-02T00:00:00Z</pubDate><description>Patch notes</description></item></channel></rss>";
  const dependencies = { fetchText: async () => feed };
  assert.equal((await collectPlayStation({ gameName: "Helldivers 2" }, dependencies)).length, 1);
  assert.equal((await collectXbox({ gameName: "Helldivers 2" }, dependencies)).length, 1);
});

test("polling records a new update only once", async () => {
  const directory = await mkdtemp(join(tmpdir(), "update-radar-"));
  const store = new JsonEventStore(join(directory, "events.json"));
  const source = { id: "tool", name: "Tool", kind: "test", enabled: true, tags: ["dev"] };
  const collectorResolver = () => async () => [{
    externalId: "v1", title: "Tool v1", url: "https://example.test/v1", publishedAt: "2026-01-01T00:00:00Z", summary: "first"
  }];

  assert.deepEqual(await pollAll([source], { store, collectorResolver }), [{ ok: true, sourceId: "tool", fetched: 1, inserted: 1 }]);
  assert.deepEqual(await pollAll([source], { store, collectorResolver }), [{ ok: true, sourceId: "tool", fetched: 1, inserted: 0 }]);
  assert.equal((await store.list({ tag: "dev" })).length, 1);
});

test("polling limits concurrent source requests", async () => {
  let active = 0;
  let maximum = 0;
  const sources = Array.from({ length: 5 }, (_, index) => ({ id: `source-${index}`, name: `Source ${index}`, kind: "test", enabled: true, tags: [] }));
  const collectorResolver = () => async (source) => {
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return [{ externalId: "v1", title: source.name, url: "https://example.test", publishedAt: "2026-01-01T00:00:00Z" }];
  };
  const directory = await mkdtemp(join(tmpdir(), "update-radar-concurrency-"));
  await pollAll(sources, { store: new JsonEventStore(join(directory, "events.json")), collectorResolver, concurrency: 2 });
  assert.equal(maximum, 2);
});

test("event store persists the most recent completed sync time", async () => {
  const directory = await mkdtemp(join(tmpdir(), "update-radar-sync-"));
  const store = new JsonEventStore(join(directory, "events.json"));
  await store.markSyncedAt("2026-01-02T03:04:05.000Z");
  assert.equal(await store.lastSyncedAt(), "2026-01-02T03:04:05.000Z");
});

test("recently updated sources respect their polling cooldown", () => {
  const now = Date.parse("2026-01-01T01:00:00Z");
  const { due, skipped } = sourcesDueForPolling([{ id: "recent", enabled: true, cooldownMinutes: 60 }, { id: "old", enabled: true, cooldownMinutes: 60 }, { id: "always", enabled: true, cooldownMinutes: 0 }], { recent: "2026-01-01T00:30:00Z", old: "2025-12-31T23:00:00Z", always: "2026-01-01T00:59:00Z" }, now);
  assert.deepEqual(due.map((source) => source.id), ["old", "always"]);
  assert.equal(skipped[0].sourceId, "recent");
  assert.equal(skipped[0].nextPollAt, "2026-01-01T01:30:00.000Z");
});

test("event store removes events belonging to deleted sources", async () => {
  const directory = await mkdtemp(join(tmpdir(), "update-radar-events-"));
  const store = new JsonEventStore(join(directory, "events.json"));
  await store.insert({ id: "one", name: "One", kind: "test", tags: [] }, { externalId: "1", title: "One", url: "https://example.test/1", publishedAt: "2026-01-01T00:00:00Z" });
  await store.insert({ id: "two", name: "Two", kind: "test", tags: [] }, { externalId: "2", title: "Two", url: "https://example.test/2", publishedAt: "2026-01-01T00:00:00Z" });
  assert.equal(await store.removeBySourceIds(["one"]), 1);
  assert.equal((await store.list({ limit: 10 })).length, 1);
  assert.equal(await store.removeOutsideSourceIds(["two"]), 0);
});
