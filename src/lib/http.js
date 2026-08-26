import { isPrivateOrLocalhost } from "../sources.js";

const SSRF_BLOCKED_ERROR = "请求被阻止：目标地址指向内网或本地地址";

export async function fetchText(url, options = {}) {
  // 运行时 SSRF 防护：验证最终请求的 URL
  validateUrl(url);
  
  const response = await fetch(url, {
    headers: {
      Accept: "application/json, application/rss+xml, application/atom+xml, text/html;q=0.9",
      "User-Agent": "UpdateRadar/0.1 (+https://github.com/tempppw01/UpdateRadar)",
      ...options.headers
    },
    signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error(`Request to ${url} failed with ${response.status}`);
  }

  // 重定向后 SSRF 防护：检查最终 URL 是否指向私有地址
  validateUrl(response.url, "重定向目标");

  return response.text();
}

function validateUrl(urlString, context = "URL") {
  try {
    const url = new URL(urlString);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error(`${context}必须使用 HTTP(S) 协议`);
    }
    if (isPrivateOrLocalhost(url.hostname)) {
      throw new Error(`${context}${SSRF_BLOCKED_ERROR}`);
    }
  } catch (error) {
    if (error.message.includes(SSRF_BLOCKED_ERROR) || error.message.includes("必须使用")) {
      throw error;
    }
    throw new Error(`${context}不是有效的 URL`);
  }
}

export function validateExternalUrl(urlString, context = "URL") {
  validateUrl(urlString, context);
}
