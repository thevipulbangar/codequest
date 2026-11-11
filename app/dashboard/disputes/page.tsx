"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Badge, Empty, PageTitle, fmtTime } from "@/components/ui";
import { api, revalidate, useApi } from "@/lib/api-client";
import { money } from "@/lib/bookings-shared";
import { useSession } from "@/lib/session";

interface D {
  id: string; status: "open" | "resolved" | "rejected"; reason: string; evidence: string | null; resolution: string | null;
  refundAmount: number | null; createdAt: number; resolvedAt: number | null; raisedBy: string;
  booking: { id: string; satellite: string; station: string; aos: number; deliveryBps: number | null; stationNet: number | null; price: number };
}
const URL = "/api/disputes";
const TONE = { open: "warn", resolved: "ok", rejected: "muted" } as const;

export default function Disputes() {
  const session = useSession();
  const data = useApi<{ disputes: D[] }>(URL);
  const admin = session?.role === "admin";
  return (
    <div className="max-w-4xl">
      <PageTitle title="Disputes" sub={admin ? "Review evidence and decide. A refund moves credits from the station's payout back to the operator." : "Disputes can be raised from a settled booking within 24 hours. An admin reviews every case."} />
      {data === undefined && <div className="skeleton h-32" />}
      {data?.disputes.length === 0 && <Empty title="No disputes" />}
      <div className="space-y-3">{data?.disputes.map(d => <DisputeCard key={d.id} d={d} admin={admin} />)}</div>
    </div>
  );
}

function DisputeCard({ d, admin }: { d: D; admin: boolean }) {
  const [resolution, setResolution] = useState("");
  const [refund, setRefund] = useState("0");
  const [busy, setBusy] = useState(false);
  async function decide(status: "resolved" | "rejected") {
    setBusy(true);
    try { await api(`/api/admin/disputes/${d.id}`, { json: { status, resolution, refundAmount: status === "resolved" ? Number(refund) || 0 : 0 } }); await revalidate(URL); toast.success("Dispute closed"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }
  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium">{d.booking.satellite} → {d.booking.station}</div>
          <div className="mono text-xs text-muted">pass {fmtTime(d.booking.aos)} · delivered {d.booking.deliveryBps != null ? (d.booking.deliveryBps / 100).toFixed(2) + "%" : "—"} · station paid {d.booking.stationNet != null ? money(d.booking.stationNet) : "—"} of {money(d.booking.price)}</div>
          <div className="mt-0.5 text-xs text-muted">Raised by {d.raisedBy} · {fmtTime(d.createdAt)}</div>
        </div>
        <Badge tone={TONE[d.status]}>{d.status}</Badge>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm">{d.reason}</p>
      {d.evidence && <p className="mt-2 whitespace-pre-wrap rounded bg-white/3 p-2 text-xs text-muted">{d.evidence}</p>}
      {d.status !== "open" && <p className="mt-3 text-sm"><b>Decision:</b> {d.resolution}{d.refundAmount ? ` — ${money(d.refundAmount)} credits refunded to the operator.` : ""}</p>}
      {admin && d.status === "open" && (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          <textarea value={resolution} onChange={e => setResolution(e.target.value)} rows={2} placeholder="Decision and reasoning (shared with both parties)" className="w-full rounded-lg border border-line bg-bg2 px-3 py-2 text-sm outline-none focus:border-accent" />
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-muted">Refund to operator <input type="number" min={0} max={d.booking.stationNet ?? 0} step="0.01" value={refund} onChange={e => setRefund(e.target.value)} className="ml-1 w-28 rounded-lg border border-line bg-bg2 px-2 py-1.5 text-sm" /></label>
            <button disabled={busy || resolution.trim().length < 10} onClick={() => decide("resolved")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs disabled:opacity-40">Resolve</button>
            <button disabled={busy || resolution.trim().length < 10} onClick={() => decide("rejected")} className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs text-red-300 disabled:opacity-40">Reject dispute</button>
          </div>
        </div>
      )}
    </div>
  );
}
