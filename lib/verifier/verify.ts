import { merkleRoot } from "./merkle";
import { receiptSignatureValid } from "./receipt";
import type { Manifest, PassWindow, Receipt, VerificationReport } from "./types";

/** Modelled Doppler: +max at AOS sweeping linearly to -max at LOS (flat-pass approximation). */
export const expectedDoppler = (t: number, w: PassWindow) =>
  w.maxDopplerHz * (1 - 2 * Math.min(1, Math.max(0, (t - w.start) / (w.end - w.start))));
const dopplerTol = (w: PassWindow) => w.maxDopplerHz * 0.15;

/** Deterministic: same inputs -> same report. No LLM, no I/O. */
export function verifyReceipt(manifest: Manifest, receipt: Receipt, win: PassWindow): VerificationReport {
  const promised = manifest.frames.length;
  const rep: VerificationReport = {
    promised, received: receipt.frames.length, verified: 0, missing: [], duplicates: [], invalidHashes: [],
    timestampViolations: [], unknownFrames: [], dopplerAnomalies: [],
    signatureValid: receiptSignatureValid(receipt),
    manifestRootMatches: receipt.manifestRoot === manifest.root && merkleRoot(manifest.frames) === manifest.root,
    receivedRoot: merkleRoot([]), deliveryBps: 0, confidence: "low",
  };
  const allMissing = manifest.frames.map(f => f.id);
  // Hard rejects: an unsigned or foreign receipt earns the station nothing.
  if (!rep.signatureValid) return { ...rep, missing: allMissing, rejected: "Invalid station signature" };
  if (!rep.manifestRootMatches) return { ...rep, missing: allMissing, rejected: "Receipt does not match the committed manifest root" };

  const want = new Map(manifest.frames.map(f => [f.id, f.hash]));
  const seen = new Set<number>();
  const good = new Set<number>();
  for (const r of receipt.frames) {
    if (!want.has(r.id)) { rep.unknownFrames.push(r.id); continue; }
    if (seen.has(r.id)) { rep.duplicates.push(r.id); continue; }
    seen.add(r.id);
    if (want.get(r.id) !== r.hash) { rep.invalidHashes.push({ id: r.id, expected: want.get(r.id)!, got: r.hash }); continue; }
    if (r.receivedAt < win.start || r.receivedAt > win.end) { rep.timestampViolations.push(r.id); continue; }
    // Doppler anomalies are flagged and lower confidence, but don't void the frame.
    if (Math.abs(r.dopplerHz - expectedDoppler(r.receivedAt, win)) > dopplerTol(win)) rep.dopplerAnomalies.push(r.id);
    good.add(r.id);
  }
  rep.missing = manifest.frames.filter(f => !seen.has(f.id)).map(f => f.id);
  const verified = manifest.frames.filter(f => good.has(f.id));
  rep.verified = verified.length;
  rep.receivedRoot = merkleRoot(verified);
  rep.deliveryBps = promised ? Math.floor((verified.length * 10000) / promised) : 0;
  const bad = rep.invalidHashes.length + rep.timestampViolations.length + rep.dopplerAnomalies.length + rep.unknownFrames.length + rep.duplicates.length;
  rep.confidence = bad === 0 ? "high" : bad / Math.max(1, rep.received) < 0.1 ? "medium" : "low";
  return rep;
}
