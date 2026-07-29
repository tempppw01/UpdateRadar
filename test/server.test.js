import assert from "node:assert/strict";
import test from "node:test";
import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp, initializeSources } from "../src/server.js";

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
