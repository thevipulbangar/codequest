import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireUser } from "@/lib/server/auth";
import { body, handle, rateLimit } from "@/lib/server/http";
import { db } from "@/lib/server/db";
import { balanceOf } from "@/lib/server/ledger";
import { completeTopUp, razorpayConfig } from "@/lib/server/payments";
import { checkoutSignatureValid } from "@/lib/payments/razorpay-signature";

const Body = z.object({ razorpay_order_id: z.string().min(1).max(64), razorpay_payment_id: z.string().min(1).max(64), razorpay_signature: z.string().regex(/^[0-9a-f]{64}$/) });

/** Checkout success callback: check Razorpay's signature, confirm the payment with Razorpay, add credits once. */
export const POST = handle(async (req: Request) => {
  const u = await requireUser(["operator"]);
  rateLimit(`topup-verify:${u.id}`, 20, 60_000);
  const b = await body(req, Body);
  if (!checkoutSignatureValid(b.razorpay_order_id, b.razorpay_payment_id, b.razorpay_signature, razorpayConfig().keySecret)) throw new HttpError(400, "Payment signature is not valid");
  const own = await db.payment.findUnique({ where: { orderId: b.razorpay_order_id }, select: { userId: true } });
  if (!own || own.userId !== u.id) throw new HttpError(404, "Unknown payment order");
  const p = await completeTopUp(b.razorpay_order_id, b.razorpay_payment_id);
  return NextResponse.json({ status: p.status, credits: Number(p.credits), balance: Number(await balanceOf(u.id)) });
});
