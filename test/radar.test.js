import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectGithubReleases } from "../src/adapters/github-releases.js";
import { collectAppStorePrice } from "../src/adapters/app-store-price.js";
import { pollAll } from "../src/radar.js";
import { JsonEventStore } from "../src/store.js";

test("GitHub collector ignores draft and prerelease versions by default", async () => {
  const updates = await collectGithubReleases({ owner: "acme", repo: "tool", includePrereleases: false }, {
    fetchText: async () => JSON.stringify([
      { id: 1, tag_name: "v2.0.0", name: "2.0", html_url: "https://example.test/2", published_at: "2026-01-02T00:00:00Z", body: "stable", draft: false, prerelease: false, assets: [] },
      { id: 2, tag_name: "v2.1.0-rc1", draft: false, prerelease: true },
      { id: 3, tag_name: "v0", draft: true, prerelease: false }
    ])
  });
  assert.equal(updates.length, 1);
  assert.equal(updates[0].version, "v2.0.0");
});

test("App Store Price collector fingerprints subscription prices in their native currencies", async () => {
  const flight = '{"name":"ChatGPT Plus","subscriptionId":"chatgpt-plus","prices":[{"region":"PH","regionName":"菲律宾","currency":"PHP","price":999,"priceCny":109.74},{"region":"US","regionName":"美国","currency":"USD","price":19.99,"priceCny":135.5}]}';
  const html = `<script>self.__next_f.push([1,"${JSON.stringify(flight).slice(1, -1)}"])</script>`;
  const source = { id: "chatgpt-plus", name: "ChatGPT Plus 全球订阅价格", appId: "6448311069", subscriptionId: "chatgpt-plus", locale: "zh" };
  const [update] = await collectAppStorePrice(source, { fetchText: async () => html });
  assert.match(update.externalId, /^chatgpt-plus:[a-f0-9]{16}$/);
  assert.equal(update.metadata.prices.length, 2);
  assert.match(update.summary, /菲律宾 PHP 999/);
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
