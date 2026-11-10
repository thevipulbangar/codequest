import { degreesToRadians, ecfToLookAngles, eciToEcf, eciToGeodetic, gstime, propagate, radiansToDegrees, twoline2satrec } from "satellite.js";

export interface Site { lat: number; lon: number; altKm?: number }
export interface Pass { aos: number; los: number; maxElDeg: number; maxElAt: number; durationS: number }

export const parseTle = (l1: string, l2: string) => twoline2satrec(l1, l2);
type Rec = ReturnType<typeof parseTle>;

function state(rec: Rec, t: number) {
  const d = new Date(t);
  const pv = propagate(rec, d);
  if (!pv || typeof pv.position === "boolean" || !pv.position) return null;
  return { pv, gmst: gstime(d), d };
}

/** Elevation (deg) of the satellite above a site at time t (ms), or null if propagation fails. */
export function elevationDeg(rec: Rec, site: Site, t: number): number | null {
  const s = state(rec, t);
  if (!s) return null;
  const ecf = eciToEcf(s.pv.position as never, s.gmst);
  const obs = { latitude: degreesToRadians(site.lat), longitude: degreesToRadians(site.lon), height: site.altKm ?? 0 };
  return radiansToDegrees(ecfToLookAngles(obs, ecf).elevation);
}

/** Sub-satellite point + altitude + speed at time t. */
export function subPoint(rec: Rec, t: number) {
  const s = state(rec, t);
  if (!s) return null;
  const g = eciToGeodetic(s.pv.position as never, s.gmst);
  const v = s.pv.velocity as { x: number; y: number; z: number };
  return { lat: radiansToDegrees(g.latitude), lon: radiansToDegrees(g.longitude), altKm: g.height, speedKmS: Math.hypot(v.x, v.y, v.z) };
}

/** Real SGP4 pass search: coarse 20 s scan, then 1 s refinement of AOS/LOS/peak. */
export function predictPasses(rec: Rec, site: Site, from: number, to: number, minElDeg = 0): Pass[] {
  const out: Pass[] = [];
  const el = (t: number) => elevationDeg(rec, site, t) ?? -90;
  const refine = (lo: number, hi: number) => { // lo below horizon, hi above (or reverse) -> crossing time
    const below = el(lo) < 0;
    for (let i = 0; i < 6; i++) { const mid = (lo + hi) / 2; if ((el(mid) < 0) === below) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  };
  const STEP = 20_000;
  let prevT = from, prevEl = el(from), start: number | null = prevEl > 0 ? from : null, maxEl = prevEl, maxAt = from;
  for (let t = from + STEP; t <= to; t += STEP) {
    const e = el(t);
    if (e > 0 && prevEl <= 0) { start = refine(prevT, t); maxEl = e; maxAt = t; }
    if (e > 0 && e > maxEl) { maxEl = e; maxAt = t; }
    if (e <= 0 && prevEl > 0 && start !== null) {
      const los = refine(prevT, t);
      if (maxEl >= minElDeg) out.push({ aos: Math.round(start), los: Math.round(los), maxElDeg: Math.round(maxEl * 10) / 10, maxElAt: maxAt, durationS: Math.round((los - start) / 1000) });
      start = null; maxEl = -90;
    }
    prevT = t; prevEl = e;
  }
  return out;
}

/** Ground track samples [lat, lon] between t0..t1. */
export function groundTrack(rec: Rec, t0: number, t1: number, stepMs = 30_000) {
  const pts: { t: number; lat: number; lon: number; altKm: number }[] = [];
  for (let t = t0; t <= t1; t += stepMs) { const p = subPoint(rec, t); if (p) pts.push({ t, lat: p.lat, lon: p.lon, altKm: p.altKm }); }
  return pts;
}

