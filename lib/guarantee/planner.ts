/**
 * Guaranteed Downlink planner. Pure and deterministic: no I/O, so the server can re-run it on every
 * quote and purchase, and tests can pin its behaviour.
 *
 *  1. Capacity of a pass = data rate × duration × usable fraction (low passes spend more time near the horizon).
 *  2. Primary passes: cheapest per expected MB (price / (capacity × station success rate)) until capacity ≥ target.
 *  3. Backup passes: keep adding the next-cheapest pass until the chance of meeting the target is ≥ CONFIDENCE_GOAL.
 *  4. Guarantee price = pass prices + risk premium; premium = compensation × miss probability × loading.
 *     More reliable stations and longer deadlines raise confidence, so the premium falls.
 */

export interface Candidate {
  id: string; stationId: string; station: string;
  aos: number; los: number; maxElDeg: number; durationS: number;
  price: number;
  /** Station success rate 0..1, from its reliability record (new stations get NEW_STATION_P). */
  p: number;
}
export interface PlannedPass extends Candidate { mb: number; backup: boolean }
export interface Plan {
  passes: PlannedPass[];
  capacityMB: number;        // primary + backup capacity if every pass delivers
  expectedMB: number;        // Σ capacity × p
  confidence: number;        // P(delivered ≥ target), Monte Carlo
  passCost: number;          // Σ price, credits
  premium: number;           // credits
  total: number;             // passCost + premium
}

export const NEW_STATION_P = 0.85;
export const CONFIDENCE_GOAL = 0.95;
export const PREMIUM_LOADING = 1.25;  // reserve margin on top of the expected payout
export const MIN_PREMIUM = 1;         // credits
export const SAT_GAP_MS = 60_000;     // a satellite downlinks to one station at a time (1 min slew/hand-over gap)
const SAMPLES = 4000;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Usable MB in one pass. rateKbps is the satellite's downlink data rate. */
export function passCapacityMB(durationS: number, maxElDeg: number, rateKbps: number) {
  const usable = Math.min(0.9, 0.35 + Math.max(0, maxElDeg) / 100); // 10° → 45 %, ≥ 55° → 90 %
  return (rateKbps * 1000 / 8) * durationS * usable / 1e6;
}

/** Station reliability score (0–100, or null for new) → success probability used for planning. */
export const successRate = (score: number | null | undefined) =>
  score == null ? NEW_STATION_P : Math.min(0.99, Math.max(0.3, score / 100));

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** P(Σ delivered ≥ target), each pass delivering all of its capacity with probability p (seeded, so quotes are repeatable). */
export function confidence(passes: { mb: number; p: number }[], targetMB: number, seed = 7) {
  if (targetMB <= 0) return 1;
  const rnd = mulberry32(seed);
  let ok = 0;
  for (let s = 0; s < SAMPLES; s++) {
    let got = 0;
    for (const x of passes) if (rnd() < x.p) { got += x.mb; if (got >= targetMB) break; }
    if (got >= targetMB) ok++;
  }
  return ok / SAMPLES;
}

export function premiumFor(compensation: number, conf: number) {
  return round2(Math.max(MIN_PREMIUM, compensation * (1 - conf) * PREMIUM_LOADING));
}

/**
 * Pick passes for `targetMB`. Returns null when every candidate together still can't carry the target.
 * `backups: false` plans primaries only (used when re-booking a shortfall mid-contract).
 */
