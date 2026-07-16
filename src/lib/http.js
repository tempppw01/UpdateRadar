export async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json, application/rss+xml, application/atom+xml, text/html;q=0.9",
      "User-Agent": "UpdateRadar/0.1 (+https://github.com/tempppw01/UpdateRadar)",
      ...options.headers
    },
    signal: AbortSignal.timeout(options.timeoutMs ?? 15_000)
  });

  if (!response.ok) {
    throw new Error(`Request to ${url} failed with ${response.status}`);
  }

  return response.text();
}
