import "server-only";
import { Prisma, type DataContract, type Satellite } from "@prisma/client";
import { predictPasses } from "../orbital/passes";
import { tleFor } from "../orbital/tle";
import { CONFIDENCE_GOAL, type Candidate, type Plan, confidence, maxFeasibleMB, plan, progress, successRate, topUp } from "../guarantee/planner";
import { activeSatellites, activeStations } from "./assets";
import { HttpError } from "./auth";
import { MIN_LEAD_MS, OPEN_STATUSES, RECEIPT_DEADLINE_MS, assertStationFree, feeBps, refundFull, reliability } from "./bookings";
import { db } from "./db";
import { TX, credit, debit } from "./ledger";
import { notify } from "./notify";

export const MAX_HORIZON_MS = 7 * 24 * 3600_000;
const D = (n: number) => new Prisma.Decimal(n.toFixed(2));

export interface ContractInput { satelliteId: string; targetMB: number; rateKbps: number; deadline: number; minElDeg: number; compensation: number }

/** Bookable passes for one satellite between now and the deadline, excluding booked or blocked station time. */
async function candidates(sat: Satellite, deadline: number, minElDeg: number) {
  const from = Date.now() + MIN_LEAD_MS + 5 * 60_000;
  if (deadline <= from) return [];
  const [stations, tle] = await Promise.all([activeStations(), tleFor(sat.noradId)]);
  if (!tle) throw new HttpError(503, "No current orbit is available for this satellite; try again later");
  const usable = stations.filter(s => s.bands.includes(sat.band));
  if (!usable.length) return [];
  const ids = usable.map(s => s.id);
  const [rel, busy, blocks] = await Promise.all([
    reliability(ids),
    db.booking.findMany({ where: { stationId: { in: ids }, status: { in: [...OPEN_STATUSES, "settled"] }, los: { gt: new Date(from) }, aos: { lt: new Date(deadline) } }, select: { stationId: true, aos: true, los: true } }),
    db.stationBlock.findMany({ where: { stationId: { in: ids }, end: { gt: new Date(from) }, start: { lt: new Date(deadline) } }, select: { stationId: true, start: true, end: true } }),
  ]);
  const taken = [...busy.map(b => ({ s: b.stationId, a: +b.aos, b: +b.los })), ...blocks.map(b => ({ s: b.stationId, a: +b.start, b: +b.end }))];
  const out: Candidate[] = [];
  for (const st of usable) {
    const p = successRate(rel.get(st.id)?.score);
    for (const x of predictPasses(tle.rec, { lat: st.latitude, lon: st.longitude, altKm: st.altitudeM / 1000 }, from, deadline, minElDeg)) {
      if (x.los > deadline || taken.some(t => t.s === st.id && t.a < x.los && t.b > x.aos)) continue;
      out.push({ id: `${st.id}-${x.aos}`, stationId: st.id, station: st.name, aos: x.aos, los: x.los, maxElDeg: x.maxElDeg, durationS: x.durationS, price: Number(st.pricePerPass), p });
    }
  }
  return out;
}

async function ownSatellite(operatorId: string, satelliteId: string) {
  const sat = (await activeSatellites(operatorId)).find(s => s.id === satelliteId);
  if (!sat) throw new HttpError(403, "That satellite isn't one of your active satellites");
  return sat;
}

/** Plan and price a contract. Server-side only; the client's numbers are never used for money. */
export async function quote(operatorId: string, i: ContractInput): Promise<{ sat: Satellite; plan: Plan }> {
  if (i.deadline > Date.now() + MAX_HORIZON_MS) throw new HttpError(400, "Deadlines can be at most 7 days ahead");
  const sat = await ownSatellite(operatorId, i.satelliteId);
  const c = await candidates(sat, i.deadline, i.minElDeg);
  if (!c.length) throw new HttpError(409, "No bookable passes before that deadline. Move the deadline later or lower the minimum elevation.");
  const p = plan(c, { targetMB: i.targetMB, rateKbps: i.rateKbps, compensation: i.compensation });
  if (!p) throw new HttpError(409, `Not feasible: all ${c.length} available passes together carry about ${maxFeasibleMB(c, i.rateKbps).toFixed(0)} MB before the deadline.`);
  return { sat, plan: p };
}

