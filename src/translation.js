const MAX_TRANSLATION_CHUNK_LENGTH = 4_000;

const languageCodes = {
  "简体中文": "zh-CN",
  "繁體中文": "zh-TW",
  "English": "en",
  "日本語": "ja",
  "한국어": "ko",
  "Français": "fr",
  "Deutsch": "de",
  "Español": "es",
  "Русский": "ru"
};

function translationChunks(content, maximumLength = MAX_TRANSLATION_CHUNK_LENGTH) {
  if (content.length <= maximumLength) return [content];
  const chunks = [];
  let start = 0;
  while (start < content.length) {
    const end = Math.min(start + maximumLength, content.length);
    if (end === content.length) {
      chunks.push(content.slice(start));
      break;
    }
    const excerpt = content.slice(start, end);
    const boundaries = [...excerpt.matchAll(/\n{2,}|\n|[。！？]|[.!?](?:\s|$)|\s+/g)]
      .map((match) => match.index + match[0].length)
      .filter((index) => index >= maximumLength / 2);
    const boundary = boundaries.at(-1) ?? maximumLength;
    chunks.push(content.slice(start, start + boundary));
    start += boundary;
  }
  return chunks;
}

function targetLanguageCode(config) {
  return languageCodes[config.targetLanguage] || config.targetLanguage || "zh-CN";
}

async function translateOpenAiChunk(content, config, fetchImpl) {
  const endpoint = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {})
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      messages: [
        { role: "system", content: `Translate release notes faithfully into ${config.targetLanguage || "简体中文"}. Preserve Markdown, links, code, version numbers, and proper nouns. Return only the translation.` },
        { role: "user", content }
      ]
    }),
    signal: AbortSignal.timeout(60_000)
  });
  if (!response.ok) throw new Error(`Translation request failed with ${response.status}`);
  const payload = await response.json();
  const result = payload.choices?.[0]?.message?.content;
  if (typeof result === "string" && result.trim()) return result.trim();
  throw new Error("Translation response did not include text");
}

async function translateGoogleChunk(content, config, fetchImpl) {
  if (!config.googleApiKey) throw new Error("Google translation API key is not configured");
  const url = new URL("https://translation.googleapis.com/language/translate/v2");
  url.searchParams.set("key", config.googleApiKey);
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: content, target: targetLanguageCode(config), format: "text" }),
    signal: AbortSignal.timeout(60_000)
  });
  if (!response.ok) throw new Error(`Google translation request failed with ${response.status}`);
  const payload = await response.json();
  const result = payload.data?.translations?.[0]?.translatedText;
  if (typeof result === "string" && result.trim()) return result.trim();
  throw new Error("Google translation response did not include text");
}

async function translateMicrosoftChunk(content, config, fetchImpl) {
  if (!config.microsoftApiKey) throw new Error("Microsoft translation API key is not configured");
  const url = new URL("https://api.cognitive.microsofttranslator.com/translate");
  url.searchParams.set("api-version", "3.0");
  url.searchParams.set("to", targetLanguageCode(config));
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": config.microsoftApiKey,
      ...(config.microsoftRegion ? { "Ocp-Apim-Subscription-Region": config.microsoftRegion } : {})
    },
    body: JSON.stringify([{ Text: content }]),
    signal: AbortSignal.timeout(60_000)
  });
  if (!response.ok) throw new Error(`Microsoft translation request failed with ${response.status}`);
  const payload = await response.json();
  const result = payload?.[0]?.translations?.[0]?.text;
  if (typeof result === "string" && result.trim()) return result.trim();
  throw new Error("Microsoft translation response did not include text");
}

async function translateChunk(content, config, fetchImpl) {
  const provider = config.provider || "openai";
  if (provider === "google") return translateGoogleChunk(content, config, fetchImpl);
  if (provider === "microsoft") return translateMicrosoftChunk(content, config, fetchImpl);
  return translateOpenAiChunk(content, config, fetchImpl);
}

export async function translateText(text, config, fetchImpl = fetch) {
  const content = String(text ?? "").trim();
  if (!content) return "";
  const provider = config.provider || "openai";
  if (!["openai", "google", "microsoft"].includes(provider)) throw new Error("Unsupported translation provider");
  if (provider === "openai" && (!config.baseUrl || !config.model)) throw new Error("Translation AI service is not configured");
  if (provider === "google" && !config.googleApiKey) throw new Error("Google translation API key is not configured");
  if (provider === "microsoft" && !config.microsoftApiKey) throw new Error("Microsoft translation API key is not configured");
  const chunks = translationChunks(content);
  const translations = [];
  for (const chunk of chunks) translations.push(await translateChunk(chunk, config, fetchImpl));
  return translations.join("\n\n");
}

export async function listModels(config, fetchImpl = fetch) {
  if ((config.provider || "openai") !== "openai") return [];
  if (!config.baseUrl) throw new Error("Translation base URL is not configured");
  const response = await fetchImpl(`${config.baseUrl.replace(/\/$/, "")}/models`, {
    headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`Model list request failed with ${response.status}`);
  const payload = await response.json();
  return (payload.data ?? []).map((model) => model.id).filter((id) => typeof id === "string" && id).sort((left, right) => left.localeCompare(right));
}
