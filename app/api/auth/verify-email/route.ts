import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { HttpError, forgetUser, requireUser } from "@/lib/server/auth";
import { body, handle } from "@/lib/server/http";
import { emailEnabled } from "@/lib/server/email";
import { rateLimitShared } from "@/lib/server/ratelimit";
import { consumeToken, sendVerification } from "@/lib/server/tokens";

/** Confirm an email address with the token from the link. */
export const POST = handle(async (req: Request) => {
  const b = await body(req, z.object({ token: z.string().max(200) }));
  const userId = await consumeToken(b.token, "verify_email");
  if (!userId) throw new HttpError(400, "This confirmation link is invalid or has expired.");
  await db.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  forgetUser(userId);
  return NextResponse.json({ ok: true });
});

/** (Re)send the confirmation email to the signed-in user. */
export const PUT = handle(async () => {
  const u = await requireUser();
  if (u.emailVerifiedAt) return NextResponse.json({ ok: true, alreadyVerified: true });
  if (!emailEnabled()) throw new HttpError(503, "Email isn't available yet.");
  await rateLimitShared(`verify-send:${u.id}`, 3, 3600_000);
  await sendVerification(u.id, u.email);
  return NextResponse.json({ ok: true });
});
