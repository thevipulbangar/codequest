"use client";
import { useState } from "react";
import { Empty } from "@/components/ui";
import { BookingCard } from "@/components/BookingCard";
import { useApi } from "@/lib/api-client";
import type { BookingView } from "@/lib/bookings-shared";

const TABS = { action: "Needs action", upcoming: "Upcoming", settled: "Settled", closed: "Cancelled / expired" } as const;
type Tab = keyof typeof TABS;

export function BookingsList({ empty }: { empty: React.ReactNode }) {
  const data = useApi<{ bookings: BookingView[] }>("/api/bookings");
  const [tab, setTab] = useState<Tab>("action");
  const [now] = useState(() => Date.now());
  const all = data?.bookings ?? [];
  const pick: Record<Tab, (b: BookingView) => boolean> = {
    action: b => Object.values(b.can).some(Boolean) && b.status !== "settled" || b.can.dispute,
    upcoming: b => (b.status === "confirmed" || b.status === "manifest_committed") && b.los > now,
    settled: b => b.status === "settled",
    closed: b => b.status === "cancelled" || b.status === "expired",
  };
  const list = all.filter(pick[tab]).sort((a, b) => (tab === "upcoming" ? a.aos - b.aos : b.aos - a.aos));

  if (data === undefined) return <div className="space-y-3"><div className="skeleton h-28" /><div className="skeleton h-28" /></div>;
  if (!all.length) return <Empty title="No bookings yet">{empty}</Empty>;
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(TABS) as Tab[]).map(k => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-lg border px-3 py-1.5 text-sm ${tab === k ? "border-accent bg-accent/10" : "border-line text-muted"}`}>
            {TABS[k]} <span className="mono text-xs text-muted">{all.filter(pick[k]).length}</span>
          </button>
        ))}
      </div>
      {list.length === 0 ? <Empty title="Nothing here" /> : <div className="space-y-3">{list.map(b => <BookingCard key={b.id} b={b} />)}</div>}
    </>
  );
}
