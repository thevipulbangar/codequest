import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { HttpError, requireUser } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";

export const DELETE = handle(async (_req: Request, { params }: { params: Promise<{ docId: string }> }) => {
  const u = await requireUser(["operator", "owner"]);
  const { docId } = await params;
  const v = await db.verification.findUnique({ where: { userId: u.id } });
  const s = v && await db.submission.findUnique({ where: { verificationId_docId: { verificationId: v.id, docId } } });
  if (!s) throw new HttpError(404, "Not found");
  if (s.status === "approved") throw new HttpError(409, "Approved documents can't be removed");
  await db.submission.delete({ where: { id: s.id } });
  return NextResponse.json({ ok: true });
});
