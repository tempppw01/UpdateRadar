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

function interleaveByKind(sources) {
  const queues = new Map();
  sources.forEach((source) => {
    if (!queues.has(source.kind)) queues.set(source.kind, []);
    queues.get(source.kind).push(source);
  });
  const result = [];
  while (queues.size) {
    for (const [kind, queue] of queues) {
      result.push(queue.shift());
      if (!queue.length) queues.delete(kind);
    }
  }
  return result;
}

export function sourcesDueForPolling(sources, sourcePollStates, now = Date.now()) {
  const due = [];
  const skipped = [];
  sources.filter((source) => source.enabled).forEach((source) => {
    const nextCheckAt = sourcePollStates[source.id]?.nextCheckAt;
    if (nextCheckAt && new Date(nextCheckAt).getTime() > now) skipped.push({ ok: true, sourceId: source.id, skipped: true, nextPollAt: nextCheckAt });
    else due.push(source);
  });
  due.sort((left, right) => Number(right.priority ?? 0) - Number(left.priority ?? 0));
  return { due: interleaveByKind(due), skipped };
}
