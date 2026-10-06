import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectAppStoreChart, fetchAppStoreChart } from "../src/adapters/app-store-charts.js";
import { pollAll } from "../src/radar.js";
import { normalizeSource } from "../src/sources.js";
import { JsonEventStore } from "../src/store.js";

function chartSegment(chart, apps) {
  return JSON.stringify({
    data: [{
      data: {
        charts: [{
          genreId: "36",
          segments: [{
            $kind: "TopChartSegment",
            chart,
            shortName: chart,
            shelves: [{
              items: apps.map((app, index) => ({
                $kind: "smallLockup",
                adamId: String(app.appId),
                ordinal: index + 1,
                title: app.title,
                developerName: app.developer ?? "Studio",
                bundleId: app.bundleId ?? `com.example.${app.appId}`,
                icon: { template: `https://example.test/${app.appId}.png/{w}x{h}{c}.{f}` }
              }))
            }]
          }]
        }]
      }
    }]
  });
}

function rssFeed(apps) {
  return JSON.stringify({
    feed: {
      entry: apps.map((app) => ({
        id: { label: `https://apps.apple.com/cn/app/x/id${app.appId}?uo=2` },
        "im:name": { label: app.title },
        "im:artist": { label: app.developer ?? "Studio" },
        "im:image": [{ label: `https://example.test/${app.appId}-small.png` }]
      }))
    }
  });
}

function lookupResponse(versions) {
  return JSON.stringify({
    results: Object.entries(versions).map(([appId, version]) => ({
      trackId: Number(appId),
      trackName: `App ${appId}`,
      version,
      currentVersionReleaseDate: "2026-02-01T00:00:00Z",
      formattedPrice: "免费",
      price: 0,
      currency: "CNY"
    }))
  });
}

// A transport that serves the ranking page and the version lookup, and counts calls
// so the batching behaviour can be asserted.
function chartTransport(apps, versions = {}) {
  const calls = [];
  const fetchText = async (url) => {
    calls.push(url);
    if (url.includes("/lookup?")) {
      const ids = new URL(url).searchParams.get("id").split(",").map(Number);
      return lookupResponse(Object.fromEntries(ids.filter((id) => versions[id]).map((id) => [id, versions[id]])));
    }
    return `<html><script id="serialized-server-data" type="application/json">${chartSegment("top-free", apps)}</script></html>`;
  };
  return { fetchText, calls };
}

const baseSource = { id: "cn-free", name: "免费榜", kind: "app-store-charts", country: "cn", chart: "top-free", platform: "iphone", watchVersions: true };

test("chart source reads the ranking page and falls back to the RSS feed", async () => {
  const apps = [{ appId: 111, title: "Alpha" }, { appId: 222, title: "Beta" }];
  const page = await fetchAppStoreChart(baseSource, chartTransport(apps));
  assert.deepEqual(page.map((entry) => [entry.appId, entry.ordinal, entry.title]), [["111", 1, "Alpha"], ["222", 2, "Beta"]]);
  assert.equal(page[0].bundleId, "com.example.111");
  // Apple ships icons as a size template, so the placeholders must be resolved here.
  assert.equal(page[0].icon, "https://example.test/111.png/512x512bb.png");

  // A storefront that does not render the page server-side still resolves via RSS.
  const fallback = await fetchAppStoreChart(baseSource, { fetchText: async () => rssFeed(apps) });
  assert.deepEqual(fallback.map((entry) => [entry.appId, entry.ordinal]), [["111", 1], ["222", 2]]);
});

test("the first chart poll establishes a baseline instead of reporting every app as new", async () => {
  const apps = [{ appId: 111, title: "Alpha" }, { appId: 222, title: "Beta" }];
  const result = await collectAppStoreChart({ ...baseSource, watchVersions: false }, chartTransport(apps));
  assert.equal(result.updates.length, 0);
  assert.equal(result.snapshot.previousChart.length, 2);
});

test("only real rank movement becomes an update", async () => {
  const apps = [{ appId: 111, title: "Alpha" }, { appId: 222, title: "Beta" }, { appId: 333, title: "Gamma" }];
  const transport = chartTransport(apps);
  const first = await collectAppStoreChart({ ...baseSource, watchVersions: false }, transport);
  // Beta climbs, Gamma falls, Alpha holds its rank.
  const previousChart = [
    { ...first.snapshot.previousChart[0], ordinal: 1 },
    { ...first.snapshot.previousChart[1], ordinal: 3 },
    { ...first.snapshot.previousChart[2], ordinal: 2 }
  ];
  const { updates } = await collectAppStoreChart({ ...baseSource, watchVersions: false, previousChart }, transport);
  assert.deepEqual(updates.map((update) => update.metadata.appId).sort(), ["222", "333"]);
  const up = updates.find((update) => update.metadata.appId === "222");
  assert.equal(up.metadata.movement, "up");
  assert.equal(up.metadata.previousRank, 3);
  assert.equal(up.metadata.rank, 2);
  assert.match(up.title, /上升 1 位/);
  const down = updates.find((update) => update.metadata.appId === "333");
  assert.equal(down.metadata.movement, "down");
  assert.equal(down.metadata.rank, 3);
  assert.equal(down.metadata.previousRank, 2);
  assert.match(down.title, /下降 1 位/);
  // A position change is not a release, so it must not claim a version.
  assert.equal(up.version, undefined);
  assert.equal(down.version, undefined);
  assert.equal(up.metadata.store, "cn");
});

