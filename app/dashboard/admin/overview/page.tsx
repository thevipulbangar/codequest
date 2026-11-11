"use client";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Badge, PageTitle, Stat, fmtTime, inputCls } from "@/components/ui";
import { api, revalidate, useApi } from "@/lib/api-client";
import { money } from "@/lib/bookings-shared";

interface O {
  users: { operator: number; owner: number; admin: number };
  stations: Record<string, number>; satellites: Record<string, number>; bookings: Record<string, number>;
  escrowHeld: number; platformRevenue: number; creditsOutstanding: number; openDisputes: number; pendingDocs: number;
  recent: { id: string; type: string; amount: number; who: string; note: string | null; at: number }[];
  health: { dbQueryMs: number; email: string };
}
const URL = "/api/admin/overview";
const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

export default function AdminOverview() {
  const o = useApi<O>(URL);
  const [g, setG] = useState({ email: "", amount: "", note: "" });
  const [busy, setBusy] = useState(false);

  async function grant(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try { const r = await api<{ balance: number }>("/api/admin/credits", { json: { email: g.email.trim(), amount: Number(g.amount), note: g.note } }); await revalidate(URL); toast.success(`Credited. New balance ${money(r.balance)}`); setG({ email: "", amount: "", note: "" }); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setBusy(false); }
  }

  if (o === undefined) return <div className="skeleton h-40" />;
  if (o === null) return <div className="panel p-8 text-sm text-muted">Admin access only.</div>;
  return (
    <div className="max-w-6xl">
      <PageTitle title="Admin overview" />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Users" value={String(o.users.operator + o.users.owner)} hint={`${o.users.operator} operators · ${o.users.owner} station owners`} />
        <Stat label="Active stations" value={String(o.stations.active ?? 0)} hint={`${o.stations.pending ?? 0} pending · ${sum(o.stations)} total`} />
        <Stat label="Active satellites" value={String(o.satellites.active ?? 0)} hint={`${o.satellites.pending ?? 0} pending · ${sum(o.satellites)} total`} />
        <Stat label="Bookings" value={String(sum(o.bookings))} hint={`${o.bookings.settled ?? 0} settled · ${(o.bookings.confirmed ?? 0) + (o.bookings.manifest_committed ?? 0)} open`} />
        <Stat label="Escrow held" value={money(o.escrowHeld)} />
        <Stat label="Platform revenue" value={money(o.platformRevenue)} tone="ok" />
        <Stat label="Credits outstanding" value={money(o.creditsOutstanding)} hint="owed to users" />
        <Stat label="Needs attention" value={String(o.openDisputes + o.pendingDocs)} tone={o.openDisputes + o.pendingDocs ? "warn" : undefined} hint={`${o.openDisputes} disputes · ${o.pendingDocs} documents`} />
      </div>
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <Link href="/dashboard/admin" className="rounded-lg border border-line px-3 py-1.5 hover:bg-white/5">Verification review</Link>
        <Link href="/dashboard/admin/assets" className="rounded-lg border border-line px-3 py-1.5 hover:bg-white/5">Asset review</Link>
        <Link href="/dashboard/disputes" className="rounded-lg border border-line px-3 py-1.5 hover:bg-white/5">Disputes</Link>
        <span className="ml-auto flex items-center gap-2 text-muted">System: <Badge tone={o.health.dbQueryMs < 1500 ? "ok" : "warn"}>DB {o.health.dbQueryMs} ms</Badge><Badge tone={o.health.email === "configured" ? "ok" : "warn"}>email {o.health.email}</Badge></span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <form onSubmit={grant} className="panel h-fit space-y-3 p-5">
          <div className="eyebrow">Add credits</div>
          <p className="text-xs text-muted">Use after receiving payment off-platform. Recorded in the ledger and audit log.</p>
          <label className="block text-xs text-muted">User email<input className={inputCls} type="email" value={g.email} onChange={e => setG({ ...g, email: e.target.value })} /></label>
          <label className="block text-xs text-muted">Amount<input className={inputCls} inputMode="decimal" value={g.amount} onChange={e => setG({ ...g, amount: e.target.value })} /></label>
          <label className="block text-xs text-muted">Note (invoice / reference)<input className={inputCls} value={g.note} onChange={e => setG({ ...g, note: e.target.value })} /></label>
          <button disabled={busy || !g.email || !(Number(g.amount) > 0) || g.note.trim().length < 3} className="w-full rounded-lg bg-accent py-2.5 text-sm disabled:opacity-40">{busy ? "Adding…" : "Add credits"}</button>
        </form>
        <div className="panel overflow-x-auto p-4">
          <div className="eyebrow mb-3">Recent ledger activity</div>
          {o.recent.length === 0 ? <p className="text-sm text-muted">No transactions yet.</p> : (
            <table className="w-full text-sm"><tbody>{o.recent.map(e => (
              <tr key={e.id} className="border-t border-line"><td className="mono py-2 text-xs">{fmtTime(e.at)}</td><td className="py-2 text-xs">{e.who}</td><td className="py-2"><Badge>{e.type}</Badge></td><td className={`mono py-2 text-right ${e.amount >= 0 ? "text-emerald-400" : "text-amber-300"}`}>{money(e.amount)}</td></tr>
            ))}</tbody></table>
          )}
        </div>
      </div>
    </div>
  );
}
