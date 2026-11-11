"use client";
import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import { Badge, Empty, PageTitle } from "@/components/ui";
import { useApi } from "@/lib/api-client";
import { BANDS, type PublicStation } from "@/lib/assets";

export default function Stations() {
  const data = useApi<{ stations: PublicStation[] }>("/api/v1/stations");
  const [band, setBand] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const list = (data?.stations ?? []).filter(s => (!band || s.bands.includes(band)) && (!maxPrice || s.pricePerPass <= +maxPrice));
  const inp = "rounded-lg border border-line bg-bg2 px-3 py-2 text-sm";
  return (
    <>
      <PageTitle title="Ground stations" sub="Every station listed here belongs to an owner whose identity, ownership and operating authorisations have been verified." />
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <select className={inp} value={band} onChange={e => setBand(e.target.value)} aria-label="Band"><option value="">All bands</option>{BANDS.map(b => <option key={b}>{b}</option>)}</select>
        <label className="text-muted">Max price <input type="number" min={0} className={inp + " w-24"} value={maxPrice} onChange={e => setMaxPrice(e.target.value)} /></label>
      </div>
      {data === undefined && <div className="skeleton h-40" />}
      {data && data.stations.length === 0 && <Empty title="No verified stations yet">Stations appear here once their owners pass verification and the station is approved.</Empty>}
      {data && data.stations.length > 0 && list.length === 0 && <Empty title="No stations match these filters" />}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map(s => (
          <div key={s.id} className="grad-border lift p-5">
            <div className="flex items-start justify-between gap-2"><div><div className="font-medium">{s.name}</div><div className="text-sm text-muted">{s.country} · {s.latitude.toFixed(2)}°, {s.longitude.toFixed(2)}°</div></div><Badge tone="ok"><BadgeCheck size={12} className="mr-1 inline" />verified</Badge></div>
            <div className="mt-3 text-sm text-slate-300">{s.antennaType} · {s.antennaSizeM} m</div>
            <div className="mt-1 text-xs text-muted">Operated by {s.ownerName}</div>
            <div className="mt-2 text-xs">{s.reliability?.score != null
              ? <>Reliability <b className="text-emerald-400">{s.reliability.score}/100</b> · {s.reliability.completed} passes · {s.reliability.avgDelivery?.toFixed(1)}% avg delivery</>
              : <span className="text-muted">New station — no completed passes yet</span>}</div>
            <div className="mt-3 flex flex-wrap gap-1.5">{s.bands.map(b => <Badge key={b}>{b}</Badge>)}{s.protocols.map(p => <Badge key={p}>{p}</Badge>)}</div>
            <div className="mono mt-4 border-t border-line pt-3 text-sm">{s.pricePerPass.toFixed(2)} <span className="text-muted">/ pass</span></div>
          </div>
        ))}
      </div>
    </>
  );
}