test("new entrants and dropped apps are reported in both directions", async () => {
  const apps = [{ appId: 111, title: "Alpha" }];
  const transport = chartTransport(apps);
  const previousChart = [{ appId: "999", ordinal: 3, title: "Gone", country: "cn" }];
  const { updates } = await collectAppStoreChart({ ...baseSource, watchVersions: false, previousChart }, transport);
  const entered = updates.find((update) => update.metadata.appId === "111");
  const dropped = updates.find((update) => update.metadata.appId === "999");
  assert.equal(entered.metadata.movement, "new");
  assert.match(entered.title, /新进榜/);
  assert.equal(dropped.metadata.movement, "dropped");
  assert.match(dropped.title, /跌出榜单/);
});

test("charted apps report version updates unless watching is disabled", async () => {
  const apps = [{ appId: 111, title: "Alpha" }, { appId: 222, title: "Beta" }];
  const transport = chartTransport(apps, { 111: "2.0.0", 222: "3.1.0" });
  const enabled = await collectAppStoreChart(baseSource, transport);
  const versions = enabled.updates.filter((update) => update.externalId.startsWith("version:"));
  assert.deepEqual(versions.map((update) => update.externalId).sort(), ["version:111:2.0.0", "version:222:3.1.0"]);

  const unchanged = await collectAppStoreChart({ ...baseSource, previousVersions: enabled.snapshot.previousVersions }, transport);
  assert.equal(unchanged.updates.filter((update) => update.externalId.startsWith("version:")).length, 0);

  const disabled = await collectAppStoreChart({ ...baseSource, watchVersions: false }, transport);
  assert.equal(disabled.updates.length, 0);
  assert.equal(disabled.snapshot.previousVersions.length, 0);
});

test("the version lookup is chunked instead of issuing one request per app", async () => {
  const apps = Array.from({ length: 30 }, (_, index) => ({ appId: 100 + index, title: `App ${index}` }));
  const versions = Object.fromEntries(apps.map((app) => [app.appId, "1.0.0"]));
  const transport = chartTransport(apps, versions);
  await collectAppStoreChart(baseSource, transport);
  const lookups = transport.calls.filter((url) => url.includes("/lookup?"));
  assert.equal(lookups.length, 2);
  assert.equal(lookups[0].split("id=")[1].split("&")[0].split(",").length, 25);
});

test("the ranking survives a poll round trip through the event store", async () => {
  const directory = await mkdtemp(join(tmpdir(), "update-radar-charts-"));
  const store = new JsonEventStore(join(directory, "events.json"));
  const source = normalizeSource({ kind: "app-store-charts", name: "免费榜", country: "cn", chart: "top-free", watchVersions: false }, { id: "cn-free" });
  const transport = chartTransport([{ appId: 111, title: "Alpha" }]);
  const collectorResolver = () => (candidate) => collectAppStoreChart(candidate, transport);
  const results = [await (async () => {
    const { pollSource } = await import("../src/radar.js");
    return pollSource(source, { store, collectorResolver });
  })()];
  await store.recordPollResults(results.map((result) => ({ ok: true, ...result })), [source]);

  const states = await store.sourcePollStates();
  assert.equal(states[source.id].chartSnapshot.previousChart.length, 1);
  assert.equal(states[source.id].failureCount, 0);

  // The stored snapshot is what turns the next identical poll into a silent no-op.
  const second = await (async () => {
    const { pollSource } = await import("../src/radar.js");
    return pollSource(source, { store, collectorResolver, sourcePollState: states });
  })();
  assert.equal(second.inserted, 0);
});

test("pollAll keeps chart sources on the individual path and still stores snapshots", async () => {
  const directory = await mkdtemp(join(tmpdir(), "update-radar-charts-poll-"));
  const store = new JsonEventStore(join(directory, "events.json"));
  const source = normalizeSource({ kind: "app-store-charts", name: "免费榜", country: "cn", chart: "top-free", watchVersions: false }, { id: "cn-free" });
  const transport = chartTransport([{ appId: 111, title: "Alpha" }, { appId: 222, title: "Beta" }]);
  const results = await pollAll([source], { store, collectorResolver: () => (candidate) => collectAppStoreChart(candidate, transport) });
  assert.equal(results[0].ok, true);
  assert.equal(results[0].fetched, 0);
  assert.deepEqual(results[0].chartSnapshot.previousChart.map((entry) => entry.appId), ["111", "222"]);
  await store.recordPollResults(results, [source]);
  assert.equal((await store.sourcePollStates())[source.id].chartSnapshot.previousChart.length, 2);
});

test("chart source settings are validated and defaulted", () => {
  const source = normalizeSource({ kind: "app-store-charts", name: "免费榜" }, { id: "cn-free" });
  assert.equal(source.country, "cn");
  assert.equal(source.chart, "top-free");
  assert.equal(source.platform, "iphone");
  assert.equal(source.watchVersions, true);
  assert.throws(() => normalizeSource({ kind: "app-store-charts", name: "x", chart: "nope" }, { id: "a" }), /不支持的榜单类型/);
  assert.throws(() => normalizeSource({ kind: "app-store-charts", name: "x", platform: "watch" }, { id: "a" }), /仅支持 iPhone 或 iPad/);
  assert.throws(() => normalizeSource({ kind: "app-store-charts", name: "x", categoryId: "abc" }, { id: "a" }), /分类 ID/);
});
