import { NextResponse } from "next/server";
import { connection } from "next/server";
import { HttpError } from "@/lib/server/auth";
import { handle, rateLimit, clientIp } from "@/lib/server/http";
import { db } from "@/lib/server/db";

/** Public certificate for a closed guaranteed-downlink contract: target, verified volume and every pass used. */
export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await connection();
  rateLimit(`proof:${clientIp(req)}`, 60, 60_000);
  const c = await db.dataContract.findUnique({ where: { id: (await params).id }, include: { satellite: true, operator: { select: { name: true, company: true } }, bookings: { include: { station: { select: { name: true, country: true } } }, orderBy: { aos: "asc" } } } });
  if (!c || c.status === "active") throw new HttpError(404, "No certificate exists for this link yet");
  return NextResponse.json({ certificate: {
    id: c.id, status: c.status, operator: c.operator.company || c.operator.name,
    satellite: { name: c.satellite.name, noradId: c.satellite.noradId, band: c.satellite.band },
    targetMB: c.targetMB, verifiedMB: c.verifiedMB, deadline: +c.deadline, closedAt: c.closedAt ? +c.closedAt : null, createdAt: +c.createdAt,
    compensation: c.status === "missed" ? Number(c.compensation) : 0,
    passes: c.bookings.map(b => ({ id: b.id, station: b.station.name, country: b.station.country, aos: +b.aos, status: b.status, backup: b.backup, plannedMB: b.plannedMB ?? 0, deliveryBps: b.deliveryBps, verifiedMB: b.status === "settled" ? (b.plannedMB ?? 0) * (b.deliveryBps ?? 0) / 10000 : 0, proof: b.status === "settled" })),
  } });
});
