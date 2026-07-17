export async function translateText(text, config, fetchImpl = fetch) {
  if (!config.baseUrl || !config.model) throw new Error("Translation service is not configured");
  const content = String(text ?? "").trim();
  if (!content) return "";
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
