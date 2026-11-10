import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { HttpError, requireUser } from "@/lib/server/auth";
import { body, handle } from "@/lib/server/http";
import { audit, kindFor, loadVerification, toState } from "@/lib/server/verification";
import { badgeStates } from "@/lib/verification/requirements";

const Schema = z.object({ status: z.enum(["approved", "rejected", "more_info"]), note: z.string().trim().max(1000) })
  .refine(b => b.status === "approved" || b.note.length > 0, { message: "Add a note for the applicant", path: ["note"] });

export const POST = handle(async (req: Request, { params }: { params: Promise<{ userId: string }> }) => {
  const admin = await requireUser(["admin"]);
  const { userId } = await params;
  const b = await body(req, Schema);
  const user = await db.user.findUnique({ where: { id: userId } });
  const v = user && await loadVerification(userId);
  if (!user || !v) throw new HttpError(404, "Applicant not found");
  // Never trust the UI's disabled button: approval requires all three badges, recomputed here.
  if (b.status === "approved") {
    const st = toState(user, v);
    if (badgeStates(kindFor(user.role), st.setup, st.subs).some(x => !x.earned)) throw new HttpError(409, "All three badges must be earned before approval");
  }
  await db.verification.update({ where: { id: v.id }, data: { decision: b.status, decisionNote: b.note || "Approved.", decidedAt: new Date() } });
  await audit(admin.id, `decide:${b.status}`, userId, b.note);
  return NextResponse.json({ ok: true });
});
