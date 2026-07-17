import { collectAppStore } from "./app-store.js";
import { collectDockerHub } from "./docker-hub.js";
import { collectGithubReleases } from "./github-releases.js";
import { collectGooglePlay } from "./google-play.js";
import { collectNintendoSwitch } from "./nintendo-switch.js";
import { collectQnapApp } from "./qnap-app.js";
import { collectRss } from "./rss.js";

const collectors = {
  "github-releases": collectGithubReleases,
  "docker-hub": collectDockerHub,
  "app-store": collectAppStore,
  "google-play": collectGooglePlay,
  "qnap-app": collectQnapApp,
  "nintendo-switch": collectNintendoSwitch,
  rss: collectRss
};

export function collectorFor(kind) {
  const collector = collectors[kind];
  if (!collector) throw new Error(`Unsupported source kind: ${kind}`);
  return collector;
}
