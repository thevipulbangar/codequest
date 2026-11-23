import "server-only";
import { Prisma } from "@prisma/client";
import { creditsFor } from "../payments/razorpay-signature";
import { HttpError } from "./auth";
import { db } from "./db";
import { TX, credit } from "./ledger";
import { notify } from "./notify";

export const MIN_TOPUP_INR = 100;
export const MAX_TOPUP_INR = 500_000;
/** 1 credit = ₹1 (shown on the wallet screen). */
export const CREDITS_PER_INR = 1;

export function razorpayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID, keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new HttpError(503, "Online payments are not configured yet");
  return { keyId, keySecret, webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET, test: keyId.startsWith("rzp_test_") };
}

/** Razorpay REST call with basic auth. Errors from Razorpay are logged, not shown to users. */
async function rzp<T>(path: string, init?: { method?: string; json?: unknown }): Promise<T> {
  const { keyId, keySecret } = razorpayConfig();
  const r = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: init?.method ?? (init?.json ? "POST" : "GET"),
    headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`, ...(init?.json ? { "Content-Type": "application/json" } : {}) },
    body: init?.json ? JSON.stringify(init.json) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { console.error("[razorpay]", path, r.status, JSON.stringify(data).slice(0, 300)); throw new HttpError(502, "The payment provider could not be reached. Try again."); }
  return data as T;
}

/** Create a Razorpay order. The amount and the credits it buys are decided and stored here, on the server. */
export async function createTopUp(userId: string, amountInr: number) {
  if (!Number.isInteger(amountInr) || amountInr < MIN_TOPUP_INR || amountInr > MAX_TOPUP_INR) throw new HttpError(400, `Enter a whole amount between ₹${MIN_TOPUP_INR} and ₹${MAX_TOPUP_INR.toLocaleString("en-IN")}`);
  const cfg = razorpayConfig();
  const amountPaise = amountInr * 100, credits = creditsFor(amountInr, CREDITS_PER_INR);
  const order = await rzp<{ id: string }>("/orders", { json: { amount: amountPaise, currency: "INR", receipt: `op_${Date.now().toString(36)}`, notes: { userId, credits: String(credits) } } });
  await db.payment.create({ data: { userId, orderId: order.id, amountPaise, credits: new Prisma.Decimal(credits) } });
  return { orderId: order.id, amountPaise, currency: "INR", credits, keyId: cfg.keyId, test: cfg.test };
}

interface RzpPayment { id: string; order_id: string; amount: number; currency: string; status: string; method?: string; error_description?: string | null }

/**
 * Confirm a payment with Razorpay and add the credits exactly once. Safe to call repeatedly and from both
 * the checkout callback and the webhook: the status guard makes the second caller a no-op.
 */
export async function completeTopUp(orderId: string, paymentId: string) {
  const pay = await db.payment.findUnique({ where: { orderId } });
  if (!pay) throw new HttpError(404, "Unknown payment order");
  if (pay.status === "paid") return pay;
  let p = await rzp<RzpPayment>(`/payments/${encodeURIComponent(paymentId)}`);
  if (p.order_id !== orderId || p.amount !== pay.amountPaise || p.currency !== pay.currency) {
    console.error("[razorpay] mismatch", { orderId, paymentId, got: { order: p.order_id, amount: p.amount, currency: p.currency } });
    throw new HttpError(400, "This payment does not match the order");
  }
  if (p.status === "authorized") p = await rzp<RzpPayment>(`/payments/${encodeURIComponent(paymentId)}/capture`, { json: { amount: pay.amountPaise, currency: pay.currency } });
  if (p.status !== "captured") {
    if (p.status === "failed") await db.payment.updateMany({ where: { id: pay.id, status: "created" }, data: { status: "failed", failReason: p.error_description ?? "failed" } });
    throw new HttpError(402, p.status === "failed" ? "The payment failed. No money was taken." : "The payment is not complete yet");
  }
  const credited = await db.$transaction(async tx => {
    const r = await tx.payment.updateMany({ where: { id: pay.id, status: { not: "paid" } }, data: { status: "paid", paymentId, paidAt: new Date(), failReason: null } });
    if (r.count !== 1) return false;
    await credit(tx, pay.userId, new Prisma.Decimal(pay.credits), { type: "topup", note: `Razorpay ${paymentId} · ₹${(pay.amountPaise / 100).toLocaleString("en-IN")}${p.method ? ` · ${p.method}` : ""}` });
    return true;
  }, TX);
  if (credited) void notify(pay.userId, "Credits added", `₹${(pay.amountPaise / 100).toLocaleString("en-IN")} received. ${Number(pay.credits).toFixed(2)} credits were added to your wallet.`, "/dashboard/operator/wallet");
  return db.payment.findUniqueOrThrow({ where: { id: pay.id } });
}
