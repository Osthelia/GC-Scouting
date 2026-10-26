/**
 * GC-Scouting - email
 *
 * Transactional emails through Resend.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

// Transactional emails through Resend's HTTP API.

const SEND_TIMEOUT_MS = 5000;

export type EmailResult = { ok: true } | { ok: false; error: "not_configured" | "rejected" | "unavailable" };

export async function sendEmail(input: { to: string; subject: string; html: string; text: string }): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "not_configured" };
  const from = process.env.RESEND_FROM_EMAIL || "GC Scouting <notifications@gc-stats.app>";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, ...input }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (response.ok) return { ok: true };
    console.warn(`[email] Resend answered ${response.status}`);
    // 429 and 5xx are worth a later retry, any other 4xx will fail again.
    return { ok: false, error: response.status === 429 || response.status >= 500 ? "unavailable" : "rejected" };
  } catch (error) {
    console.warn("[email] Resend request failed", error);
    return { ok: false, error: "unavailable" };
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export type EmailButton = { label: string; url: string; primary?: boolean };

/** Inline styled layout shared by every email, colors of the site's dark theme. */
export function renderEmail({
  locale,
  title,
  paragraphs,
  buttons,
  footer,
}: {
  locale: string;
  title: string;
  paragraphs: string[];
  buttons: EmailButton[];
  footer: string;
}): {
  html: string;
  text: string;
} {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#b3b3b3;">${escapeHtml(p)}</p>`).join("");
  const links = buttons
    .map((b) => {
      const style = b.primary ? "background:#9b7bff;color:#140a33;" : "background:#232323;color:#f2f2f2;border:1px solid #333333;";
      return `<a href="${escapeHtml(b.url)}" style="display:inline-block;margin:0 8px 8px 0;padding:11px 20px;border-radius:10px;${style}font-size:14px;font-weight:600;text-decoration:none;">${escapeHtml(b.label)}</a>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="${escapeHtml(locale)}">
  <head>
    <meta charset="utf-8" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
  </head>
  <body style="margin:0;padding:32px 16px;background:#0e0e0e;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#161616;border-radius:14px;border-left:3px solid #9b7bff;">
      <tr>
        <td style="padding:28px;">
          <div style="font-size:13px;font-weight:700;color:#9b7bff;letter-spacing:.02em;margin-bottom:16px;">GC Scouting</div>
          <h1 style="margin:0 0 14px;font-size:19px;line-height:1.35;color:#f2f2f2;">${escapeHtml(title)}</h1>
          ${body}
          <div style="margin-top:8px;">${links}</div>
          <p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#8a8a8a;">${escapeHtml(footer)}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [title, ...paragraphs, ...buttons.map((b) => `${b.label}: ${b.url}`), footer].join("\n\n");
  return { html, text };
}
