import { NextResponse } from "next/server";
import { connection } from "next/server";
import { z } from "zod";
import { handle, rateLimit, clientIp } from "@/lib/server/http";
import { activeSatellites } from "@/lib/server/assets";
import { feeBps } from "@/lib/server/bookings";
import { predictPasses } from "@/lib/orbital/passes";
import { tleFor } from "@/lib/orbital/tle";

/**
 * Reference satellites that downlink to public ground stations in each band (well-known weather and
 * Earth-observation missions plus the ISS). Used to size the market before OrbitPass has demand there.
 */
const REFERENCE: { norad: number; name: string; bands: string[] }[] = [
  { norad: 25544, name: "ISS", bands: ["VHF", "UHF"] },
  { norad: 25338, name: "NOAA 15", bands: ["VHF", "L"] },
  { norad: 28654, name: "NOAA 18", bands: ["VHF", "L"] },
  { norad: 33591, name: "NOAA 19", bands: ["VHF", "L"] },
  { norad: 38771, name: "Metop-B", bands: ["L"] },
  { norad: 43689, name: "Metop-C", bands: ["L"] },
  { norad: 25994, name: "Terra", bands: ["X"] },
  { norad: 27424, name: "Aqua", bands: ["X"] },
  { norad: 37849, name: "Suomi NPP", bands: ["X"] },
  { norad: 43013, name: "NOAA 20", bands: ["X"] },
  { norad: 39084, name: "Landsat 8", bands: ["X"] },
  { norad: 49260, name: "Landsat 9", bands: ["X"] },
];
const WINDOW_H = 72; // predicted window, scaled to a week

const Q = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  altM: z.coerce.number().min(-500).max(9000).default(0),
  bands: z.string().max(40).transform(s => s.split(",").filter(Boolean)),
  price: z.coerce.number().min(0).max(100000).default(50),
  minEl: z.coerce.number().min(0).max(80).default(10),
});

/** Public earnings estimate for a prospective station, from real SGP4 predictions. No sign-up needed. */
export const GET = handle(async (req: Request) => {
  await connection();
  rateLimit(`estimate:${clientIp(req)}`, 12, 60_000);
  const q = Q.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success || !q.data.bands.length) return NextResponse.json({ error: "Enter a location and at least one band" }, { status: 400 });
  const { lat, lon, altM, bands, price, minEl } = q.data;

  const network = (await activeSatellites()).filter(s => bands.includes(s.band)).map(s => ({ norad: s.noradId, name: s.name, bands: [s.band], source: "orbitpass" as const }));
  const refs = REFERENCE.filter(r => r.bands.some(b => bands.includes(b)) && !network.some(n => n.norad === r.norad)).map(r => ({ ...r, source: "reference" as const }));
  const sats = [...network, ...refs].slice(0, 16);
  const tles = await Promise.all(sats.map(s => tleFor(s.norad)));
  const from = Date.now(), to = from + WINDOW_H * 3600_000, scale = 168 / WINDOW_H;
  const site = { lat, lon, altKm: altM / 1000 };

  const perSat = sats.map((s, i) => {
    const t = tles[i];
    if (!t) return { name: s.name, norad: s.norad, source: s.source, bands: s.bands.filter(b => bands.includes(b)), passesPerWeek: null as number | null, avgMinutes: null as number | null };
    const ps = predictPasses(t.rec, site, from, to, minEl);
    const mins = ps.reduce((a, p) => a + p.durationS / 60, 0);
    return { name: s.name, norad: s.norad, source: s.source, bands: s.bands.filter(b => bands.includes(b)), passesPerWeek: Math.round(ps.length * scale), avgMinutes: ps.length ? Math.round((mins / ps.length) * 10) / 10 : 0 };
  });
  const weekly = (src?: "orbitpass" | "reference") => perSat.filter(s => !src || s.source === src).reduce((a, s) => a + (s.passesPerWeek ?? 0), 0);
  const net = price * (1 - feeBps() / 10000);
  const scenarios = [0.1, 0.25, 0.5].map(share => ({ share, passesPerWeek: Math.round(weekly() * share), creditsPerWeek: Math.round(weekly() * share * net * 100) / 100, creditsPerMonth: Math.round(weekly() * share * net * 4.345 * 100) / 100 }));
  return NextResponse.json({ estimate: {
    site: { lat, lon, altM }, bands, price, minEl, feeBps: feeBps(),
    passesPerWeek: weekly(), demandPassesPerWeek: weekly("orbitpass"), perSat, scenarios,
    window: `${WINDOW_H} h of SGP4 predictions on CelesTrak elements, scaled to 7 days`,
  } });
});
