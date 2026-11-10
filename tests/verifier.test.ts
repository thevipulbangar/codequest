import { describe, expect, it } from "vitest";
import { DEMO_MISSING, demoStationKeys, generateManifest, generateReceipt, tamperFrame } from "../lib/verifier/demo";
import { signReceipt } from "../lib/verifier/receipt";
import { verifyReceipt } from "../lib/verifier/verify";
import { settle, toUnits } from "../lib/verifier/settlement";
import { merkleRoot } from "../lib/verifier/merkle";

const win = { start: 1_000_000, end: 1_000_000 + 600_000, downlinkHz: 437e6, maxDopplerHz: 10_000 };
const m = generateManifest("b1");
const receipt = generateReceipt(m, "st1", win);
const resign = (r: typeof receipt, frames: typeof receipt.frames) => {
  const k = demoStationKeys();
  return signReceipt({ bookingId: r.bookingId, stationId: r.stationId, manifestRoot: r.manifestRoot, frames }, k.publicKey, k.privateKey);
};

describe("verifier", () => {
  it("judge scenario: 94/100 verified, 6 missing", () => {
    const r = verifyReceipt(m, receipt, win);
    expect(r.verified).toBe(94);
    expect(r.missing).toEqual(DEMO_MISSING);
    expect(r.deliveryBps).toBe(9400);
    expect(r.confidence).toBe("high");
  });
  it("tampered hash fails that frame and lowers delivery", () => {
    const r = verifyReceipt(m, tamperFrame(receipt, 10), win);
    expect(r.invalidHashes.map(x => x.id)).toEqual([10]);
    expect(r.verified).toBe(93);
    expect(r.deliveryBps).toBe(9300);
  });
  it("edit without re-signing rejects the whole receipt", () => {
    const r = verifyReceipt(m, tamperFrame(receipt, 10, false), win);
    expect(r.rejected).toMatch(/signature/);
    expect(r.deliveryBps).toBe(0);
  });
  it("detects duplicates and timestamp violations", () => {
    const dup = verifyReceipt(m, resign(receipt, [...receipt.frames, receipt.frames[0]]), win);
    expect(dup.duplicates).toEqual([1]);
    expect(dup.verified).toBe(94);
    const late = verifyReceipt(m, resign(receipt, receipt.frames.map(f => (f.id === 5 ? { ...f, receivedAt: win.end + 1 } : f))), win);
    expect(late.timestampViolations).toEqual([5]);
    expect(late.verified).toBe(93);
  });
  it("flags Doppler anomalies without voiding the frame", () => {
    const r = verifyReceipt(m, resign(receipt, receipt.frames.map(f => (f.id === 5 ? { ...f, dopplerHz: 99_999 } : f))), win);
    expect(r.dopplerAnomalies).toEqual([5]);
    expect(r.verified).toBe(94);
    expect(r.confidence).toBe("medium");
  });
  it("rejects a receipt for a different manifest", () => {
    expect(verifyReceipt(generateManifest("b2", 100, 99), receipt, win).rejected).toMatch(/manifest/);
  });
  it("merkle root changes if any leaf changes", () => {
    const f = [...m.frames];
    f[3] = { ...f[3], hash: "00" };
    expect(merkleRoot(f)).not.toBe(m.root);
  });
});

describe("settlement", () => {
  it("100 tokens, 94/100, 8% fee taken from station share", () => {
    const s = settle(toUnits(100), 100, 94);
    expect(s.stationGross).toBe(toUnits(94));
    expect(s.operatorRefund).toBe(toUnits(6));
    expect(s.platformFee).toBe(toUnits(7.52));
    expect(s.stationNet).toBe(toUnits(86.48));
    expect(s.stationNet + s.platformFee + s.operatorRefund).toBe(toUnits(100));
  });
  it("conserves value on awkward splits and rejects bad input", () => {
    const s = settle(1_000_003n, 7, 3);
    expect(s.stationNet + s.platformFee + s.operatorRefund).toBe(1_000_003n);
    expect(() => settle(1n, 10, 11)).toThrow();
  });
});
