import { fetchText } from "../lib/http.js";

function jsonLd(html) {
  const scripts = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) ?? [];
  for (const script of scripts) {
    const content = script.replace(/^[^>]*>/, "").replace(/<\/script>$/i, "");
    try {
      const value = JSON.parse(content);
      const entries = Array.isArray(value) ? value : [value];
      const app = entries.find((entry) => entry["@type"] === "SoftwareApplication");
      if (app) return app;
    } catch {
      // Ignore unrelated structured data blocks on a store page.
    }
  }
  return null;
}

export async function collectGooglePlay(source, dependencies = { fetchText }) {
  const language = source.language ?? "en";
  const country = source.country ?? "US";
  const url = `https://play.google.com/store/apps/details?id=${encodeURIComponent(source.packageId)}&hl=${encodeURIComponent(language)}&gl=${encodeURIComponent(country)}`;
  const app = jsonLd(await dependencies.fetchText(url));
  if (!app?.softwareVersion) return [];

  return [{
    externalId: `${source.packageId}:${app.softwareVersion}`,
    version: app.softwareVersion,
    title: `${app.name ?? source.name} ${app.softwareVersion}`,
    url,
    publishedAt: app.dateModified || app.datePublished || new Date().toISOString(),
    summary: app.description || "",
    metadata: { packageId: source.packageId, store: country }
  }];
}
