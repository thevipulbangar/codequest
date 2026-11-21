import Link from "next/link";
import { money } from "@/lib/bookings-shared";

export interface ContractView {
  id: string; status: "active" | "fulfilled" | "missed" | "cancelled";
  health: "fulfilled" | "on_track" | "at_risk" | "missed" | "cancelled";
  satellite: { id: string; name: string; noradId: number; band: string };
  targetMB: number; rateKbps: number; minElDeg: number; deadline: number; createdAt: number; closedAt: number | null;
  passCost: number; premium: number; compensation: number; confidence: number;
  verifiedMB: number; pendingMB: number; expectedMB: number; passesLeft: number; pct: number;
  passes: { id: string; station: string; aos: number; los: number; maxElDeg: number; price: number; status: string; backup: boolean; plannedMB: number; deliveryBps: number | null }[];
}

export const HEALTH: Record<ContractView["health"], { label: string; cls: string; bar: string }> = {
  fulfilled: { label: "Fulfilled", cls: "bg-emerald-500/10 text-emerald-400", bar: "bg-emerald-500" },
  on_track: { label: "On track", cls: "bg-emerald-500/10 text-emerald-400", bar: "bg-cyan" },
  at_risk: { label: "At risk", cls: "bg-amber-500/10 text-amber-400", bar: "bg-amber-500" },
  missed: { label: "Missed · compensated", cls: "bg-red-500/10 text-red-400", bar: "bg-red-500" },
  cancelled: { label: "Cancelled", cls: "bg-white/5 text-muted", bar: "bg-slate-300" },
};

const left = (t: number) => {
  const ms = t - Date.now();
  if (ms <= 0) return "deadline passed";
  const h = Math.floor(ms / 3600_000);
  return h >= 48 ? `${Math.floor(h / 24)} days left` : `${h} h ${Math.floor((ms % 3600_000) / 60_000)} min left`;
};

/** "320 of 500 MB verified · 3 passes left · on track" */
export function ContractProgress({ c, link }: { c: ContractView; link?: boolean }) {
  const h = HEALTH[c.health];
  const expectedPct = Math.min(100, (c.expectedMB / c.targetMB) * 100);
  const body = (
    <div className="panel p-5 transition hover:border-accent/40">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium">{c.targetMB} MB from {c.satellite.name} <span className="text-muted">by {new Date(c.deadline).toISOString().slice(0, 16).replace("T", " ")} UTC</span></div>
          <div className="mono mt-0.5 text-xs text-muted">NORAD {c.satellite.noradId} · {c.satellite.band} band · {left(c.deadline)}</div>
        </div>
        <span className={`mono rounded px-2 py-0.5 text-xs ${h.cls}`}>{h.label}</span>
      </div>
      <div className="relative mt-4 h-2.5 overflow-hidden rounded-full bg-black/10" role="img" aria-label={`${c.verifiedMB.toFixed(1)} of ${c.targetMB} MB verified`}>
        <div className="absolute inset-y-0 left-0 rounded-full bg-cyan/25" style={{ width: `${expectedPct}%` }} />
        <div className={`absolute inset-y-0 left-0 rounded-full ${h.bar}`} style={{ width: `${c.pct}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm">
        <span><b className="mono">{c.verifiedMB.toFixed(1)}</b> of {c.targetMB} MB verified · {c.passesLeft} {c.passesLeft === 1 ? "pass" : "passes"} left</span>
        <span className="text-xs text-muted">{c.status === "missed" ? `${money(c.compensation)} credits compensation paid` : `expected ${c.expectedMB.toFixed(1)} MB · bought at ${(c.confidence * 100).toFixed(1)}% confidence`}</span>
      </div>
    </div>
  );
  return link ? <Link href={`/dashboard/operator/contracts/${c.id}`} className="block">{body}</Link> : body;
}
