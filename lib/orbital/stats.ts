import { SATELLITES, STATIONS } from "./catalog";
import { predictPasses, subPoint } from "./passes";
import { tleFor } from "./tle";

export interface NetworkStats {
  generatedAt: number;
  source: "celestrak" | "sample";
  satellites: number; stations: number; pairs: number;
  passes24h: number;               // passes >= 10 deg elevation, next 24 h, compatible sat/station pairs
  contactMin24h: number;           // total predicted contact minutes (any elevation > 0), next 24 h
  avgContactMinPerPair: number;    // per compatible satellite-station pair per day
  contactPct: number;              // avg % of the day a satellite is in contact with a station
  nextPass: { satellite: string; station: string; aos: number; maxElDeg: number } | null;
  perStation: { id: string; name: string; passes: number; contactMin: number }[];
  live: { norad: number; name: string; lat: number; lon: number; altKm: number; speedKmS: number }[];
}

let cache: { at: number; v: NetworkStats } | undefined;
const TTL = 5 * 60_000;

/** Everything here is computed from public TLEs with SGP4 — no fabricated figures. Cached for 5 min. */
let inflight: Promise<NetworkStats> | undefined;
export function getNetworkStats(): Promise<NetworkStats> {
  if (cache && Date.now() - cache.at < TTL) return Promise.resolve(cache.v);
  return (inflight ??= compute().finally(() => { inflight = undefined; }));
}

async function compute(): Promise<NetworkStats> {
  const from = Date.now(), to = from + 24 * 3600_000;
  let source: "celestrak" | "sample" = "celestrak";
  const per = new Map(STATIONS.map(s => [s.id, { id: s.id, name: s.name, passes: 0, contactMin: 0 }]));
  let passes24h = 0, contact = 0, pairs = 0;
  let next: NetworkStats["nextPass"] = null;
  const live: NetworkStats["live"] = [];

  const tles = await Promise.all(SATELLITES.map(s => tleFor(s.norad)));
  SATELLITES.forEach((sat, i) => {
    const tle = tles[i];
    if (tle.source === "sample") source = "sample";
    const p = subPoint(tle.rec, from);
    if (p) live.push({ norad: sat.norad, name: sat.name, lat: p.lat, lon: p.lon, altKm: p.altKm, speedKmS: p.speedKmS });
    for (const st of STATIONS) {
      if (!(st.bands as readonly string[]).includes(sat.band)) continue;
      pairs++;
      for (const ps of predictPasses(tle.rec, st, from, to, 0)) {
        const row = per.get(st.id)!;
        row.contactMin += ps.durationS / 60; contact += ps.durationS / 60;
        if (ps.maxElDeg >= 10) {
          row.passes++; passes24h++;
          if (ps.aos > from && (!next || ps.aos < next.aos)) next = { satellite: sat.name, station: st.name, aos: ps.aos, maxElDeg: ps.maxElDeg };
        }
      }
    }
  });

  const avg = pairs ? contact / pairs : 0;
  const v: NetworkStats = {
    generatedAt: from, source, satellites: SATELLITES.length, stations: STATIONS.length, pairs,
    passes24h, contactMin24h: Math.round(contact), avgContactMinPerPair: Math.round(avg * 10) / 10,
    contactPct: Math.round((avg / 1440) * 1000) / 10, nextPass: next,
    perStation: [...per.values()].map(r => ({ ...r, contactMin: Math.round(r.contactMin) })),
    live,
  };
  // Only cache real results; a sample-TLE fallback should be retried soon.
  if (source === "celestrak") cache = { at: from, v };
  return v;
}
