import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { body, handle } from "@/lib/server/http";
import { SetupSchema } from "@/lib/server/verification";

export const PUT = handle(async (req: Request) => {
  const u = await requireUser(["operator", "owner"]);
  const setup = await body(req, SetupSchema);
  await db.verification.upsert({ where: { userId: u.id }, create: { userId: u.id, setup }, update: { setup } });
  return NextResponse.json({ ok: true });
});
