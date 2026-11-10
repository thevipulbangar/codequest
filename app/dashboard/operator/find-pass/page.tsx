"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge, PageTitle, fmtTime } from "@/components/ui";
import { SATELLITES, STATIONS } from "@/lib/orbital/catalog";

interface P { id: string; satellite: string; station: string; band: string; aos: number; los: number; maxElDeg: number; durationS: number; estFrames: number; price: number; reliability: number }
type Sort = "aos" | "maxElDeg" | "price" | "reliability";

export default function FindPass() {
  const [f, setF] = useState({ norad: "", station: "", minEl: "10", hours: "24", maxPrice: "", minRel: "0" });
  const [sort, setSort] = useState<Sort>("aos");
  const [page, setPage] = useState(0);
  const [state, setState] = useState<{ loading: boolean; error?: string; passes: P[]; src?: string }>({ loading: true, passes: [] });

  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: undefined }));
    const q = new URLSearchParams({ minEl: f.minEl, hours: f.hours });
    if (f.norad) q.set("norad", f.norad);
    if (f.station) q.set("station", f.station);
    try {
      const r = await fetch(`/api/v1/passes?${q}`);
      const d = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(d.error));
      setState({ loading: false, passes: d.passes, src: d.dataSource });
      setPage(0);
    } catch (e) { setState({ loading: false, passes: [], error: String(e) }); toast.error("Pass search failed"); }
  }, [f.norad, f.station, f.minEl, f.hours]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on filter change
  useEffect(() => { load(); }, [load]);

  const rows = state.passes
    .filter(p => (!f.maxPrice || p.price <= +f.maxPrice) && p.reliability >= +f.minRel)
    .sort((a, b) => sort === "aos" ? a.aos - b.aos : sort === "price" ? a.price - b.price : (b[sort] as number) - (a[sort] as number));
  const PER = 10, pages = Math.max(1, Math.ceil(rows.length / PER));
  const inp = "w-full rounded-lg border border-line bg-bg2 px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <>
      <PageTitle title="Find passes" sub="Real SGP4 pass prediction from live CelesTrak TLEs over each station's actual coordinates." />
      <div className="panel mb-4 grid grid-cols-2 gap-3 p-4 md:grid-cols-3 lg:grid-cols-6">
        <label className="text-xs text-muted">Satellite<select className={inp} value={f.norad} onChange={e => setF({ ...f, norad: e.target.value })}><option value="">All</option>{SATELLITES.map(s => <option key={s.norad} value={s.norad}>{s.name}</option>)}</select></label>
        <label className="text-xs text-muted">Station<select className={inp} value={f.station} onChange={e => setF({ ...f, station: e.target.value })}><option value="">All</option>{STATIONS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="text-xs text-muted">Min elevation °<input type="number" min={0} max={90} className={inp} value={f.minEl} onChange={e => setF({ ...f, minEl: e.target.value })} /></label>
        <label className="text-xs text-muted">Window (hours)<input type="number" min={1} max={72} className={inp} value={f.hours} onChange={e => setF({ ...f, hours: e.target.value })} /></label>
        <label className="text-xs text-muted">Max price<input type="number" min={0} className={inp} value={f.maxPrice} onChange={e => setF({ ...f, maxPrice: e.target.value })} /></label>
        <label className="text-xs text-muted">Min reliability<input type="number" min={0} max={100} className={inp} value={f.minRel} onChange={e => setF({ ...f, minRel: e.target.value })} /></label>
      </div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>{state.src ? <Badge tone={state.src.startsWith("DEMO") ? "warn" : "ok"}>{state.src}</Badge> : null}</span>
        <label>Sort <select className="ml-1 rounded border border-line bg-bg2 px-2 py-1" value={sort} onChange={e => setSort(e.target.value as Sort)}><option value="aos">Soonest</option><option value="maxElDeg">Max elevation</option><option value="price">Price</option><option value="reliability">Reliability</option></select></label>
      </div>
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted"><tr>{["Satellite", "Station", "AOS (UTC)", "LOS (UTC)", "Max el", "Duration", "Band", "Est. frames", "Price", "Reliability"].map(h => <th key={h} className="px-4 py-3 font-normal">{h}</th>)}</tr></thead>
          <tbody>
            {state.loading && Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={10} className="px-4 py-2"><div className="skeleton h-6" /></td></tr>)}
            {!state.loading && state.error && <tr><td colSpan={10} className="px-4 py-10 text-center text-red-400">Couldn’t load passes. <button onClick={load} className="underline">Retry</button></td></tr>}
            {!state.loading && !state.error && rows.length === 0 && <tr><td colSpan={10} className="px-4 py-10 text-center text-muted">No passes match. Lower the minimum elevation or widen the window.</td></tr>}
            {!state.loading && rows.slice(page * PER, page * PER + PER).map(p => (
              <tr key={p.id} className="border-t border-line hover:bg-white/3">
                <td className="px-4 py-3">{p.satellite}</td><td className="px-4 py-3">{p.station}</td>
                <td className="mono px-4 py-3">{fmtTime(p.aos)}</td><td className="mono px-4 py-3">{fmtTime(p.los)}</td>
                <td className="mono px-4 py-3">{p.maxElDeg}°</td><td className="mono px-4 py-3">{Math.floor(p.durationS / 60)}m {p.durationS % 60}s</td>
                <td className="px-4 py-3"><Badge>{p.band}</Badge></td><td className="mono px-4 py-3">{p.estFrames}</td>
                <td className="mono px-4 py-3">{p.price} tUSD</td><td className="px-4 py-3"><Badge tone={p.reliability >= 90 ? "ok" : p.reliability >= 80 ? "warn" : "bad"}>{p.reliability}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>{rows.length} passes · est. frames, price and reliability are sample marketplace data</span>
        <span className="flex items-center gap-2"><button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded border border-line px-3 py-1 disabled:opacity-30">Prev</button>{page + 1}/{pages}<button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} className="rounded border border-line px-3 py-1 disabled:opacity-30">Next</button></span>
      </div>
    </>
  );
}

