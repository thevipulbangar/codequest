import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { HttpError, forgetUser, requireUser, startSession } from "@/lib/server/auth";
import { body, handle } from "@/lib/server/http";
import { hashPassword, verifyPassword } from "@/lib/server/password";
import { rateLimitShared } from "@/lib/server/ratelimit";

const Schema = z.object({ current: z.string().max(200), next: z.string().min(8, "At least 8 characters").max(72) });

/** Change password while signed in. Signs out every other session. */
export const PATCH = handle(async (req: Request) => {
  const u = await requireUser();
  await rateLimitShared(`pwchange:${u.id}`, 5, 15 * 60_000);
  const b = await body(req, Schema);
  if (!(await verifyPassword(b.current, u.passwordHash))) throw new HttpError(400, "Current password is incorrect");
  if (b.current === b.next) throw new HttpError(400, "Choose a different password");
  const user = await db.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(b.next) } });
  await db.session.deleteMany({ where: { userId: u.id } });
  forgetUser(u.id);
  await startSession(user); // keep this device signed in
  return NextResponse.json({ ok: true });
});
