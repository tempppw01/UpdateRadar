import assert from "node:assert/strict";
import test from "node:test";
import { fetchText } from "../src/lib/http.js";

function withStubbedFetch(handler, run) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return Promise.resolve(run()).finally(() => { globalThis.fetch = original; });
}

const ok = (body) => ({ ok: true, status: 200, headers: new Map(), text: async () => body });
const status = (code) => ({ ok: false, status: code, headers: new Map(), body: { cancel: async () => {} }, text: async () => "" });

test("fetch retries 431 responses and returns the eventual body", async () => {
  let calls = 0;
  await withStubbedFetch(async () => {
    calls += 1;
    return calls < 3 ? status(431) : ok("payload");
  }, async () => {
    assert.equal(await fetchText("https://itunes.apple.com/lookup", { retries: 3, retryDelayMs: () => 0 }), "payload");
  });
  assert.equal(calls, 3);
});

test("fetch gives up on 431 after the retry budget and reports the status", async () => {
  let calls = 0;
  await withStubbedFetch(async () => {
    calls += 1;
    return status(431);
  }, async () => {
    await assert.rejects(
      () => fetchText("https://itunes.apple.com/lookup", { retries: 2, retryDelayMs: () => 0 }),
      /failed with 431/
    );
  });
  assert.equal(calls, 3);
});

test("fetch does not retry a client error that retrying cannot fix", async () => {
  let calls = 0;
  await withStubbedFetch(async () => {
    calls += 1;
    return status(404);
  }, async () => {
    await assert.rejects(() => fetchText("https://itunes.apple.com/lookup", { retries: 3, retryDelayMs: () => 0 }), /failed with 404/);
  });
  assert.equal(calls, 1);
});

test("fetch retries network failures", async () => {
  let calls = 0;
  await withStubbedFetch(async () => {
    calls += 1;
    if (calls < 2) throw new Error("fetch failed");
    return ok("payload");
  }, async () => {
    assert.equal(await fetchText("https://itunes.apple.com/lookup", { retries: 2, retryDelayMs: () => 0 }), "payload");
  });
  assert.equal(calls, 2);
});
