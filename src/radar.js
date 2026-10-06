import { batchCollectorFor, collectorFor } from "./adapters/index.js";
import { fetchText } from "./lib/http.js";

// Most collectors return a plain update list. Chart collectors also return the
// snapshot their next run diffs against, which the caller persists.
function normalizeCollected(collected) {
  if (Array.isArray(collected)) return { updates: collected, chartSnapshot: null };
  if (collected && typeof collected === "object") return { updates: collected.updates ?? [], chartSnapshot: collected.snapshot ?? null };
  return { updates: [], chartSnapshot: null };
}

// Chart collectors compare against the previous ranking, so the stored snapshot is
// injected before collecting and replaced after.
function withChartSnapshot(source, sourcePollState) {
  const snapshot = sourcePollState?.[source.id]?.chartSnapshot;
  if (!snapshot || !Array.isArray(snapshot.previousChart)) return source;
  return { ...source, previousChart: snapshot.previousChart, previousVersions: snapshot.previousVersions ?? [] };
}

export async function pollSource(source, { store, collectorResolver = collectorFor, sourcePollState = {} } = {}) {
  const { updates, chartSnapshot } = normalizeCollected(await collectorResolver(source.kind)(withChartSnapshot(source, sourcePollState)));
  const inserted = typeof store.insertMany === "function"
    ? await store.insertMany(source, updates)
    : (await Promise.all(updates.map((update) => store.insert(source, update)))).filter(Boolean).length;
  // Only chart collectors produce a snapshot, so the key stays absent for the rest
  // instead of writing an empty marker into every poll record.
  return chartSnapshot
    ? { sourceId: source.id, fetched: updates.length, inserted, chartSnapshot }
    : { sourceId: source.id, fetched: updates.length, inserted };
}

export async function pollAll(sources, dependencies) {
  const enabledSources = sources.filter((source) => source.enabled);
  const configuredConcurrency = Number(dependencies?.concurrency ?? process.env.POLL_CONCURRENCY ?? 4);
  const concurrency = Math.min(Math.max(Number.isFinite(configuredConcurrency) ? Math.floor(configuredConcurrency) : 4, 1), 12);
  const results = new Array(enabledSources.length);
  // Read once for the whole run: the ranking diff needs the snapshot each chart
  // source stored on its previous successful poll.
  const sourcePollState = typeof dependencies?.store?.sourcePollStates === "function"
    ? await dependencies.store.sourcePollStates()
    : (dependencies?.sourcePollState ?? {});

  // Sources whose collector can serve a whole group share one request, so they run
  // as a single task instead of competing for the per-source concurrency slots.
  const batchResolver = dependencies?.batchCollectorResolver ?? batchCollectorFor;
  const batchGroups = new Map();
  const individual = [];
  enabledSources.forEach((source, index) => {
    const batch = batchResolver(source.kind);
    if (!batch) {
      individual.push({ source, index });
      return;
    }
    // Group by kind rather than by resolved function: a resolver may hand back a new
    // function per call, which would split one kind into several batches.
    if (!batchGroups.has(source.kind)) batchGroups.set(source.kind, { batch, entries: [] });
    batchGroups.get(source.kind).entries.push({ source, index });
  });

  const tasks = [];
  individual.forEach(({ source, index }) => {
    tasks.push(async () => {
      try {
        results[index] = { ok: true, ...await pollSource(source, { ...dependencies, sourcePollState }) };
      } catch (error) {
        results[index] = { ok: false, sourceId: source.id, error: error instanceof Error ? error.message : String(error) };
      }
    });
  });
  batchGroups.forEach(({ batch, entries }) => {
    tasks.push(async () => {
      const grouped = entries.map((entry) => entry.source);
      let collected = [];
      try {
        // Callers pass polling dependencies (store, concurrency), not a transport,
        // so fall back to the real HTTP helper unless a test injected its own.
        collected = await batch(grouped, dependencies.fetchText ? dependencies : { fetchText });
      } catch (error) {
        collected = grouped.map((source) => ({ sourceId: source.id, ok: false, error: error instanceof Error ? error.message : String(error) }));
      }
      const bySourceId = new Map(collected.map((entry) => [entry.sourceId, entry]));
      await Promise.all(entries.map(async ({ source, index }) => {
        const entry = bySourceId.get(source.id);
        if (!entry) {
          results[index] = { ok: false, sourceId: source.id, error: "批量采集没有返回该数据源的结果" };
          return;
        }
        if (entry.ok === false) {
          results[index] = { ok: false, sourceId: source.id, error: entry.error };
          return;
        }
        try {
          const inserted = typeof dependencies.store.insertMany === "function"
            ? await dependencies.store.insertMany(source, entry.updates)
            : (await Promise.all((entry.updates ?? []).map((update) => dependencies.store.insert(source, update)))).filter(Boolean).length;
          results[index] = { ok: true, sourceId: source.id, fetched: (entry.updates ?? []).length, inserted };
        } catch (error) {
          results[index] = { ok: false, sourceId: source.id, error: error instanceof Error ? error.message : String(error) };
        }
      }));
    });
  });

  let nextTask = 0;
  const worker = async () => {
    while (nextTask < tasks.length) {
      const task = tasks[nextTask++];
      await task();
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
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
