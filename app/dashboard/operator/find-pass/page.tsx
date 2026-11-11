"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Empty, PageTitle, fmtTime } from "@/components/ui";
import { useApi } from "@/lib/api-client";
import type { OwnedSatellite, PublicStation } from "@/lib/assets";

interface P { id: string; satellite: string; station: string; band: string; aos: number; los: number; maxElDeg: number; durationS: number; price: number }
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
  const res = useApi<R>(`/api/v1/passes?${q}`);

  const rows = useMemo(() => (res?.passes ?? [])
    .filter(p => !f.maxPrice || p.price <= +f.maxPrice)
    .sort((a, b) => sort === "aos" ? a.aos - b.aos : sort === "price" ? a.price - b.price : b[sort] - a[sort]), [res, f.maxPrice, sort]);
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
        <div className="panel mb-4 grid grid-cols-2 gap-3 p-4 md:grid-cols-5">
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
            <thead className="text-left text-xs text-muted"><tr>{["Satellite", "Station", "AOS (UTC)", "LOS (UTC)", "Max el", "Duration", "Band", "Price"].map(h => <th key={h} className="px-4 py-3 font-normal">{h}</th>)}</tr></thead>
            <tbody>
              {res === undefined && Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={8} className="px-4 py-2"><div className="skeleton h-6" /></td></tr>)}
              {res === null && <tr><td colSpan={8} className="px-4 py-10 text-center text-red-400">Couldn’t load passes.</td></tr>}
              {res && res.activeStations === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-muted">No verified ground stations are active yet. Passes will appear as stations are approved.</td></tr>}
              {res && res.activeStations > 0 && rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-muted">No passes match. Lower the minimum elevation or widen the window.</td></tr>}
              {rows.slice(page * PER, page * PER + PER).map(p => (
                <tr key={p.id} className="border-t border-line hover:bg-white/3">
                  <td className="px-4 py-3">{p.satellite}</td><td className="px-4 py-3">{p.station}</td>
                  <td className="mono px-4 py-3">{fmtTime(p.aos)}</td><td className="mono px-4 py-3">{fmtTime(p.los)}</td>
                  <td className="mono px-4 py-3">{p.maxElDeg}°</td><td className="mono px-4 py-3">{Math.floor(p.durationS / 60)}m {p.durationS % 60}s</td>
                  <td className="px-4 py-3"><Badge>{p.band}</Badge></td><td className="mono px-4 py-3">{p.price.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>{rows.length} passes</span>
          <span className="flex items-center gap-2"><button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded border border-line px-3 py-1 disabled:opacity-30">Prev</button>{page + 1}/{pages}<button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} className="rounded border border-line px-3 py-1 disabled:opacity-30">Next</button></span>
        </div>
      </>}
    </>
  );
}
