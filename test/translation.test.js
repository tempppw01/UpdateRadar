import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonSettingsStore } from "../src/settings.js";
import { listModels, translateText } from "../src/translation.js";

test("translation uses the OpenAI-compatible chat completions shape", async () => {
  let request;
  const result = await translateText("Bug fixes", { baseUrl: "https://api.example.test/v1", apiKey: "secret", model: "test-model", targetLanguage: "简体中文" }, async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ choices: [{ message: { content: "错误修复" } }] }), { status: 200 });
  });
  assert.equal(result, "错误修复");
  assert.equal(request.url, "https://api.example.test/v1/chat/completions");
  assert.equal(request.options.headers.Authorization, "Bearer secret");
  assert.equal(JSON.parse(request.options.body).model, "test-model");
});

test("translation splits long release notes into smaller requests", async () => {
  const requests = [];
  const notes = `${"A".repeat(2_300)}\n\n${"B".repeat(2_300)}\n\n${"C".repeat(2_300)}`;
  const result = await translateText(notes, { baseUrl: "https://api.example.test/v1", model: "test-model", targetLanguage: "简体中文" }, async (_url, options) => {
    requests.push(JSON.parse(options.body).messages.at(-1).content);
    return new Response(JSON.stringify({ choices: [{ message: { content: `译文 ${requests.length}` } }] }), { status: 200 });
  });
  assert.equal(requests.length, 3);
  assert.ok(requests.every((chunk) => chunk.length <= 4_000));
  assert.equal(result, "译文 1\n\n译文 2\n\n译文 3");
});

test("translation settings do not expose or erase a saved API key", async () => {
  const directory = await mkdtemp(join(tmpdir(), "update-radar-settings-"));
  const store = new JsonSettingsStore(join(directory, "settings.json"));
  await store.updateTranslation({ baseUrl: "https://api.example.test/v1", apiKey: "secret", model: "test-model" });
  await store.updateTranslation({ model: "new-model", apiKey: "" });
  assert.equal((await store.translation()).apiKey, "secret");
  assert.deepEqual(await store.publicTranslation(), { baseUrl: "https://api.example.test/v1", model: "new-model", targetLanguage: "简体中文", apiKeyConfigured: true });
});

test("model listing uses the OpenAI-compatible models endpoint", async () => {
  let request;
  const models = await listModels({ baseUrl: "https://api.example.test/v1", apiKey: "secret" }, async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ data: [{ id: "z-model" }, { id: "a-model" }] }), { status: 200 });
  });
  assert.deepEqual(models, ["a-model", "z-model"]);
  assert.equal(request.url, "https://api.example.test/v1/models");
  assert.equal(request.options.headers.Authorization, "Bearer secret");
});
