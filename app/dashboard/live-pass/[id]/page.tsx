"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, PageTitle, Stat, fmtTime } from "@/components/ui";
import { useApi } from "@/lib/api-client";
import { BOOKING_STATUS, type BookingView } from "@/lib/bookings-shared";

type Look = { t: number; az: number; el: number; rangeKm: number };
type Track = { available: boolean; step: number; station: { name: string }; points: Look[] };
const rad = (d: number) => (d * Math.PI) / 180;

/** Position at time t, linearly interpolated from the server's 5 s SGP4 samples (null outside the window). */
function lookAt(pts: Look[], t: number): Look | null {
  if (!pts.length || t < pts[0].t || t > pts[pts.length - 1].t) return null;
  const i = pts.findIndex(p => p.t >= t);
  if (i <= 0) return pts[Math.max(0, i)];
  const a = pts[i - 1], b = pts[i], f = (t - a.t) / (b.t - a.t);
  let daz = b.az - a.az; if (daz > 180) daz -= 360; if (daz < -180) daz += 360; // wrap through north
  return { t, az: (a.az + f * daz + 360) % 360, el: a.el + f * (b.el - a.el), rangeKm: a.rangeKm + f * (b.rangeKm - a.rangeKm) };
}
const clock = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return `${h ? h + "h " : ""}${String(m).padStart(2, "0")}m ${String(x).padStart(2, "0")}s`; };

