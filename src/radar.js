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
  const results = await Promise.allSettled(enabledSources.map((source) => pollSource(source, dependencies)));
  return results.map((result, index) => result.status === "fulfilled"
    ? { ok: true, ...result.value }
    : { ok: false, sourceId: enabledSources[index].id, error: result.reason.message });
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
