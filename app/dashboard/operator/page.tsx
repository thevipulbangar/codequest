"use client";
import Link from "next/link";
import { useState } from "react";
import { Badge, Empty, PageTitle, Stat, StatusPill, fmtTime } from "@/components/ui";
import { useApi } from "@/lib/api-client";
import { useVerification } from "@/lib/verification/store";
import { badgeStates, DEFAULT_SETUP } from "@/lib/verification/requirements";
import type { OwnedSatellite } from "@/lib/assets";
import { BOOKING_STATUS, money, type BookingView } from "@/lib/bookings-shared";

interface P { id: string; satellite: string; station: string; aos: number; maxElDeg: number; durationS: number }

export default function OperatorOverview() {
  const sats = useApi<{ satellites: OwnedSatellite[] }>("/api/satellites");
  const passes = useApi<{ passes: P[]; activeStations: number }>("/api/v1/passes?minEl=10&hours=24");
  const v = useVerification();
  const bookings = useApi<{ bookings: BookingView[] }>("/api/bookings");
  const wallet = useApi<{ balance: number; inEscrow: number }>("/api/wallet");
  const [now] = useState(() => Date.now());
  const active = sats?.satellites.filter(s => s.status === "active").length ?? 0;
  const badges = badgeStates("satellite", v?.setup ?? DEFAULT_SETUP, v?.subs ?? {});
  const next = passes?.passes.find(p => p.aos > now);

  return (
    <>
      <PageTitle title="Operator overview" />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {sats === undefined || v === undefined ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-24" />) : <>
          <Stat label="Verification" value={v?.decision?.status === "approved" ? "Approved" : `${badges.filter(b => b.earned).length}/3 badges`} tone={v?.decision?.status === "approved" ? "ok" : "warn"} />
          <Stat label="Credits" value={money(wallet?.balance ?? 0)} hint={`${money(wallet?.inEscrow ?? 0)} in escrow`} />
          <Stat label="My satellites" value={String(sats?.satellites.length ?? 0)} hint={`${active} active`} />
          <Stat label="Next pass" value={next ? `${Math.max(0, Math.round((next.aos - now) / 60000))} min` : "—"} hint={next ? `${next.satellite} · ${next.station}` : undefined} />
        </>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-4">
          <div className="mb-3 flex items-center justify-between"><div className="eyebrow">Upcoming passes</div><Link href="/dashboard/operator/find-pass" className="text-xs text-cyan hover:underline">Find passes</Link></div>
          {passes === undefined && Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton mb-2 h-10" />)}
          {passes && active === 0 && <p className="py-6 text-center text-sm text-muted">Passes appear once one of your satellites is active.</p>}
          {passes && active > 0 && passes.activeStations === 0 && <p className="py-6 text-center text-sm text-muted">No verified ground stations are active yet.</p>}
          {passes?.passes.slice(0, 5).map(p => <div key={p.id} className="flex items-center justify-between border-t border-line py-2.5 text-sm"><div><div>{p.satellite}</div><div className="text-xs text-muted">{p.station}</div></div><div className="text-right"><div className="mono">{fmtTime(p.aos)}</div><Badge>{p.maxElDeg}° max</Badge></div></div>)}
        </div>
        <div className="panel p-4">
          <div className="mb-3 flex items-center justify-between"><div className="eyebrow">My satellites</div><Link href="/dashboard/operator/satellites" className="text-xs text-cyan hover:underline">Manage</Link></div>
          {sats?.satellites.length === 0 && <p className="py-6 text-center text-sm text-muted">No satellites registered yet.</p>}
          {sats?.satellites.slice(0, 6).map(s => <div key={s.id} className="flex items-center justify-between border-t border-line py-2.5 text-sm"><div><div>{s.name}</div><div className="mono text-xs text-muted">NORAD {s.noradId} · {s.band}</div></div><StatusPill status={s.status} /></div>)}
        </div>
        <div className="panel p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between"><div className="eyebrow">Recent bookings</div><Link href="/dashboard/operator/bookings" className="text-xs text-cyan hover:underline">All bookings</Link></div>
          {bookings === undefined && <div className="skeleton h-16" />}
          {bookings?.bookings.length === 0 && <Empty title="No bookings yet">Book a pass from <Link href="/dashboard/operator/find-pass" className="text-cyan underline">Find passes</Link>.</Empty>}
          {bookings?.bookings.slice(0, 5).map(b => (
            <Link key={b.id} href={`/dashboard/live-pass/${b.id}`} className="flex items-center justify-between border-t border-line py-2.5 text-sm hover:bg-white/3">
              <div><div>{b.satellite.name} → {b.station.name}</div><div className="mono text-xs text-muted">{fmtTime(b.aos)}</div></div>
              <div className="text-right"><Badge tone={BOOKING_STATUS[b.status].tone}>{BOOKING_STATUS[b.status].label}</Badge>{b.deliveryBps != null && <div className="mono mt-1 text-xs text-emerald-400">{(b.deliveryBps / 100).toFixed(1)}% delivered</div>}</div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
