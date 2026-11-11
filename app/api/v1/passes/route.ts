import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { handle, rateLimit } from "@/lib/server/http";
import { activeSatellites, activeStations } from "@/lib/server/assets";
import { predictAll } from "@/lib/orbital/stats";

const Q = z.object({
  satelliteId: z.string().uuid().optional(),
  stationId: z.string().uuid().optional(),
  minEl: z.coerce.number().min(0).max(90).default(10),
  hours: z.coerce.number().min(1).max(72).default(24),
  band: z.string().max(4).optional(),
});

/** Passes for the signed-in operator's ACTIVE satellites over ACTIVE stations (real SGP4 on CelesTrak TLEs). */
export const GET = handle(async (req: Request) => {
  const u = await requireUser(["operator"]);
  rateLimit(`passes:${u.id}`, 60, 60_000);
  const q = Q.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success) return NextResponse.json({ error: "Invalid filters" }, { status: 400 });
  const { satelliteId, stationId, minEl, hours, band } = q.data;
  const [sats, stations] = await Promise.all([activeSatellites(u.id), activeStations()]);
  const s = sats.filter(x => (!satelliteId || x.id === satelliteId) && (!band || x.band === band));
  const st = stations.filter(x => !stationId || x.id === stationId);
  const from = Date.now();
  const { passes, unavailable } = await predictAll(s, st, from, from + hours * 3600_000, minEl);
  return NextResponse.json({ passes, count: passes.length, activeSatellites: sats.length, activeStations: stations.length, tleUnavailable: unavailable });
});
