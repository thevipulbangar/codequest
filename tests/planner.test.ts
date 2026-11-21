import { describe, expect, it } from "vitest";
import { type Candidate, CONFIDENCE_GOAL, confidence, passCapacityMB, plan, premiumFor, progress, successRate, topUp } from "../lib/guarantee/planner";

const H = 3600_000;
// 600 s passes at 50°: 1000 kbps → 125 kB/s × 600 s × 85 % ≈ 63.75 MB each
const pass = (i: number, o: Partial<Candidate> = {}): Candidate => ({
  id: `p${i}`, stationId: `s${i % 3}`, station: `S${i % 3}`, aos: i * H, los: i * H + 600_000, maxElDeg: 50, durationS: 600, price: 100, p: 0.9, ...o,
});
const many = (n: number, o?: Partial<Candidate>) => Array.from({ length: n }, (_, i) => pass(i, o));

describe("guarantee planner", () => {
  it("capacity grows with elevation and caps at 90 % usable", () => {
    expect(passCapacityMB(600, 50, 1000)).toBeCloseTo(63.75, 2);
    expect(passCapacityMB(600, 80, 1000)).toBeCloseTo(67.5, 2);
    expect(passCapacityMB(600, 10, 1000)).toBeLessThan(passCapacityMB(600, 40, 1000));
  });

  it("covers the target with primaries, then adds backups until 95 % confidence", () => {
    const p = plan(many(20), { targetMB: 200, rateKbps: 1000, compensation: 500 })!;
    const prim = p.passes.filter(x => !x.backup), back = p.passes.filter(x => x.backup);
    expect(prim.reduce((s, x) => s + x.mb, 0)).toBeGreaterThanOrEqual(200);
    expect(prim.length).toBe(4);
    expect(back.length).toBeGreaterThan(0);
    expect(p.confidence).toBeGreaterThanOrEqual(CONFIDENCE_GOAL);
    expect(p.total).toBeCloseTo(p.passCost + p.premium, 2);
  });

  it("prefers cheaper, more reliable stations", () => {
    const c = [pass(1, { price: 300, p: 0.9 }), pass(2, { price: 100, p: 0.9 }), pass(3, { price: 100, p: 0.5 })];
    expect(plan(c, { targetMB: 50, rateKbps: 1000, compensation: 0, backups: false })!.passes[0].id).toBe("p2");
  });

  it("never schedules overlapping passes for the same satellite", () => {
    const c = [pass(1), pass(1, { id: "dup", stationId: "other", price: 50 })];
    const p = plan(c, { targetMB: 120, rateKbps: 1000, compensation: 0 });
    expect(p).toBeNull(); // only one of the two simultaneous passes can be used: 63.75 MB < 120 MB
  });

  it("returns null when the target can't be carried", () => {
    expect(plan(many(2), { targetMB: 1000, rateKbps: 1000, compensation: 0 })).toBeNull();
  });

  it("premium falls as reliability and deadline length rise", () => {
    const short = plan(many(6, { p: 0.7 }), { targetMB: 200, rateKbps: 1000, compensation: 500 })!;
    const long = plan(many(30, { p: 0.7 }), { targetMB: 200, rateKbps: 1000, compensation: 500 })!;
    const reliable = plan(many(6, { p: 0.98 }), { targetMB: 200, rateKbps: 1000, compensation: 500 })!;
    expect(long.premium).toBeLessThan(short.premium);
    expect(reliable.premium).toBeLessThan(short.premium);
    expect(premiumFor(500, 1)).toBe(1); // minimum premium
  });

  it("confidence is deterministic and bounded", () => {
    const x = [{ mb: 60, p: 0.9 }, { mb: 60, p: 0.9 }];
    expect(confidence(x, 100)).toBe(confidence(x, 100));
    expect(confidence(x, 100)).toBeGreaterThan(0.75);
    expect(confidence(x, 100)).toBeLessThan(0.86);
    expect(confidence([], 0)).toBe(1);
  });

  it("maps reliability scores to success rates", () => {
    expect(successRate(null)).toBe(0.85);
    expect(successRate(97)).toBe(0.97);
    expect(successRate(10)).toBe(0.3);
  });

  it("tracks progress from settled and open bookings", () => {
    const b = [
      { status: "settled", plannedMB: 100, deliveryBps: 9400, p: 0.9 },
      { status: "confirmed", plannedMB: 100, deliveryBps: null, p: 0.9 },
      { status: "expired", plannedMB: 100, deliveryBps: null, p: 0.9 },
    ];
    const pr = progress(150, Date.now() + H, "active", b);
    expect(pr.verifiedMB).toBe(94);
    expect(pr.passesLeft).toBe(1);
    expect(pr.health).toBe("on_track"); // 94 + 90 expected ≥ 150
    expect(progress(94, Date.now() + H, "active", b).health).toBe("fulfilled");
    expect(progress(500, Date.now() + H, "active", b).health).toBe("at_risk");
  });
});

describe("auto re-booking top-up", () => {
  it("adds nothing while the booked passes are still enough", () => {
    const booked = many(6).map(c => ({ aos: c.aos, los: c.los, mb: 63.75, p: 0.95 }));
    expect(topUp(booked, many(20).slice(10), 120, 1000)).toEqual([]);
  });
  it("adds passes after a cancellation until confidence is back at the goal", () => {
    const booked = [pass(1)].map(c => ({ aos: c.aos, los: c.los, mb: 63.75, p: 0.9 })); // one pass left for 120 MB
    const add = topUp(booked, many(20).slice(5), 120, 1000);
    expect(add.length).toBeGreaterThan(0);
    expect(confidence([...booked, ...add], 120)).toBeGreaterThanOrEqual(CONFIDENCE_GOAL);
    expect(add.every(a => !booked.some(b => b.aos === a.aos))).toBe(true);
  });
});
