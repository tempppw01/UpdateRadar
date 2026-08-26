import { sendEmail, buildUpdateEmailContent } from "./lib/email.js";

export async function sendNotifications(events, sources, settings, dependencies = { sendEmail }) {
  if (!settings?.email?.enabled || !settings?.email?.to) {
    return { sent: 0, skipped: events.length };
  }

  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const sent = [];
  const failed = [];

  for (const event of events) {
    const source = sourceById.get(event.sourceId);
    if (!source) continue;

    try {
      const { subject, text, html } = buildUpdateEmailContent(event, source);
      await dependencies.sendEmail({
        host: settings.email.host,
        port: settings.email.port,
        secure: settings.email.secure ?? true,
        user: settings.email.user,
        password: settings.email.password,
        from: settings.email.from,
        to: settings.email.to,
        subject,
        text,
        html
      });
      sent.push({ eventId: event.id, sourceId: source.id });
    } catch (error) {
      failed.push({ eventId: event.id, sourceId: source.id, error: error.message });
    }
  }

  return { sent: sent.length, failed: failed.length, details: { sent, failed } };
}

export function defaultNotificationSettings() {
  return {
    email: {
      enabled: false,
      host: "",
      port: 465,
      secure: true,
      user: "",
      password: "",
      from: "",
      to: ""
    }
  };
}

export function validateNotificationSettings(input) {
  const email = input?.email || {};
  
  if (!email.enabled) {
    return { email: { ...defaultNotificationSettings().email, enabled: false } };
  }

  if (!email.host?.trim()) {
    throw new Error("SMTP 服务器地址不能为空");
  }
  if (!email.port || !Number.isInteger(Number(email.port))) {
    throw new Error("SMTP 端口必须是数字");
  }
  if (!email.to?.trim()) {
    throw new Error("收件人地址不能为空");
  }

  // 验证邮箱格式
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (email.to && !emailPattern.test(email.to)) {
    throw new Error("收件人地址格式不正确");
  }

  return {
    email: {
      enabled: true,
      host: String(email.host).trim(),
      port: Number(email.port) || 465,
      secure: email.secure !== false,
      user: String(email.user || "").trim(),
      password: String(email.password || "").trim(),
      from: String(email.from || "").trim(),
      to: String(email.to).trim()
    }
  };
}
