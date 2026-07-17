import { fetchText } from "../lib/http.js";

export async function collectGithubCommits(source, dependencies = { fetchText }) {
  const url = new URL(`https://api.github.com/repos/${source.owner}/${source.repo}/commits`);
  url.searchParams.set("per_page", "30");
  if (source.branch) url.searchParams.set("sha", source.branch);
  const payload = JSON.parse(await dependencies.fetchText(url, {
    headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }
  }));

  return payload.map((commit) => {
    const [title, ...body] = String(commit.commit?.message ?? "").split(/\r?\n/);
    return {
      externalId: commit.sha,
      title: title || commit.sha.slice(0, 7),
      url: commit.html_url,
      publishedAt: commit.commit?.author?.date || commit.commit?.committer?.date || new Date().toISOString(),
      summary: body.join("\n").trim(),
      metadata: { commit: commit.sha.slice(0, 7), branch: source.branch || "default", author: commit.commit?.author?.name || commit.author?.login || "" }
    };
  });
}
