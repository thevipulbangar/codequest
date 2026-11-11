import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { body, handle, rateLimit } from "@/lib/server/http";
import { activeSatellites, activeStations } from "@/lib/server/assets";
import { predictAll } from "@/lib/orbital/stats";
import { parsePassQuery } from "@/lib/nl-search";

/**
 * Natural-language pass search, e.g. "next pass over India above 30 degrees for X-band before 18:00 UTC".
 * Text → filters is deterministic (lib/nl-search.ts); passes are real SGP4 predictions; prices come from the DB.
 */
export const POST = handle(async (req: Request) => {
  const u = await requireUser(["operator"]);
  rateLimit(`nlsearch:${u.id}`, 30, 60_000);
  const { query } = await body(req, z.object({ query: z.string().trim().min(3).max(300) }));
  const p = parsePassQuery(query);
  const now = Date.now();
  const [sats, stations] = await Promise.all([activeSatellites(u.id), activeStations()]);
  const place = p.place?.toLowerCase();
  const st = stations.filter(s => !place || s.country.toLowerCase().includes(place) || s.name.toLowerCase().includes(place));
  const s = sats.filter(x => !p.band || x.band === p.band);
  const { passes } = await predictAll(s, st, now, now + (p.hours ?? 24) * 3600_000, p.minEl ?? 10);
  const result = passes.filter(x => (!p.before || x.aos < p.before) && (!p.after || x.aos >= p.after) && (p.maxPrice === undefined || x.price <= p.maxPrice));
  return NextResponse.json({
    filters: p,
    passes: result.slice(0, 50),
    note: place && !st.length ? `No active stations match “${p.place}”.` : !s.length ? "None of your active satellites match these filters." : undefined,
  });
});
