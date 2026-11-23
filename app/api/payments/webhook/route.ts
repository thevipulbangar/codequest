import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { completeTopUp, razorpayConfig } from "@/lib/server/payments";
import { webhookSignatureValid } from "@/lib/payments/razorpay-signature";

/**
 * Razorpay webhook (events: payment.captured, order.paid). Adds the credits if the buyer closed the
 * checkout before the success callback ran. Idempotent with the checkout callback.
 */
export const POST = handle(async (req: Request) => {
  const secret = razorpayConfig().webhookSecret;
  const raw = await req.text();
  if (!secret || !webhookSignatureValid(raw, req.headers.get("x-razorpay-signature") ?? "", secret)) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  const evt = JSON.parse(raw) as { event: string; payload?: { payment?: { entity?: { id: string; order_id: string } } } };
  const p = evt.payload?.payment?.entity;
  if ((evt.event === "payment.captured" || evt.event === "order.paid") && p?.order_id) {
    await completeTopUp(p.order_id, p.id).catch(e => console.error("[razorpay webhook]", evt.event, p.order_id, e instanceof Error ? e.message : e));
  }
  return NextResponse.json({ ok: true }); // always 200 for valid events, so Razorpay doesn't retry forever
});
