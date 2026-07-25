import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const emptyState = () => ({ events: [], lastSyncedAt: null, sourcePollState: {} });

function parseJsonDocuments(text) {
  const documents = [];
  let offset = 0;
  while (offset < text.length) {
    while (/\s/.test(text[offset] ?? "")) offset += 1;
    if (offset >= text.length) break;
    if (!["{", "["].includes(text[offset])) throw new SyntaxError("事件数据不是 JSON 对象或数组");
    const start = offset;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (; offset < text.length; offset += 1) {
      const character = text[offset];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') inString = true;
      else if (character === "{" || character === "[") depth += 1;
      else if (character === "}" || character === "]") {
        depth -= 1;
        if (depth === 0) {
          documents.push(JSON.parse(text.slice(start, offset + 1)));
          offset += 1;
          break;
        }
      }
    }
    if (depth !== 0 || inString) throw new SyntaxError("事件数据不完整");
  }
  return documents;
}

function mergeEventDocuments(documents) {
  const state = emptyState();
  const eventsByFingerprint = new Map();
  documents.forEach((document) => {
    if (!document || Array.isArray(document) || typeof document !== "object") return;
    (document.events ?? []).forEach((event) => {
      const key = event?.fingerprint || event?.id;
      if (key) eventsByFingerprint.set(key, event);
    });
    state.sourcePollState = { ...state.sourcePollState, ...(document.sourcePollState ?? {}) };
    const previous = Date.parse(state.lastSyncedAt ?? "");
    const candidate = Date.parse(document.lastSyncedAt ?? "");
    if (Number.isFinite(candidate) && (!Number.isFinite(previous) || candidate > previous)) state.lastSyncedAt = document.lastSyncedAt;
  });
  state.events = [...eventsByFingerprint.values()];
  return state;
}

export class JsonEventStore {
  constructor(path) {
    this.path = path;
    this.state = null;
    this.saveQueue = Promise.resolve();
  }

  async load() {
    if (this.state) return this.state;
    try {
      this.state = JSON.parse(await readFile(this.path, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") this.state = emptyState();
      else {
        const text = await readFile(this.path, "utf8");
        const documents = parseJsonDocuments(text);
        if (documents.length < 2) throw error;
        this.state = mergeEventDocuments(documents);
        await this.save();
        console.warn(`Recovered ${documents.length} concatenated event snapshots in ${this.path}`);
      }
    }
    return this.state;
  }

  async save() {
    const task = this.saveQueue.then(() => this.writeState(), () => this.writeState());
    this.saveQueue = task.catch(() => undefined);
    return task;
  }

  async writeState() {
    await mkdir(dirname(this.path), { recursive: true });
    const temporaryPath = `${this.path}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(this.state, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.path);
  }

  async insert(source, update) {
    const state = await this.load();
    const fingerprint = `${source.id}:${update.externalId}`;
    const existing = state.events.find((event) => event.fingerprint === fingerprint);
    if (existing) {
      Object.assign(existing, { ...update, metadata: { ...existing.metadata, ...update.metadata } });
      await this.save();
      return false;
    }

    state.events.push({
      id: crypto.randomUUID(),
      fingerprint,
      sourceId: source.id,
      sourceName: source.name,
      sourceKind: source.kind,
      tags: source.tags ?? [],
      detectedAt: new Date().toISOString(),
      ...update
    });
    await this.save();
    return true;
  }

  async list({ sourceId, tag, limit = 50 } = {}) {
    const state = await this.load();
    return state.events
      .filter((event) => !sourceId || event.sourceId === sourceId)
      .filter((event) => !tag || event.tags.includes(tag))
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, Math.min(Math.max(Number(limit) || 50, 1), 10000));
  }

  async latestDetectedAtBySource() {
    const state = await this.load();
    return state.events.reduce((latest, event) => {
      const detectedAt = new Date(event.detectedAt).getTime();
      if (Number.isFinite(detectedAt) && (!latest[event.sourceId] || detectedAt > new Date(latest[event.sourceId]).getTime())) latest[event.sourceId] = event.detectedAt;
      return latest;
    }, {});
  }

  async lastSyncedAt() {
    return (await this.load()).lastSyncedAt ?? null;
  }

  async markSyncedAt(value = new Date().toISOString()) {
    const state = await this.load();
    state.lastSyncedAt = value;
    await this.save();
    return state.lastSyncedAt;
  }

  async sourcePollStates() {
    return { ...((await this.load()).sourcePollState ?? {}) };
  }

  async recordPollResults(results, sources, { now = Date.now(), idleIntervalMinutes = Number(process.env.POLL_INTERVAL_MINUTES ?? 30) } = {}) {
    const state = await this.load();
    state.sourcePollState ??= {};
    const sourceById = new Map(sources.map((source) => [source.id, source]));
    const checkedAt = new Date(now).toISOString();
    results.filter((result) => !result.skipped).forEach((result) => {
      const source = sourceById.get(result.sourceId);
      if (!source) return;
      const previous = state.sourcePollState[result.sourceId] ?? {};
      const configuredIdleDelay = Math.max(1, Number(idleIntervalMinutes) || 30);
      const idleDelay = source.kind === "qnap-app"
        ? Math.max(configuredIdleDelay, Number(source.cooldownMinutes) || 1440)
        : configuredIdleDelay;
      if (result.ok) {
        const updatedDelay = Math.max(0, Number(source.cooldownMinutes ?? 60));
        const delay = result.inserted > 0 ? updatedDelay : idleDelay;
        state.sourcePollState[result.sourceId] = {
          ...previous,
          lastCheckedAt: checkedAt,
          lastSuccessAt: checkedAt,
          failureCount: 0,
          nextCheckAt: new Date(now + delay * 60_000).toISOString()
        };
      } else {
        const failureCount = Number(previous.failureCount ?? 0) + 1;
        const delay = Math.min(5 * 2 ** (failureCount - 1), 360);
        state.sourcePollState[result.sourceId] = {
          ...previous,
          lastCheckedAt: checkedAt,
          failureCount,
          lastError: result.error || "Unknown polling error",
          nextCheckAt: new Date(now + delay * 60_000).toISOString()
        };
      }
    });
    await this.save();
    return this.sourcePollStates();
  }

  async removeBySourceIds(ids) {
    const sourceIds = new Set(ids.map((id) => String(id)));
    if (!sourceIds.size) return 0;
    const state = await this.load();
    const before = state.events.length;
    state.events = state.events.filter((event) => !sourceIds.has(event.sourceId));
    state.sourcePollState ??= {};
    let pollStatesRemoved = 0;
    sourceIds.forEach((id) => {
      if (!(id in state.sourcePollState)) return;
      delete state.sourcePollState[id];
      pollStatesRemoved += 1;
    });
    const removed = before - state.events.length;
    if (removed || pollStatesRemoved) await this.save();
    return removed;
  }

  async removeOutsideSourceIds(ids) {
    const sourceIds = new Set(ids.map((id) => String(id)));
    const state = await this.load();
    const before = state.events.length;
    state.events = state.events.filter((event) => sourceIds.has(event.sourceId));
    state.sourcePollState ??= {};
    const stalePollStateIds = Object.keys(state.sourcePollState).filter((id) => !sourceIds.has(id));
    stalePollStateIds.forEach((id) => delete state.sourcePollState[id]);
    const removed = before - state.events.length;
    if (removed || stalePollStateIds.length) await this.save();
    return removed;
  }
}
