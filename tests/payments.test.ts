import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkoutSignatureValid, creditsFor, webhookSignatureValid } from "../lib/payments/razorpay-signature";

const SECRET = "test_secret_123";
const sig = (data: string) => createHmac("sha256", SECRET).update(data).digest("hex");

describe("razorpay signatures", () => {
  it("accepts the checkout signature for this order and payment", () => {
    expect(checkoutSignatureValid("order_A", "pay_B", sig("order_A|pay_B"), SECRET)).toBe(true);
  });
  it("rejects a signature for another order, a wrong secret or garbage", () => {
    expect(checkoutSignatureValid("order_X", "pay_B", sig("order_A|pay_B"), SECRET)).toBe(false);
    expect(checkoutSignatureValid("order_A", "pay_B", sig("order_A|pay_B"), "other")).toBe(false);
    expect(checkoutSignatureValid("order_A", "pay_B", "abc", SECRET)).toBe(false);
  });
  it("checks webhook signatures over the raw body", () => {
    const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_B", order_id: "order_A" } } } });
    expect(webhookSignatureValid(body, sig(body), SECRET)).toBe(true);
    expect(webhookSignatureValid(body + " ", sig(body), SECRET)).toBe(false);
  });
  it("converts rupees to credits", () => {
    expect(creditsFor(1000, 1)).toBe(1000);
    expect(creditsFor(999, 1.5)).toBe(1498.5);
  });
});
