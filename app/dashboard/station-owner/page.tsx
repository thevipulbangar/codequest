"use client";
import Link from "next/link";
import { BadgeCheck, ShieldAlert } from "lucide-react";
import { PageTitle, Stat } from "@/components/ui";
import { BADGE_LABEL, DEFAULT_SETUP, badgeStates, docsFor } from "@/lib/verification/requirements";
import { useVerification } from "@/lib/verification/store";

export default function StationOwner() {
  const v = useVerification();
  const setup = v?.setup ?? DEFAULT_SETUP;
  const subs = v?.subs ?? {};
  const docs = docsFor("station", setup);
  const badges = badgeStates("station", setup, subs);
  const approved = docs.filter(d => subs[d.id]?.status === "approved").length;
  const inReview = docs.filter(d => subs[d.id]?.status === "submitted").length;
  const verified = badges.every(b => b.earned);

  return (
    <>
      <PageTitle title="Station owner overview" sub="Your verification status. Earnings and bookings appear once your station is verified and listed." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {v === undefined ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-24" />) : <>
          <Stat label="Badges earned" value={`${badges.filter(b => b.earned).length}/3`} tone={verified ? "ok" : undefined} />
          <Stat label="Documents approved" value={`${approved}/${docs.length}`} />
          <Stat label="In review" value={String(inReview)} tone={inReview ? "warn" : undefined} />
          <Stat label="Earnings" value="0.00 tUSD" hint="no settled passes yet" />
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
          <Link href="/dashboard/verification" className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm">{verified ? "View verification" : "Continue verification"}</Link>
        </div>
        <div className="panel p-6 text-center">
          <div className="text-sm font-medium">No stations listed yet</div>
          <p className="mt-1 text-sm text-muted">Once all three badges are approved you’ll be able to register a station, set availability and pricing, and start earning from passes.</p>
        </div>
      </div>
    </>
  );
}
