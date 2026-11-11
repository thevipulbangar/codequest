import "server-only";
import { Prisma, type Booking, type GroundStation, type Satellite, type User } from "@prisma/client";
import { predictPasses } from "../orbital/passes";
import { tleFor } from "../orbital/tle";
import { settle } from "../verifier/settlement";
import type { Manifest, Receipt, VerificationReport } from "../verifier/types";
import { verifyReceipt } from "../verifier/verify";
import { HttpError } from "./auth";
import { db } from "./db";
import { TX, credit, fromCents, platformFee, toCents } from "./ledger";
import { notify } from "./notify";

export const OPEN_STATUSES = ["confirmed", "manifest_committed"] as const;
export const MIN_LEAD_MS = 10 * 60_000;          // book at least 10 min before AOS
export const CANCEL_CUTOFF_MS = 60 * 60_000;     // operators may cancel up to 1 h before AOS
export const RECEIPT_DEADLINE_MS = 24 * 3600_000; // after LOS; then the operator can claim a full refund
export const DISPUTE_WINDOW_MS = 24 * 3600_000;  // after settlement

export const feeBps = () => Math.min(2000, Math.max(0, Number(process.env.PLATFORM_FEE_BPS ?? 800) || 0));
/** Worst-case Doppler shift for LEO (~7.6 km/s line-of-sight). */
export const maxDopplerHz = (downlinkMHz: number) => downlinkMHz * 1e6 * 7.6 / 299_792.458;

/** Re-derive the pass on the server from the live orbit — the client's times are never trusted. */
export async function findPassNear(sat: Satellite, st: GroundStation, aosMs: number) {
  const tle = await tleFor(sat.noradId);
  if (!tle) throw new HttpError(503, "No current orbit is available for this satellite; try again later");
  const passes = predictPasses(tle.rec, { lat: st.latitude, lon: st.longitude, altKm: st.altitudeM / 1000 }, aosMs - 15 * 60_000, aosMs + 30 * 60_000, 0);
  const p = passes.find(x => Math.abs(x.aos - aosMs) <= 120_000);
  if (!p) throw new HttpError(409, "That pass is no longer predicted; refresh the pass list");
  return p;
}

/** Overlap with existing bookings or the owner's blocked periods. Call inside the booking transaction. */
export async function assertStationFree(tx: Prisma.TransactionClient, stationId: string, aos: Date, los: Date) {
  // Serialise bookings per station so two concurrent requests can't both pass the overlap check.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${stationId}))`;
  const [clash, block] = await Promise.all([
    tx.booking.findFirst({ where: { stationId, status: { in: [...OPEN_STATUSES, "settled"] }, aos: { lt: los }, los: { gt: aos } }, select: { id: true } }),
    tx.stationBlock.findFirst({ where: { stationId, start: { lt: los }, end: { gt: aos } }, select: { id: true } }),
  ]);
  if (block) throw new HttpError(409, "The station is unavailable at that time");
  if (clash) throw new HttpError(409, "That pass is already booked at this station");
}

type Full = Booking & { satellite: Satellite; station: GroundStation & { owner: Pick<User, "id" | "name" | "company"> }; operator: Pick<User, "id" | "name" | "company"> };
export const bookingInclude = {
  satellite: true,
  station: { include: { owner: { select: { id: true, name: true, company: true } } } },
  operator: { select: { id: true, name: true, company: true } },
} as const;

export function canSee(b: Full, u: User) {
  return u.role === "admin" || b.operatorId === u.id || b.station.ownerId === u.id;
}

