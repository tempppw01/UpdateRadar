import assert from "node:assert/strict";
import test from "node:test";
import { parseFeed } from "../src/lib/xml.js";

test("feed parser reads Atom links and escaped content", () => {
  const entries = parseFeed(`
    <feed><entry>
      <id>tag:example.test,2026:1</id><title>Product &amp; API</title>
      <link href="https://example.test/updates/1" />
      <updated>2026-01-01T00:00:00Z</updated><summary>Details</summary>
    </entry></feed>
  `);
  assert.deepEqual(entries, [{
    id: "tag:example.test,2026:1",
    title: "Product & API",
    url: "https://example.test/updates/1",
    publishedAt: "2026-01-01T00:00:00Z",
    summary: "Details"
  }]);
});
