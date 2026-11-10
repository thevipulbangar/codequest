"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, PageTitle, Stat, fmtTime } from "@/components/ui";
import type { NetworkStats } from "@/lib/orbital/stats";

interface P { id: string; satellite: string; station: string; aos: number; maxElDeg: number; price: number }

export default function OperatorOverview() {
  const [passes, setPasses] = useState<P[] | null>(null);
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [now] = useState(() => Date.now());
  useEffect(() => {
    fetch("/api/v1/passes?minEl=20&hours=12").then(r => r.json()).then(d => setPasses(d.passes.slice(0, 5))).catch(() => setPasses([]));
    fetch("/api/v1/network-stats").then(r => r.json()).then(setStats).catch(() => setStats(null));
  }, []);
  const next = stats?.nextPass;
  const mins = next ? Math.max(0, Math.round((next.aos - now) / 60000)) : null;

  return (
    <>
      <PageTitle title="Operator overview" sub="Network figures are computed live from public orbital data (SGP4 on CelesTrak TLEs). Booking and wallet figures start at zero until you book." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats ? <>
          <Stat label="Passes, next 24 h (≥10°)" value={String(stats.passes24h)} hint="live SGP4" />
          <Stat label="Contact time, next 24 h" value={`${stats.contactMin24h.toLocaleString("en-US")} min`} hint="all station–satellite pairs" />
          <Stat label="Next pass (≥10°)" value={mins === null ? "—" : `${mins} min`} hint={next ? `${next.satellite} · ${next.station}` : undefined} />
          <Stat label="Satellites tracked" value={String(stats.satellites)} hint={stats.source === "sample" ? "DEMO TLE fallback" : "CelesTrak"} />
        </> : Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-24" />)}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-4">
          <div className="mb-3 flex items-center justify-between"><div className="eyebrow">Upcoming passes ≥20° (live)</div><Link href="/dashboard/operator/find-pass" className="text-xs text-cyan hover:underline">Find more</Link></div>
          {passes === null && Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton mb-2 h-10" />)}
          {passes?.length === 0 && <div className="py-8 text-center text-sm text-muted">No passes ≥20° in the next 12 hours.</div>}
          {passes?.map(p => <div key={p.id} className="flex items-center justify-between border-t border-line py-2.5 text-sm"><div><div>{p.satellite}</div><div className="text-xs text-muted">{p.station}</div></div><div className="text-right"><div className="mono">{fmtTime(p.aos)}</div><Badge>{p.maxElDeg}° max</Badge></div></div>)}
        </div>
        <div className="panel p-4">
          <div className="eyebrow mb-3">Predicted contact minutes per station, next 24 h</div>
          {stats ? (
            <div className="h-64"><ResponsiveContainer><BarChart data={stats.perStation.map(s => ({ n: s.name.split(" ")[0], v: s.contactMin }))}><XAxis dataKey="n" stroke="#8b97a8" fontSize={12} tickLine={false} axisLine={false} /><YAxis stroke="#8b97a8" fontSize={12} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: "#101722", border: "1px solid #1c2636", borderRadius: 8 }} cursor={{ fill: "#ffffff08" }} formatter={v => [`${v} min`, "Contact"]} /><Bar dataKey="v" fill="#3b82f6" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
          ) : <div className="skeleton h-64" />}
        </div>
        <div className="panel overflow-x-auto p-4 lg:col-span-2">
          <div className="eyebrow mb-3">Satellites right now (computed position)</div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted"><tr>{["Satellite", "NORAD", "Latitude", "Longitude", "Altitude", "Speed"].map(h => <th key={h} className="py-2 font-normal">{h}</th>)}</tr></thead>
            <tbody>
              {!stats && <tr><td colSpan={6}><div className="skeleton h-24" /></td></tr>}
              {stats?.live.map(s => <tr key={s.norad} className="border-t border-line"><td className="py-2">{s.name}</td><td className="mono">{s.norad}</td><td className="mono">{s.lat.toFixed(2)}°</td><td className="mono">{s.lon.toFixed(2)}°</td><td className="mono">{s.altKm.toFixed(0)} km</td><td className="mono">{s.speedKmS.toFixed(2)} km/s</td></tr>)}
            </tbody>
          </table>
        </div>
        <div className="panel p-6 text-center lg:col-span-2">
          <div className="text-sm font-medium">No bookings yet</div>
          <p className="mt-1 text-sm text-muted">Your bookings, escrow balance and settlements will appear here once the booking flow is live.</p>
          <Link href="/dashboard/operator/find-pass" className="mt-3 inline-block rounded-lg bg-accent px-4 py-2 text-sm">Find a pass</Link>
        </div>
      </div>
    </>
  );
}
