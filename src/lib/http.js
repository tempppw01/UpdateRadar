// Upstreams answer a burst of near-identical requests with 429/431 instead of data.
// Retrying those statuses with jittered backoff keeps a short burst from turning
// into a permanently failing source, and the jitter stops every worker from
// retrying in lockstep and re-creating the same burst.
const retryableStatuses = new Set([408, 425, 429, 431, 500, 502, 503, 504]);
const maxBackoffMs = 8_000;

const sleep = (milliseconds) => new Promise((resolve) => { setTimeout(resolve, milliseconds); });

function retryDelayMs(attempt, response) {
  const retryAfter = Number(response?.headers?.get?.("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return Math.min(retryAfter * 1_000, maxBackoffMs);
  const ceiling = Math.min(500 * 2 ** attempt, maxBackoffMs);
  return Math.round(ceiling * (0.5 + Math.random() * 0.5));
}

export async function fetchText(url, options = {}) {
  const attempts = Math.min(Math.max(Number(options.retries ?? 2) || 0, 0), 5) + 1;
  const delayFor = typeof options.retryDelayMs === "function" ? options.retryDelayMs : (attempt, response) => retryDelayMs(attempt, response);
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let response;
    try {
      response = await fetch(url, {
        headers: {
          Accept: "application/json, application/rss+xml, application/atom+xml, text/html;q=0.9",
          "User-Agent": "UpdateRadar/0.1 (+https://github.com/tempppw01/UpdateRadar)",
          ...options.headers
        },
        // A signal is single-use, so every attempt needs a fresh timeout.
        signal: AbortSignal.timeout(options.timeoutMs ?? 15_000)
      });
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) break;
      await sleep(delayFor(attempt));
      continue;
    }

    if (response.ok) return response.text();
    const status = response.status;
    if (!retryableStatuses.has(status) || attempt === attempts - 1) {
      throw new Error(`Request to ${url} failed with ${status}`);
    }
    try {
      await response.body?.cancel();
    } catch {
      // Draining the rejected body is best effort; the request is retried anyway.
    }
    await sleep(delayFor(attempt, response));
    lastError = new Error(`Request to ${url} failed with ${status}`);
  }

  throw lastError instanceof Error ? lastError : new Error(`Request to ${url} failed`);
}
