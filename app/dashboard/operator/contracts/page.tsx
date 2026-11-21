"use client";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { Empty, PageTitle, inputCls } from "@/components/ui";
import { ContractProgress, type ContractView } from "@/components/ContractProgress";
import { api, revalidate, useApi } from "@/lib/api-client";
import { money } from "@/lib/bookings-shared";
import type { OwnedSatellite } from "@/lib/assets";

interface Quote {
  passes: { station: string; aos: number; los: number; maxElDeg: number; durationS: number; price: number; mb: number; p: number; backup: boolean }[];
  capacityMB: number; expectedMB: number; confidence: number; passCost: number; premium: number; total: number;
}

const URL = "/api/contracts";
/** Typical downlink rates, so operators don't have to know them by heart. */
const RATE_HINT: Record<string, number> = { VHF: 9.6, UHF: 9.6, L: 665, S: 2000, X: 150000, Ku: 300000, Ka: 1000000 };
const localInput = (t: number) => new Date(t - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const utc = (t: number) => new Date(t).toISOString().slice(5, 16).replace("T", " ") + " UTC";

export default function Contracts() {
  const sats = useApi<{ satellites: OwnedSatellite[] }>("/api/satellites");
  const list = useApi<{ contracts: ContractView[] }>(URL);
  const wallet = useApi<{ balance: number }>("/api/wallet");
  const active = sats?.satellites.filter(s => s.status === "active") ?? [];
  const [f, setF] = useState({ satelliteId: "", targetMB: "5", rateKbps: "", deadline: localInput(Date.now() + 3 * 24 * 3600_000), minElDeg: "10", compensation: "" });
  const [q, setQ] = useState<Quote | null>(null);
  const [busy, setBusy] = useState<"quote" | "buy" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sat = active.find(s => s.id === (f.satelliteId || active[0]?.id));
  const input = () => ({
    satelliteId: sat?.id ?? "", targetMB: Number(f.targetMB), rateKbps: Number(f.rateKbps || RATE_HINT[sat?.band ?? "UHF"]),
    deadline: new Date(f.deadline).getTime(), minElDeg: Number(f.minElDeg), compensation: Number(f.compensation || 0),
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setF({ ...f, [k]: e.target.value }); setQ(null); };

  async function getQuote(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy("quote");
    try { setQ((await api<{ quote: Quote }>(`${URL}/quote`, { json: input() })).quote); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not plan this contract"); }
    finally { setBusy(null); }
  }
  async function buy() {
    if (!q) return;
    setBusy("buy");
    try {
      await api(URL, { json: { ...input(), expectedTotal: q.total } });
      await Promise.all([revalidate(URL), revalidate("/api/wallet"), revalidate("/api/bookings")]);
      toast.success("Guarantee active. Every planned pass is booked and in escrow.");
      setQ(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Purchase failed"); }
    finally { setBusy(null); }
  }

  const short = q && wallet ? wallet.balance < q.total : false;
  return (
    <div className="max-w-5xl">
      <PageTitle title="Guaranteed Downlink" sub="Order a volume of data by a deadline instead of single passes. OrbitPass plans the cheapest set of passes across every station, reserves backups, re-books failures automatically, and pays you the agreed compensation if the deadline is missed." />

      {sats !== undefined && active.length === 0 && <Empty title="You need an active satellite first"><Link href="/dashboard/operator/satellites" className="text-cyan underline">Register a satellite</Link> and wait for it to be approved.</Empty>}

      {active.length > 0 && (
        <form onSubmit={getQuote} className="panel grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs text-muted">Satellite
            <select className={inputCls} value={sat?.id} onChange={set("satelliteId")}>{active.map(s => <option key={s.id} value={s.id}>{s.name} · {s.band}</option>)}</select>
          </label>
          <label className="text-xs text-muted">Data to deliver (MB)
            <input className={inputCls} type="number" min="0.1" step="any" value={f.targetMB} onChange={set("targetMB")} required />
          </label>
          <label className="text-xs text-muted">Deadline (your time)
            <input className={inputCls} type="datetime-local" value={f.deadline} onChange={set("deadline")} required />
          </label>
          <label className="text-xs text-muted">Downlink data rate (kbps)
            <input className={inputCls} type="number" min="0.1" step="any" placeholder={`${RATE_HINT[sat?.band ?? "UHF"]} (typical ${sat?.band ?? ""})`} value={f.rateKbps} onChange={set("rateKbps")} />
          </label>
          <label className="text-xs text-muted">Minimum elevation (°)
            <input className={inputCls} type="number" min="0" max="80" value={f.minElDeg} onChange={set("minElDeg")} />
          </label>
          <label className="text-xs text-muted">Compensation if missed (credits)
            <input className={inputCls} type="number" min="0" step="any" placeholder="0" value={f.compensation} onChange={set("compensation")} />
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
            <button disabled={!!busy} className="inline-flex items-center gap-2 rounded-full bg-navy px-5 py-2 text-sm font-semibold text-bg disabled:opacity-50">{busy === "quote" && <Loader2 size={14} className="animate-spin" />}Plan and price</button>
            <span className="text-xs text-muted">Planning predicts every pass with SGP4 up to 7 days ahead. Nothing is booked until you confirm.</span>
          </div>
          {error && <p role="alert" className="text-sm text-red-400 sm:col-span-2 lg:col-span-3">{error}</p>}
        </form>
      )}

      {q && (
        <section className="panel mt-4 p-5" aria-label="Quote">
          <div className="grid gap-4 sm:grid-cols-4">
            <Fig label="Chance of meeting the target" value={`${(q.confidence * 100).toFixed(1)}%`} />
            <Fig label="Planned capacity" value={`${q.capacityMB.toFixed(1)} MB`} hint={`${q.expectedMB.toFixed(1)} MB expected after station reliability`} />
            <Fig label="Passes" value={`${q.passes.filter(p => !p.backup).length} + ${q.passes.filter(p => p.backup).length} backup`} />
            <Fig label="Guarantee price" value={money(q.total)} hint={`${money(q.passCost)} passes + ${money(q.premium)} premium`} />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted"><tr>{["Station", "AOS", "Max el", "Duration", "Carries", "Station success", "Price", ""].map(h => <th key={h} className="py-2 pr-4 font-normal">{h}</th>)}</tr></thead>
              <tbody>{q.passes.map(p => (
                <tr key={`${p.station}${p.aos}`} className="border-t border-line">
                  <td className="py-2 pr-4">{p.station}</td><td className="mono py-2 pr-4">{utc(p.aos)}</td><td className="mono py-2 pr-4">{p.maxElDeg}°</td>
                  <td className="mono py-2 pr-4">{Math.round(p.durationS / 60)} min</td><td className="mono py-2 pr-4">{p.mb.toFixed(1)} MB</td>
                  <td className="mono py-2 pr-4">{Math.round(p.p * 100)}%</td><td className="mono py-2 pr-4">{money(p.price)}</td>
                  <td className="py-2 text-xs">{p.backup ? <span className="text-amber-400">backup</span> : <span className="text-emerald-400">primary</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">Backup passes are released and refunded as soon as the target is verified. If a pass fails, a replacement is booked automatically. The premium funds the compensation reserve and falls with more reliable stations and longer deadlines.</p>
          {short && <p role="alert" className="mt-3 text-sm text-red-400">You have {money(wallet?.balance ?? 0)} credits and this guarantee costs {money(q.total)}.</p>}
          <button onClick={buy} disabled={!!busy || short} className="mt-4 inline-flex items-center gap-2 rounded-full bg-navy px-5 py-2 text-sm font-semibold text-bg disabled:opacity-50">
            {busy === "buy" ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={15} />}Buy guarantee for {money(q.total)} credits
          </button>
        </section>
      )}

      <h2 className="display mt-10 mb-3 text-2xl">Your guarantees</h2>
      {list === undefined && <div className="skeleton h-28" />}
      {list?.contracts.length === 0 && <Empty title="No guarantees yet">Plan one above. Each guarantee shows live progress here.</Empty>}
      <div className="space-y-3">{list?.contracts.map(c => <ContractProgress key={c.id} c={c} link />)}</div>
    </div>
  );
}

function Fig({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div><div className="text-xs text-muted">{label}</div><div className="display mt-1 text-2xl">{value}</div>{hint && <div className="mt-0.5 text-[11px] text-muted">{hint}</div>}</div>;
}
