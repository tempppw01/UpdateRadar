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

test("source store supports an Apple App Store source with an in-app purchase monitor", async () => {
  const store = await makeStore();
  const source = await store.create({
    id: "chatgpt", name: "ChatGPT", kind: "app-store",
    appId: "6448311069", subscriptionId: "oai_chatgpt_plus_1999_1m", country: "us", tags: ["pricing"]
  });
  assert.equal(source.subscriptionId, "oai_chatgpt_plus_1999_1m");
  assert.equal(source.country, "us");
});

test("source store supports Docker Hub, QNAP, and Nintendo Switch sources", async () => {
  const store = await makeStore();
  const docker = await store.create({ id: "nginx-image", name: "NGINX", kind: "docker-hub", repository: "library/nginx", tagsFilter: ["latest"] });
  const qnap = await store.create({ id: "container-station", name: "Container Station", kind: "qnap-app", qnapAppName: "ContainerStation", qnapOs: "qts" });
  const nintendo = await store.create({ id: "mario-kart-world", name: "Mario Kart World", kind: "nintendo-switch", gameName: "Mario Kart World" });
  assert.deepEqual(docker.tagsFilter, ["latest"]);
  assert.equal(qnap.qnapOs, "qts");
  assert.equal(nintendo.nintendoRegion, "us");
});

test("source store removes multiple selected sources", async () => {
  const store = await makeStore();
  await store.create({ id: "one", name: "One", kind: "rss", feedUrl: "https://example.test/one.xml" });
  await store.create({ id: "two", name: "Two", kind: "rss", feedUrl: "https://example.test/two.xml" });
  assert.equal(await store.removeMany(["one", "missing"]), 1);
  assert.deepEqual((await store.list()).map((source) => source.id), ["two"]);
});

test("source store replaces all sources from a validated backup", async () => {
  const store = await makeStore();
  await store.create({ id: "old", name: "Old", kind: "rss", feedUrl: "https://example.test/old.xml" });
  const sources = await store.replaceAll([{ id: "new", name: "New", kind: "rss", feedUrl: "https://example.test/new.xml" }]);
  assert.deepEqual(sources.map((source) => source.id), ["new"]);
  assert.deepEqual((await store.list()).map((source) => source.id), ["new"]);
});
