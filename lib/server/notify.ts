import "server-only";
import { db } from "./db";
import { appUrl, sendEmail } from "./email";

/** In-app notification, plus an email copy when email is configured. Never throws. */
export async function notify(userId: string, title: string, body: string, link?: string) {
  try {
    const n = await db.notification.create({ data: { userId, title, body, link }, include: { user: { select: { email: true } } } });
    void sendEmail(n.user.email, `OrbitPass: ${title}`, `${body}${link ? `\n\n${appUrl()}${link}` : ""}`);
  } catch (e) { console.error("[notify]", e); }
}
