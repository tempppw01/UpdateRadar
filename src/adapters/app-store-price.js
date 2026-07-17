import { createHash } from "node:crypto";
import { fetchText } from "../lib/http.js";

const storefrontIds = {
  au: "143460", br: "143503", ca: "143455", cn: "143465", de: "143443",
  fr: "143442", gb: "143444", hk: "143463", in: "143467", jp: "143462",
  kr: "143466", ph: "143474", sg: "143464", tw: "143470", us: "143441"
};

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

function addOnsFromPage(html) {
  const marker = '"addOns":';
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return [];
  const start = html.indexOf("[", markerIndex);
  if (start === -1) return [];
  const end = jsonArrayEnd(html, start);
  if (end === -1) return [];
  return JSON.parse(html.slice(start, end));
}

function fingerprint(addOn) {
  return createHash("sha256")
    .update(JSON.stringify({ offerName: addOn.offerName, name: addOn.name, price: addOn.price }))
    .digest("hex")
    .slice(0, 16);
}

export async function collectAppStorePrice(source, dependencies = { fetchText }) {
  const country = source.country ?? "us";
  const lookupUrl = `https://itunes.apple.com/lookup?id=${encodeURIComponent(source.appId)}&country=${encodeURIComponent(country)}`;
  const lookup = JSON.parse(await dependencies.fetchText(lookupUrl));
  const app = lookup.results?.[0];
  if (!app?.trackViewUrl) return [];

  const storefrontId = source.storefrontId || storefrontIds[country];
  if (!storefrontId) throw new Error(`Unsupported App Store storefront: ${country}`);
  const pageUrl = new URL(app.trackViewUrl);
  pageUrl.search = "";
  const headers = {
    "Accept-Language": "en-US,en;q=0.9",
    "X-Apple-Store-Front": `${storefrontId}-1,29`,
    "X-Apple-Storefront": `${storefrontId}-1,29`
  };
  const officialUrl = pageUrl.toString();
  const addOn = addOnsFromPage(await dependencies.fetchText(officialUrl, { headers }))
    .find((candidate) => candidate.buyParams?.includes(`offerName=${source.subscriptionId}`));
  if (!addOn) return [];

  return [{
    externalId: `${source.subscriptionId}:${country}:${fingerprint({ ...addOn, offerName: source.subscriptionId })}`,
    version: addOn.price,
    title: `${source.name}：${source.planName || addOn.name}`,
    url: officialUrl,
    publishedAt: new Date().toISOString(),
    summary: `Apple App Store ${country.toUpperCase()} 商店当前内购价格：${addOn.price}。`,
    metadata: { appId: source.appId, country, subscriptionId: source.subscriptionId, name: addOn.name, price: addOn.price }
  }];
}