/** Client-facing shape. The raw receipt is only included for the parties. */
export function bookingView(b: Full, u: User) {
  const now = Date.now();
  const mine = b.operatorId === u.id, station = b.station.ownerId === u.id;
  const n = (d: Prisma.Decimal | null) => (d === null ? null : Number(d));
  return {
    id: b.id, status: b.status, role: mine ? "operator" : station ? "station" : "admin",
    satellite: { id: b.satellite.id, name: b.satellite.name, noradId: b.satellite.noradId, band: b.satellite.band, downlinkMHz: b.satellite.downlinkMHz },
    station: { id: b.station.id, name: b.station.name, country: b.station.country, latitude: b.station.latitude, longitude: b.station.longitude, owner: b.station.owner.company || b.station.owner.name, hasKey: !!b.station.publicKey },
    operator: b.operator.company || b.operator.name,
    aos: b.aos.getTime(), los: b.los.getTime(), maxElDeg: b.maxElDeg,
    price: Number(b.price), feeBps: b.feeBps,
    manifestRoot: b.manifestRoot, framesPromised: b.framesPromised,
    framesVerified: b.framesVerified, deliveryBps: b.deliveryBps,
    report: b.report as VerificationReport | null,
    settlement: b.settledAt ? { stationGross: n(b.stationGross), platformFee: n(b.platformFee), stationNet: n(b.stationNet), operatorRefund: n(b.operatorRefund), settledAt: b.settledAt.getTime() } : null,
    receiptFrames: (mine || station || u.role === "admin") && b.receipt ? ((b.receipt as unknown as Receipt).frames.map(f => ({ id: f.id, t: f.receivedAt, rssi: f.rssiDbm }))) : null,
    can: {
      commitManifest: mine && b.status === "confirmed" && now < b.aos.getTime(),
      cancel: (mine && OPEN_STATUSES.includes(b.status as never) && now < b.aos.getTime() - CANCEL_CUTOFF_MS) || (station && OPEN_STATUSES.includes(b.status as never) && now < b.aos.getTime()),
      submitReceipt: station && b.status === "manifest_committed" && now >= b.los.getTime(),
      claimRefund: (mine || u.role === "admin") && OPEN_STATUSES.includes(b.status as never) && now > b.los.getTime() + RECEIPT_DEADLINE_MS,
      dispute: (mine || station) && b.status === "settled" && !!b.settledAt && now - b.settledAt.getTime() <= DISPUTE_WINDOW_MS,
    },
  };
}

/** Full refund to the operator (cancel / expiry). Idempotent via the status guard. */
export async function refundFull(b: Booking, status: "cancelled" | "expired", note: string) {
  await db.$transaction(async tx => {
    const r = await tx.booking.updateMany({ where: { id: b.id, status: { in: [...OPEN_STATUSES] } }, data: { status } });
    if (r.count !== 1) throw new HttpError(409, "This booking can no longer be changed");
    await credit(tx, b.operatorId, new Prisma.Decimal(b.price), { type: "refund", bookingId: b.id, note });
  }, TX);
}

/** Expire one overdue booking: full refund + tell the station. Shared by the manual claim and the sweep. */
export async function expireBooking(b: Booking & { satellite: { name: string }; station: { ownerId: string } }) {
  await refundFull(b, "expired", "No verified receipt within 24 h");
  void notify(b.station.ownerId, "Booking expired", `No verified receipt for the ${b.satellite.name} pass; the operator was refunded. This counts against reliability.`, "/dashboard/station-owner/bookings");
  void notify(b.operatorId, "Booking refunded", `${b.satellite.name}: no verified receipt within 24 h, escrow returned.`, "/dashboard/operator/bookings");
}

let lastSweep = 0;
/**
 * Auto-expire every open booking past its receipt deadline. Called from read paths (bookings list,
 * wallet, reliability) so refunds happen without the operator clicking "Claim refund".
 * NOTE: runs on reads, at most once a minute per instance; add a scheduled function if nobody reads for days.
 */
export async function expireOverdue() {
  if (Date.now() - lastSweep < 60_000) return;
  lastSweep = Date.now();
  const due = await db.booking.findMany({
    where: { status: { in: [...OPEN_STATUSES] }, los: { lt: new Date(Date.now() - RECEIPT_DEADLINE_MS) } },
    include: { satellite: { select: { name: true } }, station: { select: { ownerId: true } } },
    take: 50,
  });
  // A booking settled/claimed meanwhile throws 409 from the status guard; skip it.
  await Promise.all(due.map(b => expireBooking(b).catch(() => {})));
}

/**
 * Verify the station's signed receipt against the committed manifest and settle pro-rata.
 * All money maths is integer cents via the tested settle(); escrow = payout + fee + refund exactly.
 */
