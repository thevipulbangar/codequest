import "server-only";

/** True when an email provider is configured (Resend). */
export const emailEnabled = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

/** Public base URL for links in emails. Never derived from request headers (host-header injection). */
export const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

/** Sends a plain-text email via Resend. Returns false (and logs) when email isn't configured or fails. */
export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  if (!emailEnabled()) { console.warn(`[email] not configured — skipped "${subject}" to ${to}`); return false; }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) console.error("[email] send failed", r.status, await r.text());
    return r.ok;
  } catch (e) { console.error("[email] send error", e); return false; }
}
