import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { HttpError, requireUser } from "@/lib/server/auth";
import { body, handle } from "@/lib/server/http";
import { audit } from "@/lib/server/verification";

const Schema = z.object({
  docId: z.string().max(40),
  status: z.enum(["approved", "rejected", "more_info"]),
  note: z.string().trim().max(500).optional(),
}).refine(b => b.status === "approved" || !!b.note, { message: "A note is required to reject or request more info", path: ["note"] });

export const POST = handle(async (req: Request, { params }: { params: Promise<{ userId: string }> }) => {
  const admin = await requireUser(["admin"]);
  const { userId } = await params;
  const b = await body(req, Schema);
  const v = await db.verification.findUnique({ where: { userId } });
  const s = v && await db.submission.findUnique({ where: { verificationId_docId: { verificationId: v.id, docId: b.docId } } });
  if (!s) throw new HttpError(404, "Submission not found");
  await db.submission.update({ where: { id: s.id }, data: { status: b.status, reviewNote: b.note || null, reviewedAt: new Date() } });
  await audit(admin.id, `review:${b.status}`, `${userId}/${b.docId}`, b.note);
  return NextResponse.json({ ok: true });
});
