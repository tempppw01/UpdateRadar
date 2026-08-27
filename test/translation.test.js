import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonSettingsStore } from "../src/settings.js";
import { listModels, translateText } from "../src/translation.js";

test("translation uses the OpenAI-compatible chat completions shape", async () => {
  let request;
  const result = await translateText("Bug fixes", { provider: "openai", baseUrl: "https://api.example.test/v1", apiKey: "secret", model: "test-model", targetLanguage: "简体中文" }, async (url, options) => {
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
  const result = await translateText(notes, { provider: "openai", baseUrl: "https://api.example.test/v1", model: "test-model", targetLanguage: "简体中文" }, async (_url, options) => {
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
  assert.deepEqual(await store.publicTranslation(), { provider: "openai", baseUrl: "https://api.example.test/v1", model: "new-model", targetLanguage: "简体中文", apiKeyConfigured: true, googleApiKeyConfigured: false, microsoftApiKeyConfigured: false, microsoftRegion: "" });
});

test("Google translation uses the Cloud Translation v2 API", async () => {
  let request;
  const result = await translateText("Bug fixes", { provider: "google", googleApiKey: "google-secret", targetLanguage: "日本語" }, async (url, options) => {
    request = { url: new URL(url), options };
    return new Response(JSON.stringify({ data: { translations: [{ translatedText: "バグ修正" }] } }), { status: 200 });
  });
  assert.equal(result, "バグ修正");
  assert.equal(request.url.hostname, "translation.googleapis.com");
  assert.equal(request.url.searchParams.get("key"), "google-secret");
  assert.deepEqual(JSON.parse(request.options.body), { q: "Bug fixes", target: "ja", format: "text" });
});

test("Microsoft translation uses the Translator v3 API", async () => {
  let request;
  const result = await translateText("Bug fixes", { provider: "microsoft", microsoftApiKey: "ms-secret", microsoftRegion: "global", targetLanguage: "English" }, async (url, options) => {
    request = { url: new URL(url), options };
    return new Response(JSON.stringify([{ translations: [{ text: "Bug fixes" }] }]), { status: 200 });
  });
  assert.equal(result, "Bug fixes");
  assert.equal(request.url.hostname, "api.cognitive.microsofttranslator.com");
  assert.equal(request.url.searchParams.get("to"), "en");
  assert.equal(request.options.headers["Ocp-Apim-Subscription-Key"], "ms-secret");
  assert.equal(request.options.headers["Ocp-Apim-Subscription-Region"], "global");
  assert.deepEqual(JSON.parse(request.options.body), [{ Text: "Bug fixes" }]);
});

test("translation settings preserve Google and Microsoft keys when fields are left empty", async () => {
  const directory = await mkdtemp(join(tmpdir(), "update-radar-settings-"));
  const store = new JsonSettingsStore(join(directory, "settings.json"));
  await store.updateTranslation({ provider: "google", googleApiKey: "google-secret" });
  await store.updateTranslation({ provider: "microsoft", microsoftApiKey: "ms-secret", microsoftRegion: "westeurope", googleApiKey: "" });
  const config = await store.translation();
  assert.equal(config.provider, "microsoft");
  assert.equal(config.googleApiKey, "google-secret");
  assert.equal(config.microsoftApiKey, "ms-secret");
  assert.equal(config.microsoftRegion, "westeurope");
  const publicConfig = await store.publicTranslation();
  assert.equal(publicConfig.googleApiKeyConfigured, true);
  assert.equal(publicConfig.microsoftApiKeyConfigured, true);
  assert.equal(publicConfig.microsoftRegion, "westeurope");
});

test("event display settings default to 200 per category and persist changes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "update-radar-settings-"));
  const store = new JsonSettingsStore(join(directory, "settings.json"));
  assert.deepEqual(await store.events(), { limitPerCategory: 200 });
  await store.updateEvents({ limitPerCategory: 350 });
  assert.deepEqual(await store.events(), { limitPerCategory: 350 });
  await assert.rejects(() => store.updateEvents({ limitPerCategory: 0 }), /1 到 10000/);
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

test("model listing returns no remote model list for built-in translation providers", async () => {
  assert.deepEqual(await listModels({ provider: "google", googleApiKey: "secret" }), []);
  assert.deepEqual(await listModels({ provider: "microsoft", microsoftApiKey: "secret" }), []);
});
