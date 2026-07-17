import { createHash } from "node:crypto";
import { fetchText } from "../lib/http.js";

const baseUrl = "https://appstoreprice.org";

function decodeFlightData(html) {
  return [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)<\/script>/g)]
    .map((match) => JSON.parse(`"${match[1]}"`))
    .join("\n");
}

function jsonArrayEnd(text, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "[") depth += 1;
    else if (character === "]" && --depth === 0) return index + 1;
  }
  return -1;
}

function pricesForSubscription(flight, subscriptionId) {
  const marker = `"subscriptionId":"${subscriptionId}"`;
  const subscriptionIndex = flight.indexOf(marker);
  if (subscriptionIndex === -1) return [];
  const pricesIndex = flight.indexOf('"prices":', subscriptionIndex);
  if (pricesIndex === -1) return [];
  const arrayStart = flight.indexOf("[", pricesIndex);
  if (arrayStart === -1) return [];
  const arrayEnd = jsonArrayEnd(flight, arrayStart);
  if (arrayEnd === -1) return [];
  return JSON.parse(flight.slice(arrayStart, arrayEnd));
}

function subscriptionName(flight, subscriptionId) {
  const subscriptionIndex = flight.indexOf(`"subscriptionId":"${subscriptionId}"`);
  const nameIndex = flight.lastIndexOf('"name":"', subscriptionIndex);
  if (nameIndex === -1) return subscriptionId;
  const valueStart = nameIndex + '"name":"'.length;
  const valueEnd = flight.indexOf('"', valueStart);
  return valueEnd === -1 ? subscriptionId : flight.slice(valueStart, valueEnd);
}

function fingerprint(prices) {
  const snapshot = prices
    .map(({ region, currency, price }) => ({ region, currency, price }))
    .sort((left, right) => left.region.localeCompare(right.region));
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex").slice(0, 16);
}

export async function collectAppStorePrice(source, dependencies = { fetchText }) {
  const locale = source.locale ?? "zh";
  const url = `${baseUrl}/${encodeURIComponent(locale)}/apps/${encodeURIComponent(source.appId)}`;
  const flight = decodeFlightData(await dependencies.fetchText(url));
  const prices = pricesForSubscription(flight, source.subscriptionId);
  if (!prices.length) return [];

  const lowest = prices
    .filter((price) => Number.isFinite(price.priceCny))
    .toSorted((left, right) => left.priceCny - right.priceCny)[0];
  const planName = source.planName || subscriptionName(flight, source.subscriptionId);
  const lowestSummary = lowest
    ? `${lowest.regionName} ${lowest.currency} ${lowest.price}（约 ¥${lowest.priceCny}）`
    : "暂无折算价格";

  return [{
    externalId: `${source.subscriptionId}:${fingerprint(prices)}`,
    version: lowest ? `${lowest.currency} ${lowest.price}` : "价格快照",
    title: `${source.name}：${planName} 订阅价格`,
    url,
    publishedAt: new Date().toISOString(),
    summary: `已采集 ${prices.length} 个地区的订阅价格；当前最低为 ${lowestSummary}。`,
    metadata: { subscriptionId: source.subscriptionId, planName, lowest, prices }
  }];
}
