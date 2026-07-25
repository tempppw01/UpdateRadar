export function parseCompleteJsonDocuments(text) {
  const documents = [];
  let discardedTail = false;
  let offset = 0;

  while (offset < text.length) {
    while (/\s/.test(text[offset] ?? "")) offset += 1;
    if (offset >= text.length) break;
    if (!["{", "["].includes(text[offset])) {
      if (documents.length) { discardedTail = true; break; }
      throw new SyntaxError("持久化数据不是 JSON 对象或数组");
    }

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
    if (depth !== 0 || inString) {
      if (documents.length) { discardedTail = true; break; }
      throw new SyntaxError("持久化数据不完整");
    }
  }

  return { documents, discardedTail };
}
