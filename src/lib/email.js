import { createConnection } from "node:net";
import { isPrivateOrLocalhost } from "../sources.js";

const CRLF = "\r\n";

function encodeAuthValue(value) {
  return Buffer.from(value, "utf-8").toString("base64");
}

function parseSmtpResponse(line) {
  const code = parseInt(line.slice(0, 3), 10);
  const isLast = line[3] !== "-";
  const message = line.slice(4);
  return { code, isLast, message };
}

async function smtpCommand(socket, expectedCode, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let buffer = "";
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("SMTP 响应超时"));
    }, timeoutMs);

    const onData = (data) => {
      buffer += data.toString();
      const lines = buffer.split(CRLF);
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const response = parseSmtpResponse(line);
        chunks.push(response);
        if (response.isLast) {
          clearTimeout(timer);
          socket.off("data", onData);
          socket.off("error", onError);
          const fullMessage = chunks.map((c) => c.message).join(" ");
          if (chunks.every((c) => c.code === expectedCode)) {
            resolve(fullMessage);
          } else {
            reject(new Error(`SMTP 错误: ${chunks[0].code} ${fullMessage}`));
          }
          return;
        }
      }
    };

    const onError = (error) => {
      clearTimeout(timer);
      reject(error);
    };

    socket.on("data", onData);
    socket.on("error", onError);
  });
}

function buildMailContent({ from, to, subject, text, html }) {
  const boundary = `----=_Part_${crypto.randomUUID().replace(/-/g, "")}`;
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${encodeAuthValue(subject)}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodeAuthValue(text),
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodeAuthValue(html || text),
    "",
    `--${boundary}--`,
    ""
  ];
  return lines.join(CRLF);
}

export async function sendEmail({ host, port, secure, user, password, from, to, subject, text, html }, dependencies = { createConnection, setTimeout }) {
  if (!host || !port || !to) {
    throw new Error("邮件配置不完整");
  }

  // SSRF 防护：验证 SMTP 服务器地址
  const smtpHost = host.toLowerCase();
  if (isPrivateOrLocalhost(smtpHost)) {
    throw new Error("SMTP 服务器地址不能指向内网或本地地址");
  }

  return new Promise(async (resolve, reject) => {
    let socket;
    let closed = false;

    const cleanup = () => {
      closed = true;
      if (socket) socket.destroy();
    };

    try {
      socket = dependencies.createConnection({ host, port: Number(port) });

      await new Promise((res, rej) => {
        socket.once("connect", res);
        socket.once("error", rej);
      });

      // 等待服务器欢迎消息
      await smtpCommand(socket, 220);

      // EHLO
      socket.write(`EHLO updateradar${CRLF}`);
      await smtpCommand(socket, 250);

      // STARTTLS (如果启用安全连接且端口为 587)
      if (secure && Number(port) === 587) {
        socket.write(`STARTTLS${CRLF}`);
        await smtpCommand(socket, 220);
      }

      // 认证
      if (user && password) {
        socket.write(`AUTH LOGIN${CRLF}`);
        await smtpCommand(socket, 334);
        socket.write(`${encodeAuthValue(user)}${CRLF}`);
        await smtpCommand(socket, 334);
        socket.write(`${encodeAuthValue(password)}${CRLF}`);
        await smtpCommand(socket, 235);
      }

      // MAIL FROM
      socket.write(`MAIL FROM:<${from || user}>${CRLF}`);
      await smtpCommand(socket, 250);

      // RCPT TO
      socket.write(`RCPT TO:<${to}>${CRLF}`);
      await smtpCommand(socket, 250);

      // DATA
      socket.write(`DATA${CRLF}`);
      await smtpCommand(socket, 354);

      // 邮件内容
      const content = buildMailContent({ from: from || user, to, subject, text, html });
      socket.write(content);
      socket.write(`${CRLF}.${CRLF}`);
      await smtpCommand(socket, 250);

      // QUIT
      socket.write(`QUIT${CRLF}`);
      await smtpCommand(socket, 221);

      cleanup();
      resolve({ success: true });
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

export function buildUpdateEmailContent(event, source) {
  const subject = `【更新通知】${source.name} ${event.version || ""}`.trim();
  
  const text = [
    `${source.name} 已发布新版本`,
    "",
    `版本: ${event.version || "未知"}`,
    `发布时间: ${event.publishedAt || "未知"}`,
    `来源: ${source.kind}`,
    "",
    event.title || "",
    "",
    event.summary || "暂无更新说明",
    "",
    `查看详情: ${event.url || ""}`
  ].join("\n");

  const html = [
    `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">`,
    `<h2 style="margin: 0 0 16px; color: #1a1a1a;">${escapeHtml(source.name)} ${event.version ? `<span style="color: #666;">${escapeHtml(event.version)}</span>` : ""}</h2>`,
    `<p style="color: #666; margin: 0 0 16px; font-size: 14px;">发布于 ${escapeHtml(event.publishedAt || "未知时间")} · ${escapeHtml(source.kind)}</p>`,
    event.summary ? `<div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 0 0 16px; white-space: pre-wrap; font-size: 14px; line-height: 1.6;">${escapeHtml(event.summary)}</div>` : "",
    event.url ? `<a href="${escapeHtml(event.url)}" style="display: inline-block; background: #0066cc; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">查看详情</a>` : "",
    `<hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">`,
    `<p style="color: #999; font-size: 12px;">此邮件由 UpdateRadar 自动发送</p>`,
    `</div>`
  ].join("");

  return { subject, text, html };
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
