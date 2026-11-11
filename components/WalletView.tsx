"use client";
import { Badge, Empty, Stat, fmtTime } from "@/components/ui";
import { useApi } from "@/lib/api-client";
import { money } from "@/lib/bookings-shared";

interface W { balance: number; inEscrow: number; entries: { id: string; type: string; amount: number; balanceAfter: number | null; note: string | null; at: number }[] }
const LABEL: Record<string, string> = { credit_grant: "Credits added", escrow_lock: "Escrow locked", payout: "Pass payout", refund: "Refund", adjustment: "Adjustment", platform_fee: "Platform fee" };

export function WalletView({ role }: { role: "operator" | "owner" }) {
  const w = useApi<W>("/api/wallet");
  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {w === undefined ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-24" />) : <>
          <Stat label={role === "operator" ? "Available credits" : "Earned credits"} value={money(w?.balance ?? 0)} tone="ok" />
          {role === "operator" && <Stat label="Held in escrow" value={money(w?.inEscrow ?? 0)} hint="released when passes settle" />}
          <Stat label="Transactions" value={String(w?.entries.length ?? 0)} />
        </>}
      </div>
      <div className="panel mb-4 p-4 text-sm text-muted">
        {role === "operator"
          ? "Credits are added by OrbitPass after payment (contact support with your invoice). Booking a pass locks its price in escrow; you're refunded automatically for undelivered frames, cancellations and passes the station doesn't deliver."
          : "You're paid in credits for every verified frame, minus the platform fee. Contact support to withdraw earnings."}
      </div>
      {w?.entries.length === 0 && <Empty title="No transactions yet" />}
      {!!w?.entries.length && (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted"><tr>{["Date (UTC)", "Type", "Details", "Amount", "Balance"].map(h => <th key={h} className="px-4 py-3 font-normal">{h}</th>)}</tr></thead>
            <tbody>{w.entries.map(e => (
              <tr key={e.id} className="border-t border-line">
                <td className="mono px-4 py-2.5 text-xs">{fmtTime(e.at)}</td>
                <td className="px-4 py-2.5"><Badge tone={e.amount >= 0 ? "ok" : "warn"}>{LABEL[e.type] ?? e.type}</Badge></td>
                <td className="px-4 py-2.5 text-xs text-muted">{e.note}</td>
                <td className={`mono px-4 py-2.5 ${e.amount >= 0 ? "text-emerald-400" : "text-amber-300"}`}>{e.amount >= 0 ? "+" : ""}{money(e.amount)}</td>
                <td className="mono px-4 py-2.5">{e.balanceAfter === null ? "—" : money(e.balanceAfter)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}
