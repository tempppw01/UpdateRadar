import { collectAppStore } from "./app-store.js";
import { collectDockerHub } from "./docker-hub.js";
import { collectGithubReleases } from "./github-releases.js";
import { collectGithubCommits } from "./github-commits.js";
import { collectGooglePlay } from "./google-play.js";
import { collectPlayStation, collectXbox } from "./game-news.js";
import { collectNintendoSwitch } from "./nintendo-switch.js";
import { collectQnapApp } from "./qnap-app.js";
import { collectOfficialWebsite } from "./official-website.js";
import { collectRss } from "./rss.js";
import { collectSteam } from "./steam.js";

const collectors = {
  "github-releases": collectGithubReleases,
  "github-commits": collectGithubCommits,
  "docker-hub": collectDockerHub,
  "app-store": collectAppStore,
  "google-play": collectGooglePlay,
  "qnap-app": collectQnapApp,
  "official-website": collectOfficialWebsite,
  "nintendo-switch": collectNintendoSwitch,
  steam: collectSteam,
  playstation: collectPlayStation,
  xbox: collectXbox,
  rss: collectRss
};

export function collectorFor(kind) {
  const collector = collectors[kind];
  if (!collector) throw new Error(`Unsupported source kind: ${kind}`);
  return collector;
}
