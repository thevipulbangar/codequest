import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { HttpError, requireUser } from "@/lib/server/auth";
import { body, handle } from "@/lib/server/http";
import { loadBooking } from "@/lib/server/booking-access";
import { merkleRoot } from "@/lib/verifier/merkle";

const Manifest = z.object({
  frames: z.array(z.object({ id: z.number().int().min(0), hash: z.string().regex(/^[0-9a-fA-F]{64}$/, "frame hash must be SHA-256 hex") })).min(1).max(20000),
}).refine(m => new Set(m.frames.map(f => f.id)).size === m.frames.length, { message: "frame ids must be unique", path: ["frames"] });

/** Operator commits the expected frames before AOS. The Merkle root is fixed from then on. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requireUser(["operator"]);
  const b = await loadBooking((await params).id, u);
  if (b.operatorId !== u.id) throw new HttpError(404, "Not found");
  if (Date.now() >= b.aos.getTime()) throw new HttpError(409, "The pass has started; the manifest can no longer be committed");
  const m = await body(req, Manifest);
  const frames = m.frames.map(f => ({ id: f.id, hash: f.hash.toLowerCase() })).sort((a, c) => a.id - c.id);
  const root = merkleRoot(frames);
  const r = await db.booking.updateMany({
    where: { id: b.id, status: "confirmed" }, // immutable once committed
    data: { status: "manifest_committed", manifest: { bookingId: b.id, frames, root }, manifestRoot: root, framesPromised: frames.length },
  });
  if (r.count !== 1) throw new HttpError(409, "A manifest is already committed for this booking");
  return NextResponse.json({ manifestRoot: root, framesPromised: frames.length });
});
