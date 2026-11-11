"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Badge, Empty, PageTitle, fmtTime } from "@/components/ui";
import { api, revalidate, useApi } from "@/lib/api-client";
import { money } from "@/lib/bookings-shared";
import type { OwnedSatellite, PublicStation } from "@/lib/assets";

interface P { id: string; satelliteId: string; stationId: string; satellite: string; station: string; band: string; aos: number; los: number; maxElDeg: number; durationS: number; price: number }
interface R { passes: P[]; activeSatellites: number; activeStations: number; tleUnavailable: string[] }
type Sort = "aos" | "maxElDeg" | "price" | "durationS";

export default function FindPass() {
  const sats = useApi<{ satellites: OwnedSatellite[] }>("/api/satellites");
  const stations = useApi<{ stations: PublicStation[] }>("/api/v1/stations");
  const [f, setF] = useState({ satelliteId: "", stationId: "", minEl: "10", hours: "24", maxPrice: "" });
  const [sort, setSort] = useState<Sort>("aos");
  const [page, setPage] = useState(0);
  const q = new URLSearchParams({ minEl: f.minEl || "0", hours: f.hours || "24" });
  if (f.satelliteId) q.set("satelliteId", f.satelliteId);
  if (f.stationId) q.set("stationId", f.stationId);
  const passesUrl = `/api/v1/passes?${q}`;
  const res = useApi<R>(passesUrl);
  const wallet = useApi<{ balance: number }>("/api/wallet");
  const [booking, setBooking] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const router = useRouter();
  const [nlq, setNlq] = useState("");
  const [nl, setNl] = useState<{ passes: P[]; understood: string[]; note?: string } | null>(null);
  const [nlBusy, setNlBusy] = useState(false);

  async function book(p: P) {
    const bal = wallet?.balance ?? 0;
    if (bal < p.price) return toast.error(`You need ${money(p.price)} credits (you have ${money(bal)}). Contact support to add credits.`);
    if (!confirm(`Book ${p.satellite} via ${p.station}\n${fmtTime(p.aos)} · max ${p.maxElDeg}°\n\n${money(p.price)} credits will be held in escrow until the pass is verified.`)) return;
    setBooking(p.id);
    try {
      await api("/api/bookings", { json: { satelliteId: p.satelliteId, stationId: p.stationId, aos: p.aos } });
      await Promise.all([revalidate("/api/wallet"), revalidate(passesUrl)]);
      toast.success("Booked! Commit your frame manifest before the pass starts.", { action: { label: "My bookings", onClick: () => router.push("/dashboard/operator/bookings") } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Booking failed"); }
    finally { setBooking(null); }
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (nlq.trim().length < 3) return;
    setNlBusy(true);
    try { const d = await api<{ passes: P[]; filters: { understood: string[] }; note?: string }>("/api/v1/passes/search", { json: { query: nlq } }); setNl({ passes: d.passes, understood: d.filters.understood, note: d.note }); setPage(0); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Search failed"); }
    finally { setNlBusy(false); }
  }

  const rows = useMemo(() => (nl?.passes ?? res?.passes ?? [])
    .filter(p => !f.maxPrice || p.price <= +f.maxPrice)
    .sort((a, b) => sort === "aos" ? a.aos - b.aos : sort === "price" ? a.price - b.price : b[sort] - a[sort]), [res, nl, f.maxPrice, sort]);
  const PER = 10, pages = Math.max(1, Math.ceil(rows.length / PER));
  const active = sats?.satellites.filter(s => s.status === "active") ?? [];
  const inp = "w-full rounded-lg border border-line bg-bg2 px-3 py-2 text-sm outline-none focus:border-accent";
  const upd = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setF({ ...f, [k]: e.target.value }); setPage(0); };

  return (
    <>
      <PageTitle title="Find passes" sub="Real SGP4 predictions from live CelesTrak orbits, for your active satellites over active, verified ground stations." />

      {sats !== undefined && active.length === 0 && (
        <Empty title="No active satellites yet">
          Passes are predicted for your own satellites once they’re verified and activated. <Link href="/dashboard/operator/satellites" className="text-cyan underline">Register a satellite</Link>
        </Empty>
      )}

      {active.length > 0 && <>
        <form onSubmit={ask} className="panel mb-3 flex flex-wrap items-center gap-2 p-3">
          <Sparkles size={16} className="text-cyan" />
          <input value={nlq} onChange={e => setNlq(e.target.value)} placeholder="Try: next pass over India above 30 degrees for UHF band before 18:00 UTC" className="min-w-0 flex-1 bg-transparent text-sm outline-none" aria-label="Describe the pass you need" />
          <button disabled={nlBusy} className="rounded-lg bg-accent px-3 py-1.5 text-xs disabled:opacity-50">{nlBusy ? <Loader2 size={13} className="animate-spin" /> : "Search"}</button>
          {nl && <button type="button" onClick={() => { setNl(null); setNlq(""); }} className="rounded-lg border border-line px-3 py-1.5 text-xs">Clear</button>}
        </form>
        {nl && <p className="mb-3 text-xs text-muted">Understood: {nl.understood.length ? nl.understood.join(" · ") : "nothing specific — showing your next passes"}{nl.note ? ` — ${nl.note}` : ""}</p>}
        <div className={`panel mb-4 grid${nl ? " pointer-events-none opacity-40" : ""} grid-cols-2 gap-3 p-4 md:grid-cols-5`}>
          <label className="text-xs text-muted">Satellite<select className={inp} value={f.satelliteId} onChange={upd("satelliteId")}><option value="">All my satellites</option>{active.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className="text-xs text-muted">Station<select className={inp} value={f.stationId} onChange={upd("stationId")}><option value="">All stations</option>{stations?.stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className="text-xs text-muted">Min elevation °<input type="number" min={0} max={90} className={inp} value={f.minEl} onChange={upd("minEl")} /></label>
          <label className="text-xs text-muted">Window (hours)<input type="number" min={1} max={72} className={inp} value={f.hours} onChange={upd("hours")} /></label>
          <label className="text-xs text-muted">Max price<input type="number" min={0} className={inp} value={f.maxPrice} onChange={upd("maxPrice")} /></label>
        </div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>{res?.tleUnavailable?.length ? <Badge tone="warn">No current orbit for: {res.tleUnavailable.join(", ")}</Badge> : null}</span>
          <label>Sort <select className="ml-1 rounded border border-line bg-bg2 px-2 py-1" value={sort} onChange={e => setSort(e.target.value as Sort)}><option value="aos">Soonest</option><option value="maxElDeg">Max elevation</option><option value="durationS">Longest</option><option value="price">Price</option></select></label>
        </div>
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted"><tr>{["Satellite", "Station", "AOS (UTC)", "LOS (UTC)", "Max el", "Duration", "Band", "Price", ""].map(h => <th key={h} className="px-4 py-3 font-normal">{h}</th>)}</tr></thead>
            <tbody>
              {res === undefined && Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={9} className="px-4 py-2"><div className="skeleton h-6" /></td></tr>)}
              {res === null && <tr><td colSpan={9} className="px-4 py-10 text-center text-red-400">Couldn’t load passes.</td></tr>}
              {res && res.activeStations === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-muted">No verified ground stations are active yet. Passes will appear as stations are approved.</td></tr>}
              {res && res.activeStations > 0 && rows.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-muted">No passes match. Lower the minimum elevation or widen the window.</td></tr>}
              {rows.slice(page * PER, page * PER + PER).map(p => (
                <tr key={p.id} className="border-t border-line hover:bg-white/3">
                  <td className="px-4 py-3">{p.satellite}</td><td className="px-4 py-3">{p.station}</td>
                  <td className="mono px-4 py-3">{fmtTime(p.aos)}</td><td className="mono px-4 py-3">{fmtTime(p.los)}</td>
                  <td className="mono px-4 py-3">{p.maxElDeg}°</td><td className="mono px-4 py-3">{Math.floor(p.durationS / 60)}m {p.durationS % 60}s</td>
                  <td className="px-4 py-3"><Badge>{p.band}</Badge></td><td className="mono px-4 py-3">{p.price.toFixed(2)}</td>
                  <td className="px-4 py-3"><button disabled={!!booking || p.aos < now + 10 * 60_000} onClick={() => book(p)} className="rounded-lg bg-accent px-3 py-1.5 text-xs disabled:opacity-40">{booking === p.id ? "Booking…" : "Book"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>{rows.length} passes · balance {wallet ? money(wallet.balance) : "…"} credits</span>
          <span className="flex items-center gap-2"><button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded border border-line px-3 py-1 disabled:opacity-30">Prev</button>{page + 1}/{pages}<button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} className="rounded border border-line px-3 py-1 disabled:opacity-30">Next</button></span>
        </div>
      </>}
    </>
  );
}
