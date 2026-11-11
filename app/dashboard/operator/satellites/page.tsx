"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, Trash2 } from "lucide-react";
import { Empty, PageTitle, StatusPill, inputCls } from "@/components/ui";
import { VerificationGate } from "@/components/VerificationGate";
import { api, revalidate, useApi } from "@/lib/api-client";
import { BANDS, PROTOCOLS, SatelliteInput, type OwnedSatellite } from "@/lib/assets";

const URL = "/api/satellites";
const EMPTY = { name: "", noradId: "", intlDesignator: "", band: "UHF", downlinkMHz: "", protocol: "AX.25" };

export default function MySatellites() {
  const data = useApi<{ satellites: OwnedSatellite[] }>(URL);
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [lookup, setLookup] = useState<string | null>(null);

  async function check() {
    if (!/^\d+$/.test(f.noradId)) return setErrors({ noradId: "Enter a numeric NORAD ID first" });
    setLookup("…");
    try {
      const d = await api<{ found: boolean; celestrak?: { name: string; internationalDesignator: string } }>(`/api/v1/satellite-check?norad=${f.noradId}`);
      if (d.found && d.celestrak) { setF(x => ({ ...x, name: x.name || d.celestrak!.name, intlDesignator: x.intlDesignator || d.celestrak!.internationalDesignator })); setLookup(`Found in public catalogue: ${d.celestrak.name} (${d.celestrak.internationalDesignator}). This confirms identity only, not ownership.`); }
      else setLookup("No public record found for this NORAD ID.");
    } catch { setLookup("Lookup failed — try again."); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = SatelliteInput.safeParse(f);
    if (!r.success) return setErrors(Object.fromEntries(r.error.issues.map(i => [String(i.path[0]), i.message])));
    setErrors({}); setBusy(true);
    try { await api(URL, { json: r.data }); await revalidate(URL); setF(EMPTY); setLookup(null); toast.success("Satellite registered — pending review"); }
    catch (err) { setErrors({ form: err instanceof Error ? err.message : "Couldn’t register" }); }
    finally { setBusy(false); }
  }

  async function remove(s: OwnedSatellite) {
    if (!confirm(`Remove ${s.name}? This can't be undone.`)) return;
    try { await api(`${URL}/${s.id}`, { method: "DELETE" }); await revalidate(URL); toast.success("Removed"); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  const err = (k: string) => errors[k] && <p className="mt-1 text-xs text-red-400">{errors[k]}</p>;
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="max-w-5xl">
      <PageTitle title="My satellites" sub="Register the satellites you own or are authorised to operate. Each one is reviewed before you can book passes for it." />
      <VerificationGate what="satellites" />

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-3">
          {data === undefined && <div className="skeleton h-32" />}
          {data?.satellites.length === 0 && <Empty title="No satellites yet">Register your first satellite with the form.</Empty>}
          {data?.satellites.map(s => (
            <div key={s.id} className="panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><div className="font-medium">{s.name}</div><div className="mono text-xs text-muted">NORAD {s.noradId}{s.intlDesignator ? ` · ${s.intlDesignator}` : ""}</div></div>
                <div className="flex items-center gap-2"><StatusPill status={s.status} /><button onClick={() => remove(s)} aria-label={`Remove ${s.name}`} className="rounded p-1 text-muted hover:text-red-300"><Trash2 size={15} /></button></div>
              </div>
              <div className="mono mt-2 text-xs text-slate-300">{s.band} · {s.downlinkMHz} MHz · {s.protocol}</div>
              {s.reviewNote && <div className="mt-2 text-xs text-amber-300">Reviewer: {s.reviewNote}</div>}
            </div>
          ))}
        </div>

        <form onSubmit={submit} className="panel h-fit space-y-3 p-5" noValidate>
          <div className="eyebrow">Register a satellite</div>
          <label className="block text-xs text-muted">NORAD catalogue ID
            <div className="flex gap-2"><input className={inputCls} inputMode="numeric" value={f.noradId} onChange={set("noradId")} placeholder="e.g. 25544" />
              <button type="button" onClick={check} className="mt-1.5 shrink-0 rounded-lg border border-line px-3 text-xs hover:bg-white/5" aria-label="Look up public record">{lookup === "…" ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}</button></div>
            {err("noradId")}</label>
          {lookup && lookup !== "…" && <p className="text-xs text-muted">{lookup}</p>}
          <label className="block text-xs text-muted">Name<input className={inputCls} value={f.name} onChange={set("name")} />{err("name")}</label>
          <label className="block text-xs text-muted">International designator (optional)<input className={`${inputCls} uppercase`} value={f.intlDesignator} onChange={set("intlDesignator")} placeholder="1998-067A" />{err("intlDesignator")}</label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-muted">Band<select className={inputCls} value={f.band} onChange={set("band")}>{BANDS.map(b => <option key={b}>{b}</option>)}</select></label>
            <label className="block text-xs text-muted">Protocol<select className={inputCls} value={f.protocol} onChange={set("protocol")}>{PROTOCOLS.map(p => <option key={p}>{p}</option>)}</select></label>
          </div>
          <label className="block text-xs text-muted">Downlink frequency (MHz)<input className={inputCls} inputMode="decimal" value={f.downlinkMHz} onChange={set("downlinkMHz")} placeholder="437.800" />{err("downlinkMHz")}</label>
          <button disabled={busy} className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium hover:bg-blue-500 disabled:opacity-50">{busy ? "Registering…" : "Register satellite"}</button>
          {errors.form && <p role="alert" className="text-xs text-red-400">{errors.form}</p>}
          <p className="text-[11px] text-muted">Ownership is proven through your verification documents. A NORAD ID alone never activates a satellite.</p>
        </form>
      </div>
    </div>
  );
}
