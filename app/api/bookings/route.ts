import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { HttpError, requireUser } from "@/lib/server/auth";
import { body, handle, rateLimit } from "@/lib/server/http";
import { activeSatellites, activeStations } from "@/lib/server/assets";
import { MIN_LEAD_MS, assertStationFree, bookingInclude, bookingView, feeBps, findPassNear } from "@/lib/server/bookings";
import { TX, debit } from "@/lib/server/ledger";
import { notify } from "@/lib/server/notify";

/** Bookings visible to the caller: operator = own, station owner = on own stations, admin = all. */
export const GET = handle(async () => {
  const u = await requireUser();
  const where = u.role === "operator" ? { operatorId: u.id } : u.role === "owner" ? { station: { ownerId: u.id } } : {};
  const list = await db.booking.findMany({ where, include: bookingInclude, orderBy: { aos: "desc" }, take: 200, relationLoadStrategy: "join" });
  return NextResponse.json({ bookings: list.map(b => bookingView(b, u)) });
});

const Create = z.object({ satelliteId: z.string().uuid(), stationId: z.string().uuid(), aos: z.number().int().positive() });

/** Book a pass: re-predict it server-side, check availability, lock the price in escrow — all or nothing. */
export const POST = handle(async (req: Request) => {
  const u = await requireUser(["operator"]);
  rateLimit(`book:${u.id}`, 20, 60_000);
  const b = await body(req, Create);
  const [sats, stations] = await Promise.all([activeSatellites(u.id), activeStations()]);
  const sat = sats.find(s => s.id === b.satelliteId);
  const st = stations.find(s => s.id === b.stationId);
  if (!sat) throw new HttpError(403, "That satellite isn't one of your active satellites");
  if (!st) throw new HttpError(404, "That station isn't available");
  if (!st.bands.includes(sat.band)) throw new HttpError(400, `${st.name} doesn't support ${sat.band} band`);
  const pass = await findPassNear(sat, st, b.aos);
  if (pass.aos < Date.now() + MIN_LEAD_MS) throw new HttpError(409, "Passes must be booked at least 10 minutes before they start");
  const aos = new Date(pass.aos), los = new Date(pass.los), price = new Prisma.Decimal(st.pricePerPass);

  const booking = await db.$transaction(async tx => {
    await assertStationFree(tx, st.id, aos, los);
    const created = await tx.booking.create({ data: { operatorId: u.id, satelliteId: sat.id, stationId: st.id, aos, los, maxElDeg: pass.maxElDeg, price, feeBps: feeBps() } });
    await debit(tx, u.id, price, { type: "escrow_lock", bookingId: created.id, note: `Escrow: ${sat.name} @ ${st.name}` });
    return created;
  }, TX);

  void notify(st.ownerId, "New booking", `${sat.name} booked ${st.name} for ${aos.toISOString().slice(0, 16).replace("T", " ")} UTC.`, "/dashboard/station-owner/bookings");
  const full = await db.booking.findUniqueOrThrow({ where: { id: booking.id }, include: bookingInclude });
  return NextResponse.json({ booking: bookingView(full, u) }, { status: 201 });
});
