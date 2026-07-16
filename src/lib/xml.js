function decode(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function element(block, names) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
    if (match) return decode(match[1]);
  }
  return "";
}

function link(block) {
  const href = block.match(/<link\s+[^>]*href=["']([^"']+)["'][^>]*\/?>(?:<\/link>)?/i);
  return href ? decode(href[1]) : element(block, ["link"]);
}

export function parseFeed(xml) {
  const blocks = xml.match(/<(?:item|entry)(?:\s[^>]*)?>[\s\S]*?<\/(?:item|entry)>/gi) ?? [];
  return blocks.map((block) => ({
    id: element(block, ["guid", "id", "link"]),
    title: element(block, ["title"]),
    url: link(block),
    publishedAt: element(block, ["pubDate", "published", "updated"]),
    summary: element(block, ["description", "summary", "content"])
  })).filter((item) => item.id && item.title);
}
