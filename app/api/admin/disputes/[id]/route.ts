import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { HttpError, requireUser } from "@/lib/server/auth";
import { body, handle } from "@/lib/server/http";
import { TX, credit, debit } from "@/lib/server/ledger";
import { audit } from "@/lib/server/verification";
import { notify } from "@/lib/server/notify";

const Schema = z.object({
  status: z.enum(["resolved", "rejected"]),
  resolution: z.string().trim().min(10, "Explain the decision").max(2000),
  refundAmount: z.number().min(0).max(1_000_000).default(0), // moved from the station's payout back to the operator
});

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireUser(["admin"]);
  const { id } = await params;
  const b = await body(req, Schema);
  const d = await db.dispute.findUnique({ where: { id }, include: { booking: { include: { station: true } } } });
  if (!d) throw new HttpError(404, "Not found");
  if (d.status !== "open") throw new HttpError(409, "This dispute is already closed");
  const amount = new Prisma.Decimal(b.status === "resolved" ? b.refundAmount : 0);
  if (amount.gt(d.booking.stationNet ?? 0)) throw new HttpError(400, "The refund can't exceed what the station was paid for this pass");

  await db.$transaction(async tx => {
    const r = await tx.dispute.updateMany({ where: { id, status: "open" }, data: { status: b.status, resolution: b.resolution, refundAmount: amount, resolvedAt: new Date() } });
    if (r.count !== 1) throw new HttpError(409, "This dispute is already closed");
    if (amount.gt(0)) {
      // Clawback (bond-style penalty): fails if the station owner no longer holds enough credits.
      await debit(tx, d.booking.station.ownerId, amount, { type: "adjustment", bookingId: d.bookingId, note: `Dispute ${id.slice(0, 8)} resolved against station` });
      await credit(tx, d.booking.operatorId, amount, { type: "adjustment", bookingId: d.bookingId, note: `Dispute ${id.slice(0, 8)} refund` });
    }
  }, TX);
  await audit(admin.id, `dispute:${b.status}`, id, `${amount.toFixed(2)} — ${b.resolution}`);
  for (const uid of [d.booking.operatorId, d.booking.station.ownerId])
    void notify(uid, "Dispute closed", `Decision: ${b.status}${amount.gt(0) ? `, ${amount.toFixed(2)} credits refunded to the operator` : ""}. ${b.resolution}`, "/dashboard/disputes");
  return NextResponse.json({ ok: true });
});
