"use client";
import Link from "next/link";
import { BadgeCheck, ShieldAlert } from "lucide-react";
import { PageTitle, Stat, StatusPill } from "@/components/ui";
import { useApi } from "@/lib/api-client";
import type { OwnedStation } from "@/lib/assets";
import { BADGE_LABEL, DEFAULT_SETUP, badgeStates } from "@/lib/verification/requirements";
import { useVerification } from "@/lib/verification/store";

export default function StationOwner() {
  const v = useVerification();
  const st = useApi<{ stations: OwnedStation[] }>("/api/stations");
  const setup = v?.setup ?? DEFAULT_SETUP;
  const badges = badgeStates("station", setup, v?.subs ?? {});
  const approved = v?.decision?.status === "approved";
  const active = st?.stations.filter(s => s.status === "active").length ?? 0;

  return (
    <>
      <PageTitle title="Station owner overview" />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {v === undefined || st === undefined ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-24" />) : <>
          <Stat label="Verification" value={approved ? "Approved" : `${badges.filter(b => b.earned).length}/3 badges`} tone={approved ? "ok" : "warn"} />
          <Stat label="My stations" value={String(st?.stations.length ?? 0)} hint={`${active} live in marketplace`} />
          <Stat label="Completed passes" value="0" />
          <Stat label="Earnings" value="0.00" hint="no settled passes yet" />
        </>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <div className="eyebrow mb-3">Verification</div>
          {badges.map(b => (
            <div key={b.badge} className="flex items-center justify-between border-t border-line py-2.5 text-sm">
              <span className="flex items-center gap-2">{b.earned ? <BadgeCheck size={16} className="text-emerald-400" /> : <ShieldAlert size={16} className="text-muted" />}{BADGE_LABEL(b.badge, setup)}</span>
              <span className="mono text-xs text-muted">{b.approved}/{b.total}</span>
            </div>
          ))}
          <Link href="/dashboard/verification" className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm">{approved ? "View verification" : "Continue verification"}</Link>
        </div>
        <div className="panel p-5">
          <div className="mb-3 flex items-center justify-between"><div className="eyebrow">My stations</div><Link href="/dashboard/station-owner/stations" className="text-xs text-cyan hover:underline">Manage</Link></div>
          {st?.stations.length === 0 && <p className="py-6 text-center text-sm text-muted">No stations registered yet. <Link href="/dashboard/station-owner/stations" className="text-cyan underline">Register one</Link></p>}
          {st?.stations.map(s => <div key={s.id} className="flex items-center justify-between border-t border-line py-2.5 text-sm"><div><div>{s.name}</div><div className="text-xs text-muted">{s.country} · {s.bands.join("/")}</div></div><StatusPill status={s.status} /></div>)}
        </div>
      </div>
    </>
  );
}
