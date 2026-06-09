import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.RESEND_FROM ?? "noreply@jly.church";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildAnnouncementHtml(params: {
  title: string;
  body: string;
  recipientName: string;
}): string {
  const { title, body, recipientName } = params;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h1 style="font-size:20px;color:#111">${escapeHtml(title)}</h1>
  <p style="color:#444">Dear ${escapeHtml(recipientName)},</p>
  <p style="color:#444;white-space:pre-wrap">${escapeHtml(body)}</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:12px;color:#999">JLY Church</p>
</body>
</html>`;
}

export async function sendAnnouncementEmail(params: {
  to: string;
  recipientName: string;
  title: string;
  body: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.log(`[email] RESEND_API_KEY not set — skipping send to ${params.to}`);
    return { success: true };
  }

  const { error } = await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: params.title,
    html: buildAnnouncementHtml({
      title: params.title,
      body: params.body,
      recipientName: params.recipientName,
    }),
  });

  if (error) {
    console.error(`[email] Failed to send to ${params.to}:`, error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
