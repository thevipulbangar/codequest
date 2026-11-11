import { merkleRoot, sha256 } from "./merkle";
import { newStationKeys, signReceipt } from "./receipt";
import type { Manifest, PassWindow, Receipt, ReceivedFrame } from "./types";

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** SYNTHETIC frame dataset (seeded, repeatable) — not real telemetry. */
export function generateManifest(bookingId: string, n = 100, seed = 42): Manifest {
  const frames = Array.from({ length: n }, (_, i) => ({ id: i + 1, hash: sha256(`synthetic:${seed}:${i + 1}`) }));
  return { bookingId, frames, root: merkleRoot(frames) };
}

/** TEST-ONLY station key, generated once per server process. Never a real key. */
let fixtureKeys: ReturnType<typeof newStationKeys> | undefined;
export const fixtureStationKeys = () => (fixtureKeys ??= newStationKeys());

export const FIXTURE_MISSING = [9, 22, 37, 58, 71, 90];

/** Station receipt for a replay that drops `missingIds` (default: the 6 judge-scenario frames => 94 delivered). */
export function generateReceipt(m: Manifest, stationId: string, win: PassWindow, missingIds = FIXTURE_MISSING, seed = 7): Receipt {
  const r = rng(seed);
  const missing = new Set(missingIds);
  const span = win.end - win.start;
  const frames: ReceivedFrame[] = m.frames.filter(f => !missing.has(f.id)).map(f => {
    const frac = (f.id - 0.5) / m.frames.length;
    return {
      id: f.id, hash: f.hash, receivedAt: Math.round(win.start + frac * span),
      rssiDbm: Math.round((-120 + 28 * Math.sin(Math.PI * frac) + (r() - 0.5) * 3) * 10) / 10,
      dopplerHz: Math.round(win.maxDopplerHz * (1 - 2 * frac) + (r() - 0.5) * win.maxDopplerHz * 0.04),
    };
  });
  const k = fixtureStationKeys();
  return signReceipt({ bookingId: m.bookingId, stationId, manifestRoot: m.root, frames }, k.publicKey, k.privateKey);
}

/**
 * Corrupt one frame's hash. resign=true models a station signing already-corrupted evidence (isolates the
 * per-frame failure); resign=false models post-hoc editing, which breaks the signature and voids the receipt.
 */
export function tamperFrame(r: Receipt, frameId: number, resign = true): Receipt {
  const frames = r.frames.map(f => (f.id === frameId ? { ...f, hash: sha256("tampered" + f.hash) } : f));
  if (!resign) return { ...r, frames };
  const k = fixtureStationKeys();
  return signReceipt({ bookingId: r.bookingId, stationId: r.stationId, manifestRoot: r.manifestRoot, frames }, k.publicKey, k.privateKey);
}
