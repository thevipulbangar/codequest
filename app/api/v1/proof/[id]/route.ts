import { NextResponse } from "next/server";
import { connection } from "next/server";
import { createHash } from "node:crypto";
import { HttpError } from "@/lib/server/auth";
import { handle, rateLimit, clientIp } from "@/lib/server/http";
import { db } from "@/lib/server/db";
import { maxDopplerHz } from "@/lib/server/bookings";
import { verifyReceipt } from "@/lib/verifier/verify";
import type { Manifest, Receipt } from "@/lib/verifier/types";

/**
 * Public Proof of Downlink for one settled pass. Anyone with the link can check it: the stored manifest and
 * signed receipt are verified again on every request. Frame hashes and the raw receipt stay private.
 */
export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await connection();
  rateLimit(`proof:${clientIp(req)}`, 60, 60_000);
  const id = (await params).id;
  const b = await db.booking.findUnique({ where: { id }, include: { satellite: true, station: { include: { owner: { select: { name: true, company: true } } } }, operator: { select: { name: true, company: true } } } });
  if (!b || b.status !== "settled" || !b.manifest || !b.receipt) throw new HttpError(404, "No settled proof exists for this link");
  const manifest = b.manifest as unknown as Manifest, receipt = b.receipt as unknown as Receipt;
  const r = verifyReceipt(manifest, receipt, { start: +b.aos, end: +b.los, downlinkHz: b.satellite.downlinkMHz * 1e6, maxDopplerHz: maxDopplerHz(b.satellite.downlinkMHz) });
  const keyFingerprint = createHash("sha256").update(Buffer.from(receipt.publicKey, "hex")).digest("hex").slice(0, 16);
  return NextResponse.json({ proof: {
    id: b.id, contractId: b.contractId,
    satellite: { name: b.satellite.name, noradId: b.satellite.noradId, band: b.satellite.band, downlinkMHz: b.satellite.downlinkMHz },
    station: { name: b.station.name, country: b.station.country, owner: b.station.owner.company || b.station.owner.name },
    operator: b.operator.company || b.operator.name,
    aos: +b.aos, los: +b.los, maxElDeg: b.maxElDeg,
    manifestRoot: manifest.root, receivedRoot: r.receivedRoot, keyFingerprint,
    checks: {
      signatureValid: r.signatureValid, stationKeyMatches: receipt.publicKey === b.station.publicKey, manifestRootMatches: r.manifestRootMatches,
      promised: r.promised, received: r.received, verified: r.verified,
      missing: r.missing.length, duplicates: r.duplicates.length, invalidHashes: r.invalidHashes.length,
      timestampViolations: r.timestampViolations.length, dopplerAnomalies: r.dopplerAnomalies.length,
      deliveryBps: r.deliveryBps, confidence: r.confidence,
      matchesSettlement: r.deliveryBps === b.deliveryBps && r.verified === b.framesVerified,
    },
    settlement: { price: Number(b.price), feeBps: b.feeBps, stationNet: Number(b.stationNet), platformFee: Number(b.platformFee), operatorRefund: Number(b.operatorRefund), settledAt: b.settledAt ? +b.settledAt : null },
    reverifiedAt: Date.now(),
  } });
});
