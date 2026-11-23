"use client";
import { useState } from "react";
import { toast } from "sonner";
import { CreditCard, Loader2 } from "lucide-react";
import { inputCls } from "@/components/ui";
import { api, revalidate } from "@/lib/api-client";

interface Order { orderId: string; amountPaise: number; currency: string; credits: number; keyId: string; test: boolean; name: string; email: string }
interface RzpResponse { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
interface RzpInstance { open(): void; on(evt: "payment.failed", cb: (r: { error: { description?: string } }) => void): void }
declare global { interface Window { Razorpay?: new (o: Record<string, unknown>) => RzpInstance } }

const PRESETS = [500, 1000, 5000, 10000];

/** Razorpay's checkout script, loaded once, only when someone pays. */
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("The payment window could not be loaded. Check your connection and try again."));
    document.body.appendChild(s);
  });
}

export function TopUp() {
  const [amount, setAmount] = useState("1000");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const [o] = await Promise.all([api<Order>("/api/payments/order", { json: { amountInr: Number(amount) } }), loadCheckout()]);
      const rzp = new window.Razorpay!({
        key: o.keyId, order_id: o.orderId, amount: o.amountPaise, currency: o.currency,
        name: "OrbitPass", description: `${o.credits.toLocaleString("en-IN")} wallet credits`,
        prefill: { name: o.name, email: o.email }, theme: { color: "#0f1d33" },
        handler: async (r: RzpResponse) => {
          try {
            const d = await api<{ credits: number; balance: number }>("/api/payments/verify", { json: r });
            await revalidate("/api/wallet");
            toast.success(`${d.credits.toLocaleString("en-IN")} credits added. Balance ${d.balance.toLocaleString("en-IN")}.`);
          } catch (err) { setError(err instanceof Error ? `${err.message}. If money was taken, the credits are added automatically within a few minutes.` : "Could not confirm the payment"); }
          finally { setBusy(false); }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.on("payment.failed", r => { setError(r.error.description || "The payment failed. No money was taken."); setBusy(false); });
      rzp.open();
    } catch (err) { setError(err instanceof Error ? err.message : "Payment could not be started"); setBusy(false); }
  }

  return (
    <form onSubmit={pay} className="panel mb-4 p-5">
      <div className="flex items-center gap-2 font-medium"><CreditCard size={16} />Add credits</div>
      <p className="mt-1 text-sm text-muted">Pay with UPI, card, netbanking or wallet through Razorpay. 1 credit = ₹1. Credits appear as soon as the payment is confirmed.</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted">Amount (₹)
          <input className={`${inputCls} w-36`} type="number" min={100} max={500000} step={1} value={amount} onChange={e => setAmount(e.target.value)} required />
        </label>
        {PRESETS.map(p => <button type="button" key={p} onClick={() => setAmount(String(p))} className={`rounded-full border px-3 py-1.5 text-sm ${amount === String(p) ? "border-navy bg-navy text-bg" : "border-line"}`}>₹{p.toLocaleString("en-IN")}</button>)}
        <button disabled={busy} className="ml-auto inline-flex items-center gap-2 rounded-full bg-navy px-5 py-2 text-sm font-semibold text-bg disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" />}Pay ₹{Number(amount || 0).toLocaleString("en-IN")}</button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
    </form>
  );
}
