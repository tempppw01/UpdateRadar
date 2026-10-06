import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pollAll } from "../src/radar.js";
import { JsonEventStore } from "../src/store.js";

test("a large App Store catalog costs a fraction of its per-source request budget", async () => {
  const appStoreCount = 83;
  const sources = [
    ...Array.from({ length: appStoreCount }, (_, index) => ({
      id: `app-${index}`, name: `App ${index}`, kind: "app-store",
      appId: String(1000 + index), country: index % 3 === 0 ? "cn" : "us", enabled: true, tags: []
    })),
    { id: "gh", name: "Repo", kind: "github-releases", owner: "acme", repo: "tool", enabled: true, tags: [] }
  ];
  const directory = await mkdtemp(join(tmpdir(), "update-radar-budget-"));
  const store = new JsonEventStore(join(directory, "events.json"));
  let requests = 0;
  const fetchText = async (url) => {
    requests += 1;
    const text = String(url);
    if (!text.includes("itunes.apple.com/lookup")) return "[]";
    const ids = new URL(text).searchParams.get("id")?.split(",") ?? [];
    return JSON.stringify({ results: ids.map((id) => ({
      trackId: Number(id), trackName: "App", version: "1.0.0",
      trackViewUrl: `https://apps.apple.com/us/app/id${id}`,
      currentVersionReleaseDate: "2026-01-01T00:00:00Z", price: 0, formattedPrice: "Free"
    })) });
  };
  const results = await pollAll(sources, { store, fetchText, collectorResolver: () => fetchText });
  assert.ok(results.every((result) => result.ok), "every source should still succeed");
  // One request per app would mean 83 calls; batching must stay far below that.
  const ceiling = Math.ceil(appStoreCount / 25) + 3;
  assert.ok(requests <= ceiling, `expected at most ${ceiling} requests, got ${requests}`);
  assert.equal((await store.list({ kind: "app-store", limit: 200 })).length, appStoreCount);
});
