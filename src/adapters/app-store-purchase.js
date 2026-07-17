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
  const markerIndex = html.indexOf('"addOns":');
  if (markerIndex === -1) return [];
  const start = html.indexOf("[", markerIndex);
  const end = jsonArrayEnd(html, start);
  return start === -1 || end === -1 ? [] : JSON.parse(html.slice(start, end));
}

export async function fetchInAppPurchase(source, app, dependencies = { fetchText }) {
  if (!source.subscriptionId) return null;
  const country = source.country ?? "us";
  const storefrontId = source.storefrontId || storefrontIds[country];
  if (!storefrontId) throw new Error(`Unsupported App Store storefront: ${country}`);
  const url = new URL(app.trackViewUrl);
  url.search = "";
  const addOn = addOnsFromPage(await dependencies.fetchText(url, {
    headers: {
      "Accept-Language": "en-US,en;q=0.9",
      "X-Apple-Store-Front": `${storefrontId}-1,29`,
      "X-Apple-Storefront": `${storefrontId}-1,29`
    }
  })).find((candidate) => candidate.buyParams?.includes(`offerName=${source.subscriptionId}`));
  if (!addOn) return null;
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ subscriptionId: source.subscriptionId, name: addOn.name, price: addOn.price }))
    .digest("hex")
    .slice(0, 16);
  return { name: source.planName || addOn.name, price: addOn.price, country, fingerprint, url: url.toString() };
}