/** Book every planned pass and charge passes + premium in one transaction. */
export async function createContract(operatorId: string, i: ContractInput, expectedTotal: number) {
  const { sat, plan: p } = await quote(operatorId, i);
  // The quote the operator accepted must still stand (prices or availability may have moved).
  if (Math.abs(p.total - expectedTotal) > 0.009) throw new HttpError(409, `The price changed to ${p.total.toFixed(2)} credits. Review the new quote and confirm again.`);
  const contract = await db.$transaction(async tx => {
    const c = await tx.dataContract.create({ data: {
      operatorId, satelliteId: sat.id, targetMB: i.targetMB, rateKbps: i.rateKbps, minElDeg: i.minElDeg, deadline: new Date(i.deadline),
      passCost: D(p.passCost), premium: D(p.premium), compensation: D(i.compensation), confidenceBps: Math.round(p.confidence * 10000),
    } });
    for (const x of p.passes) {
      const aos = new Date(x.aos), los = new Date(x.los), price = D(x.price);
      await assertStationFree(tx, x.stationId, aos, los);
      const b = await tx.booking.create({ data: { operatorId, satelliteId: sat.id, stationId: x.stationId, aos, los, maxElDeg: x.maxElDeg, price, feeBps: feeBps(), contractId: c.id, plannedMB: x.mb, backup: x.backup } });
      await debit(tx, operatorId, price, { type: "escrow_lock", bookingId: b.id, note: `Escrow: ${sat.name} @ ${x.station}${x.backup ? " (backup)" : ""}` });
    }
    await debit(tx, operatorId, D(p.premium), { type: "premium", note: `Guarantee premium, contract ${c.id.slice(0, 8)}` });
    await tx.ledgerEntry.create({ data: { userId: null, amount: D(p.premium), type: "premium", note: `Contract ${c.id}` } });
    return c;
  }, { timeout: 60_000, maxWait: 15_000 });
  const owners = await db.groundStation.findMany({ where: { id: { in: [...new Set(p.passes.map(x => x.stationId))] } }, select: { ownerId: true, name: true } });
  for (const o of owners) void notify(o.ownerId, "New guaranteed-downlink bookings", `${sat.name} booked passes at ${o.name} as part of a delivery guarantee.`, "/dashboard/station-owner/bookings");
  return contract;
}

type WithBookings = DataContract & { satellite: Satellite; bookings: Prisma.BookingGetPayload<{ include: { station: { select: { id: true; name: true; ownerId: true } } } }>[] };
const withBookings = { satellite: true, bookings: { include: { station: { select: { id: true, name: true, ownerId: true } } }, orderBy: { aos: "asc" } } } as const;

/** Client view: contract, live progress and its passes. */
export async function contractView(c: WithBookings) {
  const rel = await reliability([...new Set(c.bookings.map(b => b.stationId))]);
  const rows = c.bookings.map(b => ({ status: b.status, plannedMB: b.plannedMB, deliveryBps: b.deliveryBps, p: successRate(rel.get(b.stationId)?.score) }));
  const pr = progress(c.targetMB, +c.deadline, c.status, rows);
  return {
    id: c.id, status: c.status, health: pr.health,
    satellite: { id: c.satellite.id, name: c.satellite.name, noradId: c.satellite.noradId, band: c.satellite.band },
    targetMB: c.targetMB, rateKbps: c.rateKbps, minElDeg: c.minElDeg, deadline: +c.deadline, createdAt: +c.createdAt, closedAt: c.closedAt ? +c.closedAt : null,
    passCost: Number(c.passCost), premium: Number(c.premium), compensation: Number(c.compensation), confidence: c.confidenceBps / 10000,
    verifiedMB: pr.verifiedMB, pendingMB: pr.pendingMB, expectedMB: pr.expectedMB, passesLeft: pr.passesLeft, pct: pr.pct,
    passes: c.bookings.map(b => ({ id: b.id, station: b.station.name, aos: +b.aos, los: +b.los, maxElDeg: b.maxElDeg, price: Number(b.price), status: b.status, backup: b.backup, plannedMB: b.plannedMB ?? 0, deliveryBps: b.deliveryBps })),
  };
}

export const loadContract = (id: string) => db.dataContract.findUnique({ where: { id }, include: withBookings });

/**
 * Bring one contract up to date. Called after any of its bookings changes and by the sweep:
 *  - target verified  → fulfilled; unused future passes (backups first) are released and refunded
 *  - deadline passed and nothing left pending → missed; the reserve pays the agreed compensation
 *  - otherwise, if the passes still booked can't carry the rest → book replacement passes (auto re-booking)
 */