export async function verifyAndSettle(b: Full, receipt: Receipt) {
  const manifest = b.manifest as unknown as Manifest;
  const report = verifyReceipt(manifest, receipt, { start: b.aos.getTime(), end: b.los.getTime(), downlinkHz: b.satellite.downlinkMHz * 1e6, maxDopplerHz: maxDopplerHz(b.satellite.downlinkMHz) });
  // An unsigned/foreign receipt is not evidence of anything: refuse it (the station can fix and resubmit)
  // instead of settling at 0%, which would irreversibly zero the station's payout.
  if (report.rejected) throw new HttpError(400, `Receipt rejected: ${report.rejected}`);
  const s = settle(toCents(b.price), report.promised, report.verified, b.feeBps);
  const [gross, fee, net, refund] = [s.stationGross, s.platformFee, s.stationNet, s.operatorRefund].map(fromCents);
  await db.$transaction(async tx => {
    const r = await tx.booking.updateMany({
      where: { id: b.id, status: "manifest_committed" },
      data: {
        status: "settled", receipt: receipt as unknown as Prisma.InputJsonValue, report: report as unknown as Prisma.InputJsonValue,
        framesVerified: report.verified, deliveryBps: report.deliveryBps,
        stationGross: gross, platformFee: fee, stationNet: net, operatorRefund: refund, settledAt: new Date(),
      },
    });
    if (r.count !== 1) throw new HttpError(409, "This booking was already settled");
    if (net.gt(0)) await credit(tx, b.station.ownerId, net, { type: "payout", bookingId: b.id, note: `Pass ${b.satellite.name} @ ${b.station.name}` });
    if (fee.gt(0)) await platformFee(tx, fee, b.id);
    if (refund.gt(0)) await credit(tx, b.operatorId, refund, { type: "refund", bookingId: b.id, note: `Undelivered ${((10000 - report.deliveryBps) / 100).toFixed(2)}%` });
  }, TX);
  const pct = (report.deliveryBps / 100).toFixed(2);
  void notify(b.operatorId, "Pass settled", `${b.satellite.name} via ${b.station.name}: ${pct}% delivered. Refund ${refund.toFixed(2)} credits.`, "/dashboard/operator/bookings");
  void notify(b.station.ownerId, "Pass settled", `${b.satellite.name} via ${b.station.name}: ${pct}% verified. Payout ${net.toFixed(2)} credits.`, "/dashboard/station-owner/bookings");
  return report;
}

/** Transparent reliability score (0-100) per station from settled history. null = no completed passes yet. */
export async function reliability(stationIds: string[]) {
  if (!stationIds.length) return new Map<string, { score: number | null; completed: number; failed: number; avgDelivery: number | null; disputesLost: number }>();
  await expireOverdue();
  const [settled, expired, lost] = await Promise.all([
    db.booking.groupBy({ by: ["stationId"], where: { stationId: { in: stationIds }, status: "settled" }, _count: true, _avg: { deliveryBps: true } }),
    db.booking.groupBy({ by: ["stationId"], where: { stationId: { in: stationIds }, status: "expired" }, _count: true }),
    db.dispute.findMany({ where: { status: "resolved", refundAmount: { gt: 0 }, booking: { stationId: { in: stationIds } } }, select: { booking: { select: { stationId: true } } } }),
  ]);
  const out = new Map<string, { score: number | null; completed: number; failed: number; avgDelivery: number | null; disputesLost: number }>();
  for (const id of stationIds) {
    const s = settled.find(x => x.stationId === id), e = expired.find(x => x.stationId === id);
    const completed = s?._count ?? 0, failed = e?._count ?? 0, disputesLost = lost.filter(d => d.booking.stationId === id).length;
    const avg = s?._avg.deliveryBps != null ? s._avg.deliveryBps / 100 : null;
    // score = 60% avg verified delivery + 30% completion rate + 10% dispute record (−20 pts per lost dispute)
    const score = completed === 0 ? null : Math.round(0.6 * (avg ?? 0) + 0.3 * (100 * completed / (completed + failed)) + 0.1 * Math.max(0, 100 - 20 * disputesLost));
    out.set(id, { score, completed, failed, avgDelivery: avg, disputesLost });
  }
  return out;
}
