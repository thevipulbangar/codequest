import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { HttpError, publicUser, startSession } from "@/lib/server/auth";
import { body, clientIp, handle, rateLimit } from "@/lib/server/http";
import { verifyPassword } from "@/lib/server/password";

const Schema = z.object({
  email: z.string().max(254).transform(e => e.trim().toLowerCase()),
  password: z.string().max(200),
  role: z.enum(["operator", "owner", "admin"]).optional(), // which sign-in tab was used
});
const LABEL = { operator: "satellite operator", owner: "station owner", admin: "admin" } as const;
// Spend the same scrypt time for unknown emails so response timing doesn't reveal which accounts exist.
const DUMMY = "scrypt$16384$00000000000000000000000000000000$" + "0".repeat(128);

export const POST = handle(async (req: Request) => {
  const b = await body(req, Schema);
  rateLimit(`login:${clientIp(req)}:${b.email}`, 10, 15 * 60_000);
  const user = await db.user.findUnique({ where: { email: b.email } });
  const ok = await verifyPassword(b.password, user?.passwordHash ?? DUMMY);
  if (!user || !ok) throw new HttpError(401, "Invalid email or password");
  // Checked only after the password matches, so it can't be used to probe which emails exist.
  if (b.role && b.role !== user.role) throw new HttpError(403, `This is a ${LABEL[user.role]} account — use the ${LABEL[user.role]} sign-in.`);
  await startSession(user);
  return NextResponse.json({ user: publicUser(user) });
});
