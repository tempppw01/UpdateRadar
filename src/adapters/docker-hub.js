import { fetchText } from "../lib/http.js";

export async function collectDockerHub(source, dependencies = { fetchText }) {
  const url = `https://hub.docker.com/v2/repositories/${encodeURI(source.repository)}/tags?page_size=30&ordering=last_updated`;
  const payload = JSON.parse(await dependencies.fetchText(url));
  const selectedTags = new Set(source.tagsFilter ?? []);

  return (payload.results ?? [])
    .filter((tag) => !selectedTags.size || selectedTags.has(tag.name))
    .map((tag) => {
      const digests = [...new Set((tag.images ?? []).map((image) => image.digest).filter(Boolean))];
      const digest = digests[0] ?? tag.digest ?? "unknown";
      const architectures = [...new Set((tag.images ?? []).filter((image) => image.os && image.architecture && image.os !== "unknown").map((image) => `${image.os}/${image.architecture}`))];
      return {
        externalId: `${source.repository}:${tag.name}:${digest}`,
        version: tag.name,
        title: `${source.name}: ${tag.name}`,
        url: `https://hub.docker.com/r/${source.repository}/tags?name=${encodeURIComponent(tag.name)}`,
        publishedAt: tag.last_updated || new Date().toISOString(),
        summary: tag.full_size ? `镜像标签已更新，大小 ${(tag.full_size / 1024 / 1024).toFixed(1)} MB。` : "镜像标签已更新。",
        metadata: { repository: source.repository, digest, architectures }
      };
    });
}
