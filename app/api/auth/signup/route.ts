import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { HttpError, publicUser, startSession } from "@/lib/server/auth";
import { body, clientIp, handle, rateLimit } from "@/lib/server/http";
import { hashPassword } from "@/lib/server/password";

const Schema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.email().max(254).transform(e => e.toLowerCase()),
  password: z.string().min(8).max(72),
  role: z.enum(["operator", "owner"]), // admin accounts are created with scripts/create-admin.mts only
});

export const POST = handle(async (req: Request) => {
  rateLimit(`signup:${clientIp(req)}`, 5, 3600_000);
  const b = await body(req, Schema);
  if (await db.user.findUnique({ where: { email: b.email } })) throw new HttpError(409, "An account with this email already exists");
  const user = await db.user.create({ data: { name: b.name, email: b.email, role: b.role, passwordHash: await hashPassword(b.password) } });
  await startSession(user.id);
  return NextResponse.json({ user: publicUser(user) }, { status: 201 });
});
