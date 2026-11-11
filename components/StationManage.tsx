"use client";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Trash2 } from "lucide-react";
import { fmtTime } from "@/components/ui";
import { api, revalidate, useApi } from "@/lib/api-client";
import type { OwnedStation } from "@/lib/assets";

/** Signing key + unavailable periods for one station. */
export function StationManage({ s }: { s: OwnedStation }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [blk, setBlk] = useState({ start: "", end: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const blocksUrl = `/api/stations/${s.id}/blocks`;
  const blocks = useApi<{ blocks: { id: string; start: number; end: number; reason: string | null }[] }>(open ? blocksUrl : null);

  async function run(fn: () => Promise<unknown>, ok: string, refresh: string) {
    setBusy(true);
    try { await fn(); await revalidate(refresh); toast.success(ok); return true; }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); return false; }
    finally { setBusy(false); }
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <button onClick={() => setOpen(!open)} className="text-xs text-cyan underline underline-offset-4">{open ? "Hide settings" : "Signing key & availability"}</button>
      {!s.hasKey && !open && <span className="ml-2 text-xs text-amber-300">· signing key needed to get paid</span>}
      {open && (
        <div className="mt-3 space-y-4 text-sm">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs text-muted"><KeyRound size={13} />Receipt signing key {s.hasKey ? <span className="text-emerald-400">· registered</span> : <span className="text-amber-300">· not set</span>}</div>
            <div className="flex gap-2">
              <input value={key} onChange={e => setKey(e.target.value)} placeholder="Paste the public key from scripts/station-keygen.mjs" className="mono min-w-0 flex-1 rounded-lg border border-line bg-bg2 px-3 py-2 text-xs outline-none focus:border-accent" />
              <button disabled={busy || !key.trim()} onClick={async () => { if (await run(() => api(`/api/stations/${s.id}/key`, { method: "PUT", json: { publicKey: key.trim() } }), s.hasKey ? "Key rotated" : "Key registered", "/api/stations")) setKey(""); }} className="rounded-lg bg-accent px-3 text-xs disabled:opacity-40">{s.hasKey ? "Rotate" : "Save"}</button>
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs text-muted">Unavailable periods (your local time) — no bookings are accepted in these windows</div>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <input type="datetime-local" value={blk.start} onChange={e => setBlk({ ...blk, start: e.target.value })} className="rounded-lg border border-line bg-bg2 px-2 py-1.5 text-xs" aria-label="From" />
              <input type="datetime-local" value={blk.end} onChange={e => setBlk({ ...blk, end: e.target.value })} className="rounded-lg border border-line bg-bg2 px-2 py-1.5 text-xs" aria-label="Until" />
              <input value={blk.reason} onChange={e => setBlk({ ...blk, reason: e.target.value })} placeholder="Reason (optional)" className="rounded-lg border border-line bg-bg2 px-2 py-1.5 text-xs" />
              <button disabled={busy || !blk.start || !blk.end} onClick={async () => { if (await run(() => api(blocksUrl, { json: { start: new Date(blk.start).getTime(), end: new Date(blk.end).getTime(), reason: blk.reason || undefined } }), "Period blocked", blocksUrl)) setBlk({ start: "", end: "", reason: "" }); }} className="rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-40">Block</button>
            </div>
            <div className="mt-2 space-y-1">
              {blocks === undefined && <div className="skeleton h-6" />}
              {blocks?.blocks.length === 0 && <p className="text-xs text-muted">No upcoming blocked periods — the station is bookable at all predicted passes.</p>}
              {blocks?.blocks.map(b => (
                <div key={b.id} className="flex items-center justify-between rounded bg-white/3 px-2 py-1 text-xs">
                  <span className="mono">{fmtTime(b.start)} → {fmtTime(b.end)}{b.reason ? ` · ${b.reason}` : ""}</span>
                  <button aria-label="Remove block" disabled={busy} onClick={() => run(() => api(`${blocksUrl}?blockId=${b.id}`, { method: "DELETE" }), "Removed", blocksUrl)} className="text-muted hover:text-red-300"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
