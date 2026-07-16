import assert from "node:assert/strict";
import test from "node:test";
import { searchAppStore } from "../src/catalog.js";

test("App Store search normalizes official catalog results", async () => {
  let requestedUrl;
  const results = await searchAppStore({ term: "Things", country: "us", limit: 5 }, {
    fetchText: async (url) => {
      requestedUrl = new URL(url);
      return JSON.stringify({ results: [{
        trackId: 904280696, trackName: "Things 3", version: "3.21", artistName: "Cultured Code",
        primaryGenreName: "Productivity", artworkUrl100: "https://example.test/icon.png", trackViewUrl: "https://example.test/app"
      }] });
    }
  });
  assert.equal(requestedUrl.searchParams.get("term"), "Things");
  assert.equal(requestedUrl.searchParams.get("media"), "software");
  assert.deepEqual(results, [{
    appId: "904280696", name: "Things 3", version: "3.21", developer: "Cultured Code", genre: "Productivity",
    artworkUrl: "https://example.test/icon.png", url: "https://example.test/app", country: "us"
  }]);
});
