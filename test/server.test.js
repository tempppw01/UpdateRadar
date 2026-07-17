import assert from "node:assert/strict";
import test from "node:test";
import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializeSources } from "../src/server.js";

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
