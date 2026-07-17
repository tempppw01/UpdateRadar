import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonSettingsStore } from "../src/settings.js";
import { translateText } from "../src/translation.js";

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

test("translation settings do not expose or erase a saved API key", async () => {
  const directory = await mkdtemp(join(tmpdir(), "update-radar-settings-"));
  const store = new JsonSettingsStore(join(directory, "settings.json"));
  await store.updateTranslation({ baseUrl: "https://api.example.test/v1", apiKey: "secret", model: "test-model" });
  await store.updateTranslation({ model: "new-model", apiKey: "" });
  assert.equal((await store.translation()).apiKey, "secret");
  assert.deepEqual(await store.publicTranslation(), { baseUrl: "https://api.example.test/v1", model: "new-model", targetLanguage: "简体中文", apiKeyConfigured: true });
});
