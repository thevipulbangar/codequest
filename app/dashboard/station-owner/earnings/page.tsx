"use client";
import { PageTitle, StatusPill } from "@/components/ui";
import { WalletView } from "@/components/WalletView";
import { useApi } from "@/lib/api-client";
import type { OwnedStation } from "@/lib/assets";

export default function Earnings() {
  const st = useApi<{ stations: OwnedStation[] }>("/api/stations");
  return (
    <div className="max-w-5xl">
      <PageTitle title="Earnings & reliability" sub="Payouts for verified frames, and the public reliability score operators see." />
      <WalletView role="owner" />

      <div className="panel mt-6 p-5">
        <div className="eyebrow mb-1">Reliability</div>
        <p className="mb-4 text-xs text-muted">Score = 60% average verified delivery + 30% completion rate (settled ÷ settled + expired) + 10% dispute record (−20 points per dispute lost). New stations show “New” until their first settled pass.</p>
        {st === undefined && <div className="skeleton h-20" />}
        {st?.stations.length === 0 && <p className="text-sm text-muted">No stations yet.</p>}
        <div className="space-y-2">
          {st?.stations.map(s => {
            const r = s.reliability;
            return (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 text-sm">
                <div><div className="font-medium">{s.name}</div><StatusPill status={s.status} /></div>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div><div className="text-xl font-semibold">{r?.score ?? "New"}</div><div className="text-[11px] text-muted">SCORE</div></div>
                  <div><div className="text-xl font-semibold">{r?.avgDelivery != null ? `${r.avgDelivery.toFixed(1)}%` : "—"}</div><div className="text-[11px] text-muted">AVG DELIVERY</div></div>
                  <div><div className="text-xl font-semibold">{r?.completed ?? 0}</div><div className="text-[11px] text-muted">SETTLED</div></div>
                  <div><div className="text-xl font-semibold">{r?.failed ?? 0}</div><div className="text-[11px] text-muted">EXPIRED</div></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