export default function LivePass() {
  const { id } = useParams<{ id: string }>();
  const data = useApi<{ booking: BookingView }>(`/api/bookings/${id}`);
  const track = useApi<Track>(`/api/bookings/${id}/track`);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const b = data?.booking;
  const path = useMemo(() => (track && b ? track.points.filter(p => p.t >= b.aos && p.t <= b.los) : []), [track, b]);
  const cur = track ? lookAt(track.points, now) : null;

  if (data === undefined || track === undefined) return <div className="skeleton h-64" />;
  if (!b || !track) return <div className="panel p-8 text-sm text-muted">Booking not found.</div>;

  const phase = now < b.aos ? "before" : now <= b.los ? "during" : "after";
  const R = 130, C = 150;
  const xy = (az: number, el: number) => { const r = ((90 - Math.max(0, el)) / 90) * R, a = rad(az); return [C + r * Math.sin(a), C - r * Math.cos(a)] as const; };
  const pathD = path.map((p, i) => `${i ? "L" : "M"}${xy(p.az, p.el).join(" ")}`).join(" ");
  const frames = b.receiptFrames ?? [];
  const chart = frames.map(f => ({ s: Math.round((f.t - b.aos) / 1000), rssi: f.rssi }));

  return (
    <div className="max-w-6xl">
      <div className="mb-2 text-xs"><Link href={b.role === "station" ? "/dashboard/station-owner/bookings" : "/dashboard/operator/bookings"} className="text-cyan hover:underline">← Bookings</Link></div>
      <PageTitle title={`${b.satellite.name} → ${b.station.name}`} sub={`${fmtTime(b.aos)} – ${fmtTime(b.los)} · predicted max elevation ${b.maxElDeg}° · ${b.satellite.band} ${b.satellite.downlinkMHz} MHz`} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={BOOKING_STATUS[b.status].tone}>{BOOKING_STATUS[b.status].label}</Badge>
        {phase === "during" && <span className="flex items-center gap-2 text-sm text-emerald-400"><span className="pulse-dot" />Satellite in view</span>}
        {!track.available && <Badge tone="warn">No current orbit available — position unavailable</Badge>}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={phase === "before" ? "AOS in" : phase === "during" ? "LOS in" : "Pass ended"} value={phase === "before" ? clock(b.aos - now) : phase === "during" ? clock(b.los - now) : clock(now - b.los) + " ago"} />
        <Stat label="Elevation now" value={cur ? `${cur.el.toFixed(1)}°` : "—"} tone={cur && cur.el > 0 ? "ok" : undefined} hint={!cur || cur.el <= 0 ? "below the horizon" : undefined} />
        <Stat label="Azimuth now" value={cur ? `${cur.az.toFixed(0)}°` : "—"} />
        <Stat label="Range now" value={cur ? `${Math.round(cur.rangeKm).toLocaleString("en-US")} km` : "—"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="panel p-3">
          <div className="eyebrow mb-1">Sky track from {b.station.name}</div>
          <svg viewBox="0 0 300 300" className="w-full" role="img" aria-label="Polar sky plot of the satellite's path">
            {[0, 30, 60].map(el => <circle key={el} cx={C} cy={C} r={((90 - el) / 90) * R} fill="none" stroke="#1c2636" />)}
            <line x1={C} y1={C - R} x2={C} y2={C + R} stroke="#1c2636" /><line x1={C - R} y1={C} x2={C + R} y2={C} stroke="#1c2636" />
            {[["N", C, C - R - 6], ["E", C + R + 8, C + 4], ["S", C, C + R + 14], ["W", C - R - 8, C + 4]].map(([t, x, y]) => <text key={t as string} x={x as number} y={y as number} fill="#8b97a8" fontSize="11" textAnchor="middle">{t}</text>)}
            {pathD && <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2" />}
            {path[0] && <circle cx={xy(path[0].az, path[0].el)[0]} cy={xy(path[0].az, path[0].el)[1]} r="3" fill="#22d3ee" />}
            {cur && cur.el > 0 && <circle cx={xy(cur.az, cur.el)[0]} cy={xy(cur.az, cur.el)[1]} r="6" fill="#fff" stroke="#22d3ee" strokeWidth="2"><animate attributeName="r" values="5;8;5" dur="1.5s" repeatCount="indefinite" /></circle>}
          </svg>
          <p className="text-[11px] text-muted">Rings: 0°, 30°, 60° elevation · centre = overhead. Computed with SGP4 from the current public orbit.</p>
        </div>

        <div className="panel p-4">
          {b.status === "settled" && b.report ? <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="eyebrow">Received frames (signed station receipt)</div>
              <span className="mono text-sm">{b.report.verified}/{b.report.promised} verified · {(b.report.deliveryBps / 100).toFixed(2)}%</span>
            </div>
            <div className="mb-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-emerald-500" style={{ width: `${b.report.deliveryBps / 100}%` }} /></div>
            <div className="h-56"><ResponsiveContainer><LineChart data={chart}><CartesianGrid stroke="#1c2636" /><XAxis dataKey="s" stroke="#8b97a8" fontSize={11} tickFormatter={v => `${v}s`} /><YAxis stroke="#8b97a8" fontSize={11} domain={["auto", "auto"]} unit=" dBm" width={70} /><Tooltip contentStyle={{ background: "#101722", border: "1px solid #1c2636", borderRadius: 8 }} formatter={v => [`${v} dBm`, "RSSI"]} labelFormatter={v => `T+${v}s`} /><Line dataKey="rssi" stroke="#22d3ee" dot={false} strokeWidth={2} /></LineChart></ResponsiveContainer></div>
            {b.report.missing.length > 0 && <p className="mono mt-2 text-xs text-muted">Missing frames: {b.report.missing.slice(0, 40).join(", ")}{b.report.missing.length > 40 ? " …" : ""}</p>}
          </> : (
            <div className="grid h-full place-items-center py-10 text-center text-sm text-muted">
              {phase === "before" && (b.status === "confirmed" ? "Waiting for the operator’s frame manifest. The station tracks the satellite at AOS." : "Manifest committed. The station will track the satellite when it rises.")}
              {phase === "during" && "Pass in progress — the station is receiving. Frames appear here after the station submits its signed receipt."}
              {phase === "after" && (b.status === "manifest_committed" ? "Pass complete — waiting for the station’s signed receipt (up to 24 h)." : b.status === "confirmed" ? "No manifest was committed before the pass, so it can’t be verified." : "This booking was closed without a delivery.")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
