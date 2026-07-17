import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectGithubReleases } from "../src/adapters/github-releases.js";
import { collectAppStore } from "../src/adapters/app-store.js";
import { pollAll } from "../src/radar.js";
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

test("Apple App Store collector adds official in-app purchase data to the application update", async () => {
  const source = { id: "chatgpt", name: "ChatGPT", appId: "6448311069", subscriptionId: "chatgpt-plus", country: "us" };
  const lookup = { results: [{
    trackId: 6448311069, trackName: "ChatGPT", version: "1.2.3", trackViewUrl: "https://apps.apple.com/us/app/chatgpt/id6448311069?uo=4",
    currentVersionReleaseDate: "2026-01-02T00:00:00Z", artworkUrl100: "https://example.test/icon.jpg"
  }] };
  const page = JSON.stringify({ addOns: [{ name: "ChatGPT Plus", price: "$19.99", buyParams: "offerName=chatgpt-plus&appAdamId=6448311069" }] });
  const responses = [JSON.stringify(lookup), page];
  const [update] = await collectAppStore(source, { fetchText: async () => responses.shift() });
  assert.match(update.externalId, /^6448311069:1\.2\.3:[a-f0-9]{16}$/);
  assert.equal(update.version, "1.2.3");
  assert.equal(update.metadata.inAppPurchase.price, "$19.99");
  assert.equal(update.metadata.artworkUrl, "https://example.test/icon.jpg");
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
