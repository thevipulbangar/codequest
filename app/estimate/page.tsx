"use client";
import Link from "next/link";
import { useState } from "react";
import { Loader2, LocateFixed } from "lucide-react";
import { PublicShell } from "@/components/PublicShell";
import { inputCls } from "@/components/ui";
import { api } from "@/lib/api-client";
import { BANDS } from "@/lib/assets";
import { money } from "@/lib/bookings-shared";

interface Estimate {
  bands: string[]; price: number; feeBps: number; passesPerWeek: number; demandPassesPerWeek: number; window: string;
  perSat: { name: string; norad: number; source: "orbitpass" | "reference"; bands: string[]; passesPerWeek: number | null; avgMinutes: number | null }[];
  scenarios: { share: number; passesPerWeek: number; creditsPerWeek: number; creditsPerMonth: number }[];
}

export default function EstimatePage() {
  const [f, setF] = useState({ lat: "12.97", lon: "77.59", altM: "900", price: "50", minEl: "10" });
  const [bands, setBands] = useState<string[]>(["VHF", "UHF"]);
  const [res, setRes] = useState<Estimate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const toggle = (b: string) => setBands(x => (x.includes(b) ? x.filter(y => y !== b) : [...x, b]));

  function locate() {
    navigator.geolocation?.getCurrentPosition(p => setF(x => ({ ...x, lat: p.coords.latitude.toFixed(4), lon: p.coords.longitude.toFixed(4), altM: String(Math.round(p.coords.altitude ?? Number(x.altM))) })), () => setError("Location permission was refused. Type the coordinates instead."));
  }
  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const q = new URLSearchParams({ ...f, bands: bands.join(",") });
      setRes((await api<{ estimate: Estimate }>(`/api/v1/estimate?${q}`)).estimate);
    } catch (err) { setError(err instanceof Error ? err.message : "Estimate failed"); }
    finally { setBusy(false); }
  }

  return (
    <PublicShell eyebrow="For ground-station owners · no sign-up needed" title="What could your antenna earn?"
      sub="Enter where the antenna is and what it can receive. OrbitPass predicts every pass over it for the coming days with SGP4 and turns that into a weekly estimate.">
      <form onSubmit={run} className="panel grid gap-4 p-5 sm:grid-cols-3">
        <label className="text-xs text-muted">Latitude<input className={inputCls} value={f.lat} onChange={set("lat")} inputMode="decimal" required /></label>
        <label className="text-xs text-muted">Longitude<input className={inputCls} value={f.lon} onChange={set("lon")} inputMode="decimal" required /></label>
        <label className="text-xs text-muted">Altitude (m)<input className={inputCls} value={f.altM} onChange={set("altM")} inputMode="numeric" /></label>
        <fieldset className="sm:col-span-3">
          <legend className="text-xs text-muted">Bands the antenna receives</legend>
          <div className="mt-2 flex flex-wrap gap-2">{BANDS.map(b => (
            <button type="button" key={b} onClick={() => toggle(b)} aria-pressed={bands.includes(b)} className={`rounded-full border px-3 py-1 text-sm ${bands.includes(b) ? "border-navy bg-navy text-bg" : "border-line"}`}>{b}</button>
          ))}</div>
        </fieldset>
        <label className="text-xs text-muted">Your price per pass (credits)<input className={inputCls} value={f.price} onChange={set("price")} inputMode="decimal" /></label>
        <label className="text-xs text-muted">Minimum elevation (°)<input className={inputCls} value={f.minEl} onChange={set("minEl")} inputMode="numeric" /></label>
        <div className="flex items-end gap-2">
          <button type="button" onClick={locate} className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm"><LocateFixed size={14} />Use my location</button>
        </div>
        <div className="sm:col-span-3">
          <button disabled={busy || !bands.length} className="inline-flex items-center gap-2 rounded-full bg-navy px-5 py-2 text-sm font-semibold text-bg disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" />}{busy ? "Predicting passes" : "Estimate earnings"}</button>
          {error && <p role="alert" className="mt-2 text-sm text-red-400">{error}</p>}
        </div>
      </form>

      {res && (
        <div className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {res.scenarios.map(s => (
              <div key={s.share} className="panel p-4">
                <div className="text-xs text-muted">If {Math.round(s.share * 100)}% of passes are booked</div>
                <div className="display mt-1 text-3xl">{money(s.creditsPerMonth)}</div>
                <div className="mt-0.5 text-xs text-muted">credits a month · {s.passesPerWeek} passes a week</div>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted">{res.passesPerWeek} passes a week over your antenna in {res.bands.join(", ")}{res.demandPassesPerWeek ? `, ${res.demandPassesPerWeek} of them by satellites already on OrbitPass` : ""}. Earnings are after the {res.feeBps / 100}% platform fee at {money(res.price)} credits a pass, assuming full delivery.</p>
          <div className="panel overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted"><tr>{["Satellite", "Band", "Passes / week", "Average pass", "Source"].map(h => <th key={h} className="px-4 py-3 font-normal">{h}</th>)}</tr></thead>
              <tbody>{res.perSat.map(s => (
                <tr key={s.norad} className="border-t border-line">
                  <td className="px-4 py-2.5">{s.name} <span className="mono text-xs text-muted">{s.norad}</span></td>
                  <td className="px-4 py-2.5">{s.bands.join(", ")}</td>
                  <td className="mono px-4 py-2.5">{s.passesPerWeek ?? "orbit unavailable"}</td>
                  <td className="mono px-4 py-2.5">{s.avgMinutes != null ? `${s.avgMinutes} min` : "–"}</td>
                  <td className="px-4 py-2.5 text-xs">{s.source === "orbitpass" ? <span className="text-emerald-400">on OrbitPass</span> : <span className="text-muted">reference</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {res.perSat.length === 0 && <p className="text-sm text-muted">No reference satellites for these bands yet. Demand appears here as operators register satellites in them.</p>}
          <p className="text-xs text-muted">{res.window}. Reference satellites are well-known public missions that downlink in these bands; they show what your sky can hear, not guaranteed bookings.</p>
          <Link href="/login?as=owner&mode=signup" className="inline-flex rounded-full bg-navy px-5 py-2 text-sm font-semibold text-bg">List this station</Link>
        </div>
      )}
    </PublicShell>
  );
}
