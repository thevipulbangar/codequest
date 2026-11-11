import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import { loadBooking } from "@/lib/server/booking-access";
import { tleFor } from "@/lib/orbital/tle";
import { lookAngles } from "@/lib/orbital/passes";

const STEP = 5000, PAD = 2 * 60_000;

/**
 * Sky track for the live pass view, computed server-side with SGP4 from the current public orbit:
 * azimuth / elevation / range every 5 s from 2 min before AOS to 2 min after LOS.
 * (Keeps the orbit library out of the browser bundle.)
 */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requireUser();
  const b = await loadBooking((await params).id, u);
  const tle = await tleFor(b.satellite.noradId);
  const site = { lat: b.station.latitude, lon: b.station.longitude, altKm: b.station.altitudeM / 1000 };
  const points: { t: number; az: number; el: number; rangeKm: number }[] = [];
  if (tle) {
    for (let t = b.aos.getTime() - PAD; t <= b.los.getTime() + PAD; t += STEP) {
      const l = lookAngles(tle.rec, site, t);
      if (l) points.push({ t, az: Math.round(l.az * 10) / 10, el: Math.round(l.el * 10) / 10, rangeKm: Math.round(l.rangeKm) });
    }
  }
  return NextResponse.json({ available: !!tle, step: STEP, station: { name: b.station.name }, points });
});
