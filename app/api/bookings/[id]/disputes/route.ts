import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { HttpError, requireUser } from "@/lib/server/auth";
import { body, handle } from "@/lib/server/http";
import { DISPUTE_WINDOW_MS } from "@/lib/server/bookings";
import { loadBooking } from "@/lib/server/booking-access";
import { notify } from "@/lib/server/notify";

const Schema = z.object({ reason: z.string().trim().min(20, "Describe the problem (at least 20 characters)").max(2000), evidence: z.string().trim().max(5000).optional() });

/** Either party may dispute a settlement within 24 h. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requireUser(["operator", "owner"]);
  const b = await loadBooking((await params).id, u);
  if (b.operatorId !== u.id && b.station.ownerId !== u.id) throw new HttpError(404, "Not found");
  if (b.status !== "settled" || !b.settledAt) throw new HttpError(409, "Only settled bookings can be disputed");
  if (Date.now() - b.settledAt.getTime() > DISPUTE_WINDOW_MS) throw new HttpError(409, "The 24-hour dispute window has closed");
  const d = await body(req, Schema);
  if (await db.dispute.findFirst({ where: { bookingId: b.id, status: "open" } })) throw new HttpError(409, "There is already an open dispute for this booking");
  const dispute = await db.dispute.create({ data: { bookingId: b.id, raisedById: u.id, reason: d.reason, evidence: d.evidence } });
  const other = b.operatorId === u.id ? b.station.ownerId : b.operatorId;
  void notify(other, "Dispute opened", `A dispute was opened on the ${b.satellite.name} pass at ${b.station.name}. An admin will review it.`, "/dashboard/disputes");
  return NextResponse.json({ dispute: { id: dispute.id } }, { status: 201 });
});