export function plan(candidates: Candidate[], o: { targetMB: number; rateKbps: number; compensation: number; backups?: boolean }): Plan | null {
  const scored = candidates
    .map(c => ({ ...c, mb: passCapacityMB(c.durationS, c.maxElDeg, o.rateKbps), backup: false }))
    .filter(c => c.mb > 0)
    .sort((a, b) => a.price / (a.mb * a.p) - b.price / (b.mb * b.p) || a.aos - b.aos);

  const chosen: PlannedPass[] = [];
  const fits = (c: Candidate) => !chosen.some(x => x.aos < c.los + SAT_GAP_MS && x.los + SAT_GAP_MS > c.aos);
  let cap = 0;
  for (const c of scored) {
    if (cap >= o.targetMB) break;
    if (fits(c)) { chosen.push(c); cap += c.mb; }
  }
  if (cap < o.targetMB) return null;

  let conf = confidence(chosen, o.targetMB);
  if (o.backups !== false) {
    for (const c of scored) {
      if (conf >= CONFIDENCE_GOAL) break;
      if (chosen.includes(c) || !fits(c)) continue;
      chosen.push({ ...c, backup: true });
      conf = confidence(chosen, o.targetMB);
    }
  }
  chosen.sort((a, b) => a.aos - b.aos);
  const passCost = round2(chosen.reduce((s, x) => s + x.price, 0));
  const premium = premiumFor(o.compensation, conf);
  return {
    passes: chosen,
    capacityMB: chosen.reduce((s, x) => s + x.mb, 0),
    expectedMB: chosen.reduce((s, x) => s + x.mb * x.p, 0),
    confidence: conf, passCost, premium, total: round2(passCost + premium),
  };
}

/**
 * Auto re-booking: given the passes still booked (`existing`) and the volume still needed, add the cheapest
 * non-overlapping candidates until the chance of delivering `needMB` is back at CONFIDENCE_GOAL.
 * Returns the passes to add (empty when the booked passes are already enough or nothing more is available).
 */
export function topUp(existing: { aos: number; los: number; mb: number; p: number }[], candidates: Candidate[], needMB: number, rateKbps: number): PlannedPass[] {
  if (needMB <= 0 || confidence(existing, needMB) >= CONFIDENCE_GOAL) return [];
  const scored = candidates
    .map(c => ({ ...c, mb: passCapacityMB(c.durationS, c.maxElDeg, rateKbps), backup: false }))
    .filter(c => c.mb > 0)
    .sort((a, b) => a.price / (a.mb * a.p) - b.price / (b.mb * b.p) || a.aos - b.aos);
  const all: { aos: number; los: number; mb: number; p: number }[] = [...existing];
  const added: PlannedPass[] = [];
  for (const c of scored) {
    if (all.some(x => x.aos < c.los + SAT_GAP_MS && x.los + SAT_GAP_MS > c.aos)) continue;
    all.push(c); added.push(c);
    if (confidence(all, needMB) >= CONFIDENCE_GOAL) break;
  }
  return added;
}

/** Roughly the largest volume the candidates could carry, taking passes in time order (for "not feasible" messages). */
export function maxFeasibleMB(candidates: Candidate[], rateKbps: number) {
  const chosen: Candidate[] = [];
  let cap = 0;
  for (const c of [...candidates].sort((a, b) => a.aos - b.aos)) {
    if (chosen.some(x => x.aos < c.los + SAT_GAP_MS && x.los + SAT_GAP_MS > c.aos)) continue;
    chosen.push(c); cap += passCapacityMB(c.durationS, c.maxElDeg, rateKbps);
  }
  return cap;
}

export type ContractHealth = "fulfilled" | "on_track" | "at_risk" | "missed" | "cancelled";

/** Progress of a contract from its bookings. Verified MB = planned MB × verified delivery of each settled pass. */
export function progress(targetMB: number, deadline: number, status: string, bookings: { status: string; plannedMB: number | null; deliveryBps: number | null; p: number }[], now = Date.now()) {
  let verifiedMB = 0, pendingMB = 0, expectedMB = 0, passesLeft = 0;
  for (const b of bookings) {
    const mb = b.plannedMB ?? 0;
    if (b.status === "settled") verifiedMB += mb * (b.deliveryBps ?? 0) / 10000;
    else if (b.status === "confirmed" || b.status === "manifest_committed") { pendingMB += mb; expectedMB += mb * b.p; passesLeft++; }
  }
  const health: ContractHealth =
    status === "fulfilled" || status === "missed" || status === "cancelled" ? status
    : verifiedMB >= targetMB ? "fulfilled"
    : verifiedMB + expectedMB >= targetMB && now < deadline + 24 * 3600_000 ? "on_track" : "at_risk";
  return { verifiedMB, pendingMB, expectedMB: verifiedMB + expectedMB, passesLeft, health, pct: Math.min(100, (verifiedMB / targetMB) * 100) };
}
