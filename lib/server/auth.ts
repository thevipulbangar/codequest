import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { Role, User } from "@prisma/client";
import { db } from "./db";

const COOKIE = "op_session";
const TTL_MS = 7 * 24 * 3600_000;
const tokenHash = (t: string) => createHash("sha256").update(t).digest("hex");

export type PublicUser = Omit<User, "passwordHash">;
export const publicUser = ({ passwordHash: _ph, ...u }: User): PublicUser => u; // eslint-disable-line @typescript-eslint/no-unused-vars

/**
 * Per-instance cache of verified sessions, so most requests skip the session DB lookup.
 * NOTE: a logout or role change is applied instantly on the instance that handled it; other warm instances
 * may honour the old session for up to CACHE_MS. Lower CACHE_MS (or set 0) if that window matters.
 */
const CACHE_MS = 60_000;
const sessionCache = new Map<string, { user: User; expiresAt: number; cachedAt: number }>();
const remember = (hash: string, user: User, expiresAt: number) => {
  if (sessionCache.size > 5000) sessionCache.clear(); // bound memory
  sessionCache.set(hash, { user, expiresAt, cachedAt: Date.now() });
};
/** Drop cached sessions for a user (after profile/role changes). */
export function forgetUser(userId: string) {
  for (const [k, v] of sessionCache) if (v.user.id === userId) sessionCache.delete(k);
}

export async function startSession(user: User) {
  const token = randomBytes(32).toString("base64url");
  const hash = tokenHash(token), expiresAt = Date.now() + TTL_MS;
  await db.session.create({ data: { tokenHash: hash, userId: user.id, expiresAt: new Date(expiresAt) } });
  remember(hash, user, expiresAt);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: TTL_MS / 1000,
  });
}

export async function endSession() {
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  if (t) { const h = tokenHash(t); sessionCache.delete(h); await db.session.deleteMany({ where: { tokenHash: h } }); }
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  const hash = tokenHash(t), now = Date.now();
  const hit = sessionCache.get(hash);
  if (hit && now - hit.cachedAt < CACHE_MS && hit.expiresAt > now) return hit.user;
  const s = await db.session.findUnique({ where: { tokenHash: hash }, include: { user: true }, relationLoadStrategy: "join" });
  if (!s || s.expiresAt.getTime() < now) { sessionCache.delete(hash); return null; }
  remember(hash, s.user, s.expiresAt.getTime());
  return s.user;
}

export class HttpError extends Error { constructor(public status: number, msg: string) { super(msg); } }

/** Throws 401/403. Use inside route handlers wrapped by `handle`. */
export async function requireUser(roles?: Role[]): Promise<User> {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "Not signed in");
  if (roles && !roles.includes(u.role)) throw new HttpError(403, "Not allowed");
  return u;
}
