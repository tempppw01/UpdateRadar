import { fetchText } from "../lib/http.js";

export async function collectGithubReleases(source, dependencies = { fetchText }) {
  const url = `https://api.github.com/repos/${source.owner}/${source.repo}/releases?per_page=30`;
  const payload = JSON.parse(await dependencies.fetchText(url, {
    headers: { "X-GitHub-Api-Version": "2022-11-28" }
  }));

  return payload
    .filter((release) => !release.draft && (source.includePrereleases || !release.prerelease))
    .map((release) => ({
      externalId: String(release.id),
      version: release.tag_name,
      title: release.name || release.tag_name,
      url: release.html_url,
      publishedAt: release.published_at || release.created_at,
      summary: release.body || "",
      metadata: {
        prerelease: release.prerelease,
        assets: (release.assets ?? []).map((asset) => ({ name: asset.name, size: asset.size, url: asset.browser_download_url, contentType: asset.content_type }))
      }
    }));
}
