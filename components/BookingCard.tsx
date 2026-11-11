"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileUp, Radio } from "lucide-react";
import { Badge, fmtTime } from "@/components/ui";
import { api, revalidate } from "@/lib/api-client";
import { BOOKING_STATUS, money, type BookingView } from "@/lib/bookings-shared";

const LIST = "/api/bookings";

async function readJsonFile(f: File): Promise<unknown> {
  if (f.size > 25 * 1024 * 1024) throw new Error("File is larger than 25 MB");
  try { return JSON.parse(await f.text()); } catch { throw new Error("That file isn't valid JSON"); }
}

export function BookingCard({ b }: { b: BookingView }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState("");
  const manifestInput = useRef<HTMLInputElement>(null);
  const receiptInput = useRef<HTMLInputElement>(null);
  const st = BOOKING_STATUS[b.status];

  async function run(key: string, fn: () => Promise<unknown>, okMsg: string) {
    setBusy(key);
    try { await fn(); await revalidate(LIST); toast.success(okMsg); return true; }
    catch (e) { toast.error(e instanceof Error ? e.message : "Something went wrong"); return false; }
    finally { setBusy(null); }
  }
  const upload = (kind: "manifest" | "receipt") => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    await run(kind, async () => api(`/api/bookings/${b.id}/${kind}`, { json: await readJsonFile(f) }),
      kind === "manifest" ? "Manifest committed — it can't be changed now" : "Receipt verified and settled");
  };

  const r = b.report, s = b.settlement;
  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium">{b.satellite.name} <span className="text-muted">→</span> {b.station.name}</div>
          <div className="mono text-xs text-muted">{fmtTime(b.aos)} – {fmtTime(b.los).slice(-6)} · max {b.maxElDeg}° · {b.satellite.band} {b.satellite.downlinkMHz} MHz</div>
          <div className="mt-0.5 text-xs text-muted">{b.role === "station" ? `Operator: ${b.operator}` : `Station: ${b.station.owner} · ${b.station.country}`}</div>
        </div>
        <div className="text-right"><Badge tone={st.tone}>{st.label}</Badge><div className="mono mt-1 text-sm">{money(b.price)} <span className="text-xs text-muted">credits</span></div></div>
      </div>

      {b.manifestRoot && <div className="mono mt-2 truncate text-[11px] text-muted" title={b.manifestRoot}>manifest {b.framesPromised} frames · root {b.manifestRoot}</div>}

      {r && s && (
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-white/3 p-3 text-xs sm:grid-cols-4">
          <div><div className="text-muted">Delivered</div><div className="mono text-base text-emerald-400">{(r.deliveryBps / 100).toFixed(2)}%</div><div className="text-muted">{r.verified}/{r.promised} frames · {r.confidence}</div></div>
          <div><div className="text-muted">Missing / invalid</div><div className="mono text-base">{r.missing.length} / {r.invalidHashes.length + r.timestampViolations.length}</div><div className="text-muted">{r.dopplerAnomalies.length} Doppler flags</div></div>
          <div><div className="text-muted">Station paid</div><div className="mono text-base">{money(s.stationNet)}</div><div className="text-muted">after {money(s.platformFee)} fee</div></div>
          <div><div className="text-muted">Refunded</div><div className="mono text-base text-cyan">{money(s.operatorRefund)}</div><div className="text-muted">for undelivered data</div></div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {b.can.commitManifest && <>
          <input ref={manifestInput} type="file" accept="application/json,.json" hidden onChange={upload("manifest")} />
          <button disabled={!!busy} onClick={() => manifestInput.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs disabled:opacity-50"><FileUp size={13} />{busy === "manifest" ? "Committing…" : "Commit manifest"}</button>
        </>}
        {b.can.submitReceipt && (b.station.hasKey ? <>
          <input ref={receiptInput} type="file" accept="application/json,.json" hidden onChange={upload("receipt")} />
          <button disabled={!!busy} onClick={() => receiptInput.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs disabled:opacity-50"><FileUp size={13} />{busy === "receipt" ? "Verifying…" : "Submit signed receipt"}</button>
        </> : <Link href="/dashboard/station-owner/stations" className="text-xs text-amber-300 underline">Register this station&apos;s signing key to submit receipts</Link>)}
        {b.role === "station" && b.status === "confirmed" && <span className="text-xs text-muted">Waiting for the operator&apos;s manifest.</span>}
        {(b.status === "confirmed" || b.status === "manifest_committed" || b.status === "settled") &&
          <Link href={`/dashboard/live-pass/${b.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-white/5"><Radio size={13} />Live pass</Link>}
        {b.can.claimRefund && <button disabled={!!busy} onClick={() => run("refund", () => api(`/api/bookings/${b.id}/refund`, { method: "POST" }), "Escrow refunded")} className="rounded-lg border border-cyan/50 px-3 py-1.5 text-xs text-cyan">Claim refund (no delivery)</button>}
        {b.can.dispute && !disputeOpen && <button onClick={() => setDisputeOpen(true)} className="rounded-lg border border-amber-500/50 px-3 py-1.5 text-xs text-amber-300">Dispute</button>}
        {b.can.cancel && <button disabled={!!busy} onClick={() => confirm(`Cancel this booking? ${b.role === "station" ? "The operator is refunded in full and it may affect your reliability." : "Your credits are refunded in full."}`) && run("cancel", () => api(`/api/bookings/${b.id}/cancel`, { method: "POST" }), "Booking cancelled and refunded")} className="ml-auto rounded-lg border border-red-500/40 px-3 py-1.5 text-xs text-red-300">Cancel</button>}
      </div>

      {disputeOpen && (
        <div className="mt-3 space-y-2">
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} maxLength={2000} placeholder="What went wrong? (at least 20 characters — include frame ids, logs, times)" className="w-full rounded-lg border border-line bg-bg2 px-3 py-2 text-sm outline-none focus:border-accent" />
          <div className="flex gap-2">
            <button disabled={!!busy || reason.trim().length < 20} onClick={async () => { if (await run("dispute", () => api(`/api/bookings/${b.id}/disputes`, { json: { reason } }), "Dispute submitted — an admin will review it")) { setDisputeOpen(false); setReason(""); } }} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs disabled:opacity-40">Submit dispute</button>
            <button onClick={() => setDisputeOpen(false)} className="rounded-lg border border-line px-3 py-1.5 text-xs">Close</button>
          </div>
          <p className="text-[11px] text-muted">Disputes can be raised within 24 hours of settlement.</p>
        </div>
      )}
    </div>
  );
}
