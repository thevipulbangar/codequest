"use client";
import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import { Badge, PageTitle } from "@/components/ui";
import { STATIONS } from "@/lib/orbital/catalog";

export default function Stations() {
  const [band, setBand] = useState("");
  const [minRel, setMinRel] = useState(0);
  const [maxPrice, setMaxPrice] = useState(200);
  const list = STATIONS.filter(s => (!band || (s.bands as readonly string[]).includes(band)) && s.reliability >= minRel && s.pricePerPass <= maxPrice).sort((a, b) => b.reliability - a.reliability);
  const inp = "rounded-lg border border-line bg-bg2 px-3 py-2 text-sm";
  return (
    <>
      <PageTitle title="Ground stations" sub="Real coordinates; owner, pricing and performance figures are sample data." />
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <select className={inp} value={band} onChange={e => setBand(e.target.value)}><option value="">All bands</option>{["VHF", "UHF", "S", "X"].map(b => <option key={b}>{b}</option>)}</select>
        <label className="text-muted">Min reliability <input type="number" min={0} max={100} className={inp + " w-20"} value={minRel} onChange={e => setMinRel(+e.target.value)} /></label>
        <label className="text-muted">Max price <input type="number" min={0} className={inp + " w-20"} value={maxPrice} onChange={e => setMaxPrice(+e.target.value)} /></label>
      </div>
      {list.length === 0 && <div className="panel p-10 text-center text-muted">No stations match these filters.</div>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map(s => (
          <div key={s.id} className="grad-border lift p-5">
            <div className="flex items-start justify-between"><div><div className="font-medium">{s.name}</div><div className="text-sm text-muted">{s.country} · {s.lat.toFixed(2)}°, {s.lon.toFixed(2)}°</div></div>{s.verified ? <Badge tone="ok"><BadgeCheck size={12} className="mr-1 inline" />verified</Badge> : <Badge tone="warn">pending</Badge>}</div>
            <div className="mt-3 text-sm text-slate-300">{s.antenna} · {s.diameterM} m</div>
            <div className="mt-3 flex flex-wrap gap-1.5">{s.bands.map(b => <Badge key={b}>{b}</Badge>)}{s.protocols.map(p => <Badge key={p}>{p}</Badge>)}</div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center"><div><div className="text-lg font-semibold">{s.reliability}</div><div className="text-[11px] text-muted">RELIABILITY</div></div><div><div className="text-lg font-semibold">{s.avgDelivery}%</div><div className="text-[11px] text-muted">AVG DELIVERY</div></div><div><div className="text-lg font-semibold">{s.completed}</div><div className="text-[11px] text-muted">PASSES</div></div></div>
            <div className="mono mt-4 border-t border-line pt-3 text-sm">{s.pricePerPass} tUSD <span className="text-muted">/ pass</span></div>
          </div>
        ))}
      </div>
    </>
  );
}
