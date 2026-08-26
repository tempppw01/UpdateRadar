import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { isPrivateOrLocalhost } from "./sources.js";
import { defaultNotificationSettings, validateNotificationSettings } from "./notification.js";

const defaults = {
  events: { limitPerCategory: 200 },
  translation: { baseUrl: "https://ai.shuaihong.fun/v1", apiKey: "", model: "", targetLanguage: "简体中文" },
  notification: defaultNotificationSettings()
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
    translation: { ...defaults.translation, ...(saved.translation ?? {}) },
    notification: { ...defaults.notification, ...(saved.notification ?? {}) }
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
    const baseUrl = String(input.baseUrl ?? current.translation.baseUrl).trim().replace(/\/$/, "");
    const model = String(input.model ?? current.translation.model).trim();
    const submittedApiKey = String(input.apiKey ?? "").trim();
    const apiKey = submittedApiKey || current.translation.apiKey;
    const targetLanguage = String(input.targetLanguage ?? current.translation.targetLanguage).trim() || "简体中文";
    if (baseUrl) {
      const url = new URL(baseUrl);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Translation base URL must use HTTP(S)");
      if (isPrivateOrLocalhost(url.hostname)) {
        throw new Error("翻译服务地址不能指向内网或本地地址");
      }
    }
    current.translation = { baseUrl, apiKey, model, targetLanguage };
    await this.save(current);
    return current.translation;
  }

  async publicTranslation() {
    const config = await this.translation();
    return { baseUrl: config.baseUrl, model: config.model, targetLanguage: config.targetLanguage, apiKeyConfigured: Boolean(config.apiKey) };
  }

  async notification() {
    return (await this.load()).notification;
  }

  async updateNotification(input) {
    const current = await this.load();
    current.notification = validateNotificationSettings(input);
    await this.save(current);
    // 返回时隐藏密码
    const { password, ...safe } = current.notification.email;
    return { email: { ...safe, passwordConfigured: Boolean(password) } };
  }

  async publicNotification() {
    const config = await this.notification();
    const { password, ...safe } = config.email;
    return { email: { ...safe, passwordConfigured: Boolean(password) } };
  }
}
