import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireUser } from "@/lib/server/auth";
import { body, handle, rateLimit } from "@/lib/server/http";
import { verifyAndSettle } from "@/lib/server/bookings";
import { loadBooking } from "@/lib/server/booking-access";

const Receipt = z.object({
  bookingId: z.string(), stationId: z.string(), manifestRoot: z.string().regex(/^[0-9a-f]{64}$/),
  frames: z.array(z.object({
    id: z.number().int().min(0), hash: z.string().regex(/^[0-9a-fA-F]{64}$/).transform(h => h.toLowerCase()),
    receivedAt: z.number().int(), rssiDbm: z.number().finite(), dopplerHz: z.number().finite(),
  })).max(40000),
  signature: z.string().regex(/^[0-9a-f]+$/), publicKey: z.string().regex(/^[0-9a-f]+$/),
});

/** Station owner submits the signed receipt after LOS → verified against the manifest → escrow settles. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requireUser(["owner"]);
  rateLimit(`receipt:${u.id}`, 20, 60_000);
  const b = await loadBooking((await params).id, u);
  if (b.station.ownerId !== u.id) throw new HttpError(404, "Not found");
  if (b.status !== "manifest_committed") throw new HttpError(409, b.status === "confirmed" ? "The operator hasn't committed a manifest for this pass" : "This booking can't take a receipt");
  if (Date.now() < b.los.getTime()) throw new HttpError(409, "Submit the receipt after the pass ends (LOS)");
  if (!b.station.publicKey) throw new HttpError(409, "Register your station's signing key first");
  const r = await body(req, Receipt);
  if (r.bookingId !== b.id || r.stationId !== b.stationId) throw new HttpError(400, "Receipt is for a different booking or station");
  if (r.publicKey !== b.station.publicKey) throw new HttpError(400, "Receipt is not signed with this station's registered key");
  if (r.frames.length > 2 * (b.framesPromised ?? 0)) throw new HttpError(400, "Receipt has far more frames than the manifest");
  const report = await verifyAndSettle(b, r);
  return NextResponse.json({ report });
});
