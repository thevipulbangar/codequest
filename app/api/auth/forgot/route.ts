import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { body, clientIp, handle } from "@/lib/server/http";
import { appUrl, emailEnabled, sendEmail } from "@/lib/server/email";
import { rateLimitShared } from "@/lib/server/ratelimit";
import { issueToken } from "@/lib/server/tokens";

/** Always answers the same way, so it can't be used to discover which emails have accounts. */
export const POST = handle(async (req: Request) => {
  const { email } = await body(req, z.object({ email: z.string().trim().toLowerCase().max(254) }));
  await rateLimitShared(`forgot:${clientIp(req)}`, 5, 3600_000);
  if (!emailEnabled()) return NextResponse.json({ ok: false, error: "Password reset by email isn't available yet. Contact support." }, { status: 503 });
  const user = await db.user.findUnique({ where: { email } });
  if (user) {
    const token = await issueToken(user.id, "reset", 60 * 60_000);
    await sendEmail(user.email, "Reset your OrbitPass password",
      `Someone (hopefully you) asked to reset your OrbitPass password.\n\nReset it here (valid for 1 hour):\n${appUrl()}/reset?token=${token}\n\nIf you didn't ask for this, ignore this email.`);
  }
  return NextResponse.json({ ok: true });
});
