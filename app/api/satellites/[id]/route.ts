import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { HttpError, requireUser } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";

export const DELETE = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requireUser(["operator"]);
  const { id } = await params;
  const r = await db.satellite.deleteMany({ where: { id, ownerId: u.id } }); // ownerId scoping = no deleting others' assets
  if (!r.count) throw new HttpError(404, "Not found");
  return NextResponse.json({ ok: true });
});
