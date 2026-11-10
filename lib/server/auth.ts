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

export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await db.session.create({ data: { tokenHash: tokenHash(token), userId, expiresAt: new Date(Date.now() + TTL_MS) } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: TTL_MS / 1000,
  });
}

export async function endSession() {
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  if (t) await db.session.deleteMany({ where: { tokenHash: tokenHash(t) } });
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  const s = await db.session.findUnique({ where: { tokenHash: tokenHash(t) }, include: { user: true } });
  if (!s || s.expiresAt < new Date()) return null;
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
