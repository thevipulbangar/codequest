import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { HttpError, forgetUser } from "@/lib/server/auth";
import { body, clientIp, handle } from "@/lib/server/http";
import { hashPassword } from "@/lib/server/password";
import { rateLimitShared } from "@/lib/server/ratelimit";
import { consumeToken } from "@/lib/server/tokens";

export const POST = handle(async (req: Request) => {
  await rateLimitShared(`reset:${clientIp(req)}`, 10, 3600_000);
  const b = await body(req, z.object({ token: z.string().max(200), password: z.string().min(8, "At least 8 characters").max(72) }));
  const userId = await consumeToken(b.token, "reset");
  if (!userId) throw new HttpError(400, "This reset link is invalid or has expired. Request a new one.");
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(b.password), emailVerifiedAt: new Date() } });
  await db.session.deleteMany({ where: { userId } }); // sign out everywhere
  forgetUser(userId);
  return NextResponse.json({ ok: true });
});
