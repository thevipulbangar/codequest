import { NextResponse } from "next/server";
import { HttpError, requireUser } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import { RECEIPT_DEADLINE_MS, expireBooking } from "@/lib/server/bookings";
import { loadBooking } from "@/lib/server/booking-access";

/** No settlement within 24 h after LOS → the operator (or an admin) can reclaim the full escrow. */
export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requireUser(["operator", "admin"]);
  const b = await loadBooking((await params).id, u);
  if (u.role === "operator" && b.operatorId !== u.id) throw new HttpError(404, "Not found");
  if (Date.now() <= b.los.getTime() + RECEIPT_DEADLINE_MS) throw new HttpError(409, "The station still has time to submit its receipt (24 h after the pass)");
  await expireBooking(b);
  return NextResponse.json({ ok: true });
});
