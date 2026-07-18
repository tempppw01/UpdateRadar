import { collectorFor } from "./adapters/index.js";

export async function pollSource(source, { store, collectorResolver = collectorFor } = {}) {
  const updates = await collectorResolver(source.kind)(source);
  let inserted = 0;
  for (const update of updates) {
    if (await store.insert(source, update)) inserted += 1;
  }
  return { sourceId: source.id, fetched: updates.length, inserted };
}

export async function pollAll(sources, dependencies) {
  const enabledSources = sources.filter((source) => source.enabled);
  const configuredConcurrency = Number(dependencies?.concurrency ?? process.env.POLL_CONCURRENCY ?? 4);
  const concurrency = Math.min(Math.max(Number.isFinite(configuredConcurrency) ? Math.floor(configuredConcurrency) : 4, 1), 12);
  const results = new Array(enabledSources.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < enabledSources.length) {
      const index = nextIndex++;
      const source = enabledSources[index];
      try {
        results[index] = { ok: true, ...await pollSource(source, dependencies) };
      } catch (error) {
        results[index] = { ok: false, sourceId: source.id, error: error instanceof Error ? error.message : String(error) };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, enabledSources.length) }, worker));
  return results;
}

export function sourcesDueForPolling(sources, latestDetectedAtBySource, now = Date.now()) {
  const due = [];
  const skipped = [];
  sources.filter((source) => source.enabled).forEach((source) => {
    const cooldownMinutes = Number(source.cooldownMinutes ?? 60);
    const detectedAt = latestDetectedAtBySource[source.id];
    const age = detectedAt ? now - new Date(detectedAt).getTime() : Infinity;
    if (cooldownMinutes > 0 && Number.isFinite(age) && age >= 0 && age < cooldownMinutes * 60_000) {
      skipped.push({ ok: true, sourceId: source.id, skipped: true, cooldownMinutes, nextPollAt: new Date(new Date(detectedAt).getTime() + cooldownMinutes * 60_000).toISOString() });
    } else due.push(source);
  });
  return { due, skipped };
}
