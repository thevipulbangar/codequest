import { NextResponse } from "next/server";
import { HttpError, requireUser } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import { CANCEL_CUTOFF_MS, refundFull } from "@/lib/server/bookings";
import { loadBooking } from "@/lib/server/booking-access";
import { notify } from "@/lib/server/notify";

/** Operator: up to 1 h before AOS. Station owner: any time before AOS. Always a full refund to the operator. */
export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requireUser(["operator", "owner"]);
  const b = await loadBooking((await params).id, u);
  const now = Date.now(), byOperator = b.operatorId === u.id, byStation = b.station.ownerId === u.id;
  if (byOperator && now > b.aos.getTime() - CANCEL_CUTOFF_MS) throw new HttpError(409, "Operators can cancel up to 1 hour before the pass");
  if (byStation && now >= b.aos.getTime()) throw new HttpError(409, "The pass has already started");
  if (!byOperator && !byStation) throw new HttpError(404, "Not found");
  await refundFull(b, "cancelled", byOperator ? "Cancelled by operator" : "Cancelled by station");
  if (byStation) void notify(b.operatorId, "Booking cancelled by station", `${b.station.name} cancelled the ${b.satellite.name} pass. Your ${b.price.toFixed(2)} credits were refunded.`, "/dashboard/operator/bookings");
  else void notify(b.station.ownerId, "Booking cancelled", `The ${b.satellite.name} pass on ${b.station.name} was cancelled by the operator.`, "/dashboard/station-owner/bookings");
  return NextResponse.json({ ok: true });
});
