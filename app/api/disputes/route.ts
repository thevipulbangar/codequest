import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";

/** Disputes on bookings the caller is party to (admin: all). */
export const GET = handle(async () => {
  const u = await requireUser();
  const where = u.role === "admin" ? {} : { booking: { OR: [{ operatorId: u.id }, { station: { ownerId: u.id } }] } };
  const list = await db.dispute.findMany({
    where, orderBy: { createdAt: "desc" }, take: 200,
    include: { raisedBy: { select: { name: true, company: true, role: true } }, booking: { include: { satellite: { select: { name: true } }, station: { select: { name: true } } } } },
  });
  return NextResponse.json({
    disputes: list.map(d => ({
      id: d.id, status: d.status, reason: d.reason, evidence: d.evidence, resolution: d.resolution,
      refundAmount: d.refundAmount === null ? null : Number(d.refundAmount), createdAt: d.createdAt.getTime(), resolvedAt: d.resolvedAt?.getTime() ?? null,
      raisedBy: `${d.raisedBy.company || d.raisedBy.name} (${d.raisedBy.role === "operator" ? "operator" : "station owner"})`,
      booking: { id: d.booking.id, satellite: d.booking.satellite.name, station: d.booking.station.name, aos: d.booking.aos.getTime(), deliveryBps: d.booking.deliveryBps, stationNet: d.booking.stationNet === null ? null : Number(d.booking.stationNet), price: Number(d.booking.price) },
    })),
  });
});
