import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonSourceStore, SourceValidationError } from "../src/sources.js";

async function makeStore() {
  const directory = await mkdtemp(join(tmpdir(), "update-radar-sources-"));
  const path = join(directory, "sources.json");
  await writeFile(path, "[]\n");
  return new JsonSourceStore(path);
}

test("source store creates, updates, and removes a typed source", async () => {
  const store = await makeStore();
  const created = await store.create({
    id: "nodejs", name: "Node.js", kind: "github-releases", enabled: true,
    owner: "nodejs", repo: "node", includePrereleases: false, tags: ["runtime", "runtime"]
  });
  assert.deepEqual(created.tags, ["runtime"]);
  const updated = await store.update("nodejs", { enabled: false, tags: ["runtime", "opensource"] });
  assert.equal(updated.enabled, false);
  assert.deepEqual(updated.tags, ["runtime", "opensource"]);
  assert.equal(await store.remove("nodejs"), true);
  assert.deepEqual(await store.list(), []);
});

test("source store rejects unsupported and incomplete configurations", async () => {
  const store = await makeStore();
  await assert.rejects(
    store.create({ id: "bad", name: "Bad", kind: "rss", tags: [], feedUrl: "not-a-url" }),
    SourceValidationError
  );
  await assert.rejects(
    store.create({ id: "Bad Id", name: "Bad", kind: "github-releases", owner: "a", repo: "b" }),
    /唯一 ID/
  );
});

test("source store validates App Store subscription price monitors", async () => {
  const store = await makeStore();
  const source = await store.create({
    id: "chatgpt-plus-price", name: "ChatGPT Plus 全球订阅价格", kind: "app-store-price",
    appId: "6448311069", subscriptionId: "oai_chatgpt_plus_1999_1m", locale: "zh", tags: ["pricing"]
  });
  assert.equal(source.subscriptionId, "oai_chatgpt_plus_1999_1m");
  assert.equal(source.locale, "zh");
});
