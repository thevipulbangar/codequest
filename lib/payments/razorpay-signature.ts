import { createHmac, timingSafeEqual } from "node:crypto";

const hmac = (data: string, secret: string) => createHmac("sha256", secret).update(data).digest("hex");
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Checkout success callback: signature = HMAC-SHA256(order_id + "|" + payment_id, key_secret). */
export const checkoutSignatureValid = (orderId: string, paymentId: string, signature: string, keySecret: string) =>
  same(hmac(`${orderId}|${paymentId}`, keySecret), signature);

/** Webhook: X-Razorpay-Signature = HMAC-SHA256(raw request body, webhook secret). */
export const webhookSignatureValid = (rawBody: string, signature: string, webhookSecret: string) =>
  same(hmac(rawBody, webhookSecret), signature);

/** Credits for a top-up, in whole credits. Rupees are integers; the rate comes from the server's config. */
export const creditsFor = (amountInr: number, creditsPerInr: number) => Math.round(amountInr * creditsPerInr * 100) / 100;
