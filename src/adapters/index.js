import { collectAppStore } from "./app-store.js";
import { collectGithubReleases } from "./github-releases.js";
import { collectGooglePlay } from "./google-play.js";
import { collectRss } from "./rss.js";

const collectors = {
  "github-releases": collectGithubReleases,
  "app-store": collectAppStore,
  "google-play": collectGooglePlay,
  rss: collectRss
};

export function collectorFor(kind) {
  const collector = collectors[kind];
  if (!collector) throw new Error(`Unsupported source kind: ${kind}`);
  return collector;
}
