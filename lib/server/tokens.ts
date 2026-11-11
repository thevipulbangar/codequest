import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
import { appUrl, emailEnabled, sendEmail } from "./email";

const hash = (t: string) => createHash("sha256").update(t).digest("hex");

/** Create a one-time token; only its hash is stored. Older unused tokens of the same purpose are revoked. */
export async function issueToken(userId: string, purpose: "reset" | "verify_email", ttlMs: number) {
  const token = randomBytes(32).toString("base64url");
  await db.$transaction([
    db.authToken.deleteMany({ where: { userId, purpose, usedAt: null } }),
    db.authToken.create({ data: { tokenHash: hash(token), userId, purpose, expiresAt: new Date(Date.now() + ttlMs) } }),
  ]);
  return token;
}

/** Atomically consume a valid token. Returns the userId, or null if invalid/expired/used. */
export async function consumeToken(token: string, purpose: "reset" | "verify_email") {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const t = await db.authToken.findUnique({ where: { tokenHash: hash(token) } });
  if (!t || t.purpose !== purpose || t.usedAt || t.expiresAt < new Date()) return null;
  const r = await db.authToken.updateMany({ where: { id: t.id, usedAt: null }, data: { usedAt: new Date() } });
  return r.count === 1 ? t.userId : null;
}

/** Email a confirmation link. No-op (false) when email isn't configured. */
export async function sendVerification(userId: string, email: string) {
  if (!emailEnabled()) return false;
  const token = await issueToken(userId, "verify_email", 48 * 3600_000);
  return sendEmail(email, "Confirm your OrbitPass email", `Welcome to OrbitPass!\n\nConfirm your email address (valid for 48 hours):\n${appUrl()}/verify-email?token=${token}`);
}
