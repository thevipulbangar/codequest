"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Badge, Empty, PageTitle, StatusPill, inputCls } from "@/components/ui";
import { VerificationGate } from "@/components/VerificationGate";
import { StationManage } from "@/components/StationManage";
import { api, revalidate, useApi } from "@/lib/api-client";
import { BANDS, PROTOCOLS, StationInput, type OwnedStation } from "@/lib/assets";

const URL = "/api/stations";
const EMPTY = { name: "", country: "", latitude: "", longitude: "", altitudeM: "0", antennaType: "", antennaSizeM: "", pricePerPass: "", bands: [] as string[], protocols: [] as string[] };

export default function MyStations() {
  const data = useApi<{ stations: OwnedStation[] }>(URL);
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = StationInput.safeParse(f);
    if (!r.success) return setErrors(Object.fromEntries(r.error.issues.map(i => [String(i.path[0]), i.message])));
    setErrors({}); setBusy(true);
    try { await api(URL, { json: r.data }); await revalidate(URL); setF(EMPTY); toast.success("Station registered — pending review"); }
    catch (err) { setErrors({ form: err instanceof Error ? err.message : "Couldn’t register" }); }
    finally { setBusy(false); }
  }

  async function remove(s: OwnedStation) {
    if (!confirm(`Remove ${s.name}? This can't be undone.`)) return;
    try { await api(`${URL}/${s.id}`, { method: "DELETE" }); await revalidate(URL); toast.success("Removed"); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  function fillMyLocation() {
    if (!navigator.geolocation) return toast.error("Location isn’t available in this browser");
    navigator.geolocation.getCurrentPosition(
      p => setF(x => ({ ...x, latitude: p.coords.latitude.toFixed(5), longitude: p.coords.longitude.toFixed(5), altitudeM: p.coords.altitude ? p.coords.altitude.toFixed(0) : x.altitudeM })),
      () => toast.error("Couldn’t read your location"));
  }

  const err = (k: string) => errors[k] && <p className="mt-1 text-xs text-red-400">{errors[k]}</p>;
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const toggle = (k: "bands" | "protocols", v: string) => setF({ ...f, [k]: f[k].includes(v) ? f[k].filter(x => x !== v) : [...f[k], v] });
  const chips = (k: "bands" | "protocols", opts: readonly string[]) => (
    <div className="mt-1.5 flex flex-wrap gap-1.5">{opts.map(o => (
      <button type="button" key={o} onClick={() => toggle(k, o)} aria-pressed={f[k].includes(o)} className={`mono rounded-md border px-2 py-1 text-xs ${f[k].includes(o) ? "border-accent bg-accent/15 text-white" : "border-line text-muted hover:bg-white/5"}`}>{o}</button>
    ))}</div>
  );

  return (
    <div className="max-w-5xl">
      <PageTitle title="My ground stations" sub="Register the stations you own or are authorised to operate. They appear in the marketplace only after review." />
      <VerificationGate what="stations" />

      <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-3">
          {data === undefined && <div className="skeleton h-32" />}
          {data?.stations.length === 0 && <Empty title="No stations yet">Register your first ground station with the form.</Empty>}
          {data?.stations.map(s => (
            <div key={s.id} className="panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><div className="font-medium">{s.name}</div><div className="text-xs text-muted">{s.country} · {s.latitude.toFixed(4)}°, {s.longitude.toFixed(4)}°</div></div>
                <div className="flex items-center gap-2"><StatusPill status={s.status} /><button onClick={() => remove(s)} aria-label={`Remove ${s.name}`} className="rounded p-1 text-muted hover:text-red-300"><Trash2 size={15} /></button></div>
              </div>
              <div className="mt-2 text-xs text-slate-300">{s.antennaType} · {s.antennaSizeM} m</div>
              <div className="mt-2 flex flex-wrap gap-1.5">{s.bands.map(b => <Badge key={b}>{b}</Badge>)}{s.protocols.map(p => <Badge key={p}>{p}</Badge>)}</div>
              <div className="mono mt-2 text-sm">{s.pricePerPass.toFixed(2)} <span className="text-xs text-muted">per pass</span></div>
              {s.reviewNote && <div className="mt-2 text-xs text-amber-300">Reviewer: {s.reviewNote}</div>}
              <StationManage s={s} />
            </div>
          ))}
        </div>

        <form onSubmit={submit} className="panel h-fit space-y-3 p-5" noValidate>
          <div className="eyebrow">Register a station</div>
          <label className="block text-xs text-muted">Station name<input className={inputCls} value={f.name} onChange={set("name")} />{err("name")}</label>
          <label className="block text-xs text-muted">Country<input className={inputCls} value={f.country} onChange={set("country")} />{err("country")}</label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-muted">Latitude<input className={inputCls} inputMode="decimal" value={f.latitude} onChange={set("latitude")} placeholder="12.97160" />{err("latitude")}</label>
            <label className="block text-xs text-muted">Longitude<input className={inputCls} inputMode="decimal" value={f.longitude} onChange={set("longitude")} placeholder="77.59460" />{err("longitude")}</label>
          </div>
          <button type="button" onClick={fillMyLocation} className="text-xs text-cyan underline underline-offset-4">Use my current location</button>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-muted">Altitude (m)<input className={inputCls} inputMode="decimal" value={f.altitudeM} onChange={set("altitudeM")} />{err("altitudeM")}</label>
            <label className="block text-xs text-muted">Antenna size (m)<input className={inputCls} inputMode="decimal" value={f.antennaSizeM} onChange={set("antennaSizeM")} />{err("antennaSizeM")}</label>
          </div>
          <label className="block text-xs text-muted">Antenna type<input className={inputCls} value={f.antennaType} onChange={set("antennaType")} placeholder="Parabolic dish, Yagi, helical…" />{err("antennaType")}</label>
          <div className="text-xs text-muted">Supported bands{chips("bands", BANDS)}{err("bands")}</div>
          <div className="text-xs text-muted">Supported protocols{chips("protocols", PROTOCOLS)}{err("protocols")}</div>
          <label className="block text-xs text-muted">Price per pass<input className={inputCls} inputMode="decimal" value={f.pricePerPass} onChange={set("pricePerPass")} />{err("pricePerPass")}</label>
          <button disabled={busy} className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium hover:bg-blue-500 disabled:opacity-50">{busy ? "Registering…" : "Register station"}</button>
          {errors.form && <p role="alert" className="text-xs text-red-400">{errors.form}</p>}
        </form>
      </div>
    </div>
  );
}
