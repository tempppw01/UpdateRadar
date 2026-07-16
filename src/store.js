import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const emptyState = () => ({ events: [] });

export class JsonEventStore {
  constructor(path) {
    this.path = path;
    this.state = null;
  }

  async load() {
    if (this.state) return this.state;
    try {
      this.state = JSON.parse(await readFile(this.path, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      this.state = emptyState();
    }
    return this.state;
  }

  async save() {
    await mkdir(dirname(this.path), { recursive: true });
    const temporaryPath = `${this.path}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(this.state, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.path);
  }

  async insert(source, update) {
    const state = await this.load();
    const fingerprint = `${source.id}:${update.externalId}`;
    if (state.events.some((event) => event.fingerprint === fingerprint)) return false;

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
      .slice(0, Math.min(Math.max(Number(limit) || 50, 1), 200));
  }
}
