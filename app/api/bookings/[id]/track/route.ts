import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import { loadBooking } from "@/lib/server/booking-access";
import { tleFor } from "@/lib/orbital/tle";

/** Current public TLE + station site for the live pass view (computed client-side with SGP4). */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requireUser();
  const b = await loadBooking((await params).id, u);
  const tle = await tleFor(b.satellite.noradId);
  return NextResponse.json({
    tle: tle ? { l1: tle.l1, l2: tle.l2 } : null,
    station: { name: b.station.name, lat: b.station.latitude, lon: b.station.longitude, altKm: b.station.altitudeM / 1000 },
  });
});
