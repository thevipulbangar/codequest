import { NextResponse } from "next/server";
import { z } from "zod";
import { SATELLITES, STATIONS } from "@/lib/orbital/catalog";
import { tleFor } from "@/lib/orbital/tle";
import { predictPasses } from "@/lib/orbital/passes";

const Q = z.object({
  norad: z.coerce.number().int().optional(),
  station: z.string().max(40).optional(),
  minEl: z.coerce.number().min(0).max(90).default(10),
  hours: z.coerce.number().min(1).max(72).default(24),
  band: z.string().max(4).optional(),
});

export async function GET(req: Request) {
  const q = Q.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success) return NextResponse.json({ error: q.error.flatten() }, { status: 400 });
  const { norad, station, minEl, hours, band } = q.data;
  const sats = SATELLITES.filter(s => !norad || s.norad === norad);
  const stations = STATIONS.filter(s => !station || s.id === station);
  const from = Date.now(), to = from + hours * 3600_000;
  const passes = [];
  let source: "celestrak" | "sample" = "celestrak";
  for (const sat of sats) {
    const tle = await tleFor(sat.norad);
    if (tle.source === "sample") source = "sample";
    for (const st of stations) {
      if (!(st.bands as readonly string[]).includes(sat.band) || (band && sat.band !== band)) continue;
      for (const p of predictPasses(tle.rec, st, from, to, minEl)) {
        const est = Math.round((p.durationS / 600) * 100); // synthetic: ~100 frames per 10-min pass
        passes.push({ id: `${sat.norad}-${st.id}-${p.aos}`, satellite: sat.name, norad: sat.norad, stationId: st.id, station: st.name,
          band: sat.band, ...p, estFrames: est, price: st.pricePerPass, reliability: st.reliability });
      }
    }
  }
  passes.sort((a, b) => a.aos - b.aos);
  return NextResponse.json({
    passes, count: passes.length,
    dataSource: source === "celestrak" ? "Live CelesTrak TLE + SGP4 (real prediction)" : "DEMO: stale sample TLE - CelesTrak unreachable",
    note: "Prices, reliability and frame volumes are sample marketplace data.",
  });
}