export async function reconcileContract(id: string) {
  const c = await loadContract(id);
  if (!c || c.status !== "active") return;
  const now = Date.now();
  const verified = c.bookings.filter(b => b.status === "settled").reduce((s, b) => s + (b.plannedMB ?? 0) * (b.deliveryBps ?? 0) / 10000, 0);
  const open = c.bookings.filter(b => OPEN_STATUSES.includes(b.status as never));
  await db.dataContract.update({ where: { id }, data: { verifiedMB: verified } });

  if (verified >= c.targetMB) {
    const r = await db.dataContract.updateMany({ where: { id, status: "active" }, data: { status: "fulfilled", closedAt: new Date() } });
    if (r.count !== 1) return;
    for (const b of open.filter(b => +b.aos > now + MIN_LEAD_MS)) {
      await refundFull(b, "cancelled", "Released: the contract target was already delivered").catch(() => {});
      void notify(b.station.ownerId, "Booking released", `A ${c.satellite.name} pass at ${b.station.name} was released because its delivery guarantee is already met.`, "/dashboard/station-owner/bookings");
    }
    void notify(c.operatorId, "Guarantee fulfilled", `${c.satellite.name}: ${verified.toFixed(1)} of ${c.targetMB} MB verified before the deadline. Unused passes were refunded.`, `/dashboard/operator/contracts/${id}`);
    return;
  }

  if (now > +c.deadline) {
    if (open.length && now < +c.deadline + RECEIPT_DEADLINE_MS) return; // receipts for the last passes may still arrive
    const comp = new Prisma.Decimal(c.compensation);
    await db.$transaction(async tx => {
      const r = await tx.dataContract.updateMany({ where: { id, status: "active" }, data: { status: "missed", closedAt: new Date() } });
      if (r.count !== 1) return;
      if (comp.gt(0)) {
        await credit(tx, c.operatorId, comp, { type: "compensation", note: `Missed guarantee, contract ${id.slice(0, 8)}` });
        await tx.ledgerEntry.create({ data: { userId: null, amount: comp.negated(), type: "compensation", note: `Contract ${id}` } });
      }
    }, TX);
    void notify(c.operatorId, "Guarantee missed: compensation paid", `${c.satellite.name}: ${verified.toFixed(1)} of ${c.targetMB} MB verified by the deadline. ${comp.toFixed(2)} credits were paid to your wallet.`, `/dashboard/operator/contracts/${id}`);
    return;
  }

  // Auto re-booking: if the passes still booked no longer give a CONFIDENCE_GOAL chance of delivering
  // what is still missing (a station cancelled, a booking expired, a pass under-delivered), add more.
  const need = c.targetMB - verified;
  const rel = await reliability([...new Set(open.map(b => b.stationId))]);
  const existing = open.map(b => ({ aos: +b.aos, los: +b.los, mb: b.plannedMB ?? 0, p: successRate(rel.get(b.stationId)?.score) }));
  if (confidence(existing, need) >= CONFIDENCE_GOAL) return;
  // Never re-book a slot this contract already lost (the station cancelled it or never delivered).
  const lost = c.bookings.filter(b => b.status === "cancelled" || b.status === "expired");
  const fresh = (await candidates(c.satellite, +c.deadline, c.minElDeg).catch(() => [])).filter(x => !lost.some(b => b.stationId === x.stationId && +b.aos < x.los && +b.los > x.aos));
  const add = topUp(existing, fresh, need, c.rateKbps);
  if (!add.length) { void notify(c.operatorId, "Guarantee at risk", `${c.satellite.name}: no replacement pass is available before the deadline for the remaining ${need.toFixed(1)} MB.`, `/dashboard/operator/contracts/${id}`); return; }
  const cost = add.reduce((s, x) => s + x.price, 0);
  try {
    await db.$transaction(async tx => {
      for (const x of add) {
        const aos = new Date(x.aos), los = new Date(x.los), price = D(x.price);
        await assertStationFree(tx, x.stationId, aos, los);
        const b = await tx.booking.create({ data: { operatorId: c.operatorId, satelliteId: c.satelliteId, stationId: x.stationId, aos, los, maxElDeg: x.maxElDeg, price, feeBps: feeBps(), contractId: id, plannedMB: x.mb } });
        await debit(tx, c.operatorId, price, { type: "escrow_lock", bookingId: b.id, note: `Escrow (auto re-booking): ${c.satellite.name} @ ${x.station}` });
      }
    }, { timeout: 60_000, maxWait: 15_000 });
    void notify(c.operatorId, "Pass re-booked automatically", `${c.satellite.name}: ${add.length} replacement ${add.length === 1 ? "pass" : "passes"} booked (${cost.toFixed(2)} credits) to keep the ${need.toFixed(1)} MB still due on track.`, `/dashboard/operator/contracts/${id}`);
  } catch (e) {
    const msg = e instanceof HttpError ? e.message : "booking failed";
    void notify(c.operatorId, "Guarantee at risk", `${c.satellite.name}: automatic re-booking failed (${msg}). Top up your wallet or book a pass manually.`, `/dashboard/operator/contracts/${id}`);
  }
}

let lastSweep = 0;
/** Reconcile active contracts that are past their deadline (same read-path pattern as expireOverdue). */
export async function sweepContracts() {
  if (Date.now() - lastSweep < 60_000) return;
  lastSweep = Date.now();
  const due = await db.dataContract.findMany({ where: { status: "active", deadline: { lt: new Date() } }, select: { id: true }, take: 20 });
  for (const c of due) await reconcileContract(c.id).catch(e => console.error("[contracts]", e));
}
