import assert from "node:assert/strict";
import test from "node:test";
import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp, initializeSources } from "../src/server.js";
import { JsonSettingsStore } from "../src/settings.js";

test("empty persistent data directory is initialized from the source seed", async () => {
  const directory = await mkdtemp(join(tmpdir(), "update-radar-server-"));
  const seed = join(directory, "seed.json");
  const target = join(directory, "data", "sources.json");
  await writeFile(seed, '[{"id":"seed"}]\n');
  await initializeSources(target, seed);
  assert.equal(await readFile(target, "utf8"), '[{"id":"seed"}]\n');
  await writeFile(target, '[{"id":"saved"}]\n');
  await initializeSources(target, seed);
  assert.equal(await readFile(target, "utf8"), '[{"id":"saved"}]\n');
  await access(target);
});

test("backup import accepts source collections larger than the regular request limit", async () => {
  const app = createApp({
    getSources: async () => [],
    sourceRepository: { replaceAll: async (sources) => sources },
    settingsRepository: {
      publicTranslation: async () => ({}), events: async () => ({}),
      updateTranslation: async () => {}, updateEvents: async () => {}
    },
    store: { removeOutsideSourceIds: async () => {} }
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const { port } = app.address();
  const sources = Array.from({ length: 1_000 }, (_, index) => ({
    id: `backup-${index}`, name: `Backup ${index}`, kind: "rss",
    feedUrl: `https://example.test/${index}/${"x".repeat(120)}`
  }));

  try {
    const response = await fetch(`http://127.0.0.1:${port}/v1/backup`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: 1, sources })
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).sources, sources.length);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => error ? reject(error) : resolve()));
  }
});

test("invalid settings input answers with a validation error instead of 500", async () => {
  const directory = await mkdtemp(join(tmpdir(), "update-radar-settings-api-"));
  const app = createApp({
    getSources: async () => [],
    sourceRepository: { replaceAll: async (sources) => sources },
    settingsRepository: new JsonSettingsStore(join(directory, "settings.json")),
    store: { removeOutsideSourceIds: async () => {} }
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const { port } = app.address();
  const put = (pathname, body) => fetch(`http://127.0.0.1:${port}${pathname}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  try {
    const events = await put("/v1/settings/events", { limitPerCategory: 0 });
    assert.equal(events.status, 400);
    assert.equal((await events.json()).error, "Validation error");
    const translation = await put("/v1/settings/translation", { baseUrl: "not a url" });
    assert.equal(translation.status, 400);
    const saved = await put("/v1/settings/events", { limitPerCategory: 120 });
    assert.equal(saved.status, 200);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => error ? reject(error) : resolve()));
  }
});

test("an overlapping poll for a different source is not swallowed", async () => {
  const sources = [
    { id: "a", name: "A", kind: "unsupported-kind", enabled: true, tags: [] },
    { id: "b", name: "B", kind: "unsupported-kind", enabled: true, tags: [] }
  ];
  const recorded = [];
  const app = createApp({
    getSources: async () => sources,
    sourceRepository: { list: async () => sources },
    settingsRepository: { events: async () => ({ limitPerCategory: 200 }) },
    store: {
      sourcePollStates: async () => ({}),
      recordPollResults: async (results) => { recorded.push(results.map((result) => result.sourceId).sort().join("+")); },
      prune: async () => 0,
      markSyncedAt: async () => null
    }
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const { port } = app.address();
  const poll = (id) => fetch(`http://127.0.0.1:${port}/v1/poll?force=true&sourceId=${id}`, { method: "POST" }).then((response) => response.json());
  try {
    const [first, second] = await Promise.all([poll("a"), poll("b")]);
    assert.deepEqual(first.map((result) => result.sourceId), ["a"]);
    assert.deepEqual(second.map((result) => result.sourceId), ["b"]);
    assert.deepEqual(recorded, ["a", "b"]);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => error ? reject(error) : resolve()));
  }
});
