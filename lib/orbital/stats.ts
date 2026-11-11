import "server-only";
import { activeSatellites, activeStations } from "../server/assets";
import { predictPasses, subPoint } from "./passes";
import { tleFor } from "./tle";

type Sat = { id: string; name: string; noradId: number; band: string };
type Stn = { id: string; name: string; latitude: number; longitude: number; altitudeM: number; bands: string[]; pricePerPass: unknown };

export interface PredictedPass {
  id: string; satelliteId: string; satellite: string; norad: number; stationId: string; station: string;
  band: string; aos: number; los: number; maxElDeg: number; durationS: number; price: number;
}

/** Real SGP4 predictions for every band-compatible satellite/station pair. Satellites without a current TLE are skipped. */
export async function predictAll(sats: Sat[], stations: Stn[], from: number, to: number, minEl: number) {
  const out: PredictedPass[] = [];
  const unavailable: string[] = [];
  const tles = await Promise.all(sats.map(s => tleFor(s.noradId)));
  sats.forEach((sat, i) => {
    const tle = tles[i];
    if (!tle) { unavailable.push(sat.name); return; }
    for (const st of stations) {
      if (!st.bands.includes(sat.band)) continue;
      for (const p of predictPasses(tle.rec, { lat: st.latitude, lon: st.longitude, altKm: st.altitudeM / 1000 }, from, to, minEl)) {
        out.push({ id: `${sat.id}-${st.id}-${p.aos}`, satelliteId: sat.id, satellite: sat.name, norad: sat.noradId, stationId: st.id, station: st.name, band: sat.band, ...p, price: Number(st.pricePerPass) });
      }
    }
  });
  out.sort((a, b) => a.aos - b.aos);
  return { passes: out, unavailable, tles };
}

export interface NetworkStats {
  generatedAt: number;
  stations: number; satellites: number;
  passes24h: number; contactMin24h: number;
  perStation: { id: string; name: string; passes: number; contactMin: number }[];
  live: { norad: number; name: string; lat: number; lon: number; altKm: number; speedKmS: number }[];
}

let cache: { at: number; v: NetworkStats } | undefined;
let inflight: Promise<NetworkStats> | undefined;
const TTL = 5 * 60_000;

/** Network-wide figures over ACTIVE, verified assets only. Cached 5 min per server instance. */
export function getNetworkStats(): Promise<NetworkStats> {
  if (cache && Date.now() - cache.at < TTL) return Promise.resolve(cache.v);
  return (inflight ??= compute().finally(() => { inflight = undefined; }));
}

async function compute(): Promise<NetworkStats> {
  const from = Date.now();
  const [sats, stations] = await Promise.all([activeSatellites(), activeStations()]);
  const { passes, tles } = await predictAll(sats, stations, from, from + 24 * 3600_000, 0);
  const per = new Map(stations.map(s => [s.id, { id: s.id, name: s.name, passes: 0, contactMin: 0 }]));
  let contact = 0;
  for (const p of passes) { const r = per.get(p.stationId)!; r.contactMin += p.durationS / 60; contact += p.durationS / 60; if (p.maxElDeg >= 10) r.passes++; }
  const live: NetworkStats["live"] = [];
  sats.forEach((s, i) => { const t = tles[i]; const sp = t && subPoint(t.rec, from); if (sp) live.push({ norad: s.noradId, name: s.name, lat: sp.lat, lon: sp.lon, altKm: sp.altKm, speedKmS: sp.speedKmS }); });
  const v: NetworkStats = {
    generatedAt: from, stations: stations.length, satellites: sats.length,
    passes24h: passes.filter(p => p.maxElDeg >= 10).length, contactMin24h: Math.round(contact),
    perStation: [...per.values()].map(r => ({ ...r, contactMin: Math.round(r.contactMin) })), live,
  };
  cache = { at: from, v };
  return v;
}
