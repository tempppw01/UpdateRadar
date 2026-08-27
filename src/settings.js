import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const defaults = {
  events: { limitPerCategory: 200 },
  translation: {
    provider: "openai",
    baseUrl: "https://ai.shuaihong.fun/v1",
    apiKey: "",
    model: "",
    targetLanguage: "简体中文",
    googleApiKey: "",
    microsoftApiKey: "",
    microsoftRegion: ""
  }
};

export class JsonSettingsStore {
  constructor(path) { this.path = path; }

  async load() {
    try {
      const saved = JSON.parse(await readFile(this.path, "utf8"));
      return {
        ...defaults,
        ...saved,
        events: { ...defaults.events, ...(saved.events ?? {}) },
        translation: { ...defaults.translation, ...(saved.translation ?? {}) }
      };
    } catch (error) {
      if (error.code === "ENOENT") return structuredClone(defaults);
      throw error;
    }
  }

  async save(settings) {
    await mkdir(dirname(this.path), { recursive: true });
    const temporaryPath = `${this.path}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.path);
  }

  async translation() { return (await this.load()).translation; }

  async events() { return (await this.load()).events; }

  async updateEvents(input) {
    const current = await this.load();
    const limitPerCategory = Number(input.limitPerCategory ?? current.events.limitPerCategory);
    if (!Number.isInteger(limitPerCategory) || limitPerCategory < 1 || limitPerCategory > 10_000) {
      throw new Error("每个分类的更新数量应为 1 到 10000 的整数");
    }
    current.events = { limitPerCategory };
    await this.save(current);
    return current.events;
  }

  async updateTranslation(input) {
    const current = await this.load();
    const provider = ["openai", "google", "microsoft"].includes(String(input.provider ?? current.translation.provider).trim())
      ? String(input.provider ?? current.translation.provider).trim()
      : "openai";
    const baseUrl = String(input.baseUrl ?? current.translation.baseUrl).trim().replace(/\/$/, "");
    const model = String(input.model ?? current.translation.model).trim();
    const submittedApiKey = String(input.apiKey ?? "").trim();
    const apiKey = submittedApiKey || current.translation.apiKey;
    const submittedGoogleApiKey = String(input.googleApiKey ?? "").trim();
    const googleApiKey = submittedGoogleApiKey || current.translation.googleApiKey;
    const submittedMicrosoftApiKey = String(input.microsoftApiKey ?? "").trim();
    const microsoftApiKey = submittedMicrosoftApiKey || current.translation.microsoftApiKey;
    const microsoftRegion = String(input.microsoftRegion ?? current.translation.microsoftRegion).trim();
    const targetLanguage = String(input.targetLanguage ?? current.translation.targetLanguage).trim() || "简体中文";
    if (baseUrl) {
      const url = new URL(baseUrl);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Translation base URL must use HTTP(S)");
    }
    current.translation = { provider, baseUrl, apiKey, model, targetLanguage, googleApiKey, microsoftApiKey, microsoftRegion };
    await this.save(current);
    return current.translation;
  }

  async publicTranslation() {
    const config = await this.translation();
    return {
      provider: config.provider,
      baseUrl: config.baseUrl,
      model: config.model,
      targetLanguage: config.targetLanguage,
      apiKeyConfigured: Boolean(config.apiKey),
      googleApiKeyConfigured: Boolean(config.googleApiKey),
      microsoftApiKeyConfigured: Boolean(config.microsoftApiKey),
      microsoftRegion: config.microsoftRegion
    };
  }
}
