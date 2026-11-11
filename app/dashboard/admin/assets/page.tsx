"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Badge, Empty, PageTitle, StatusPill } from "@/components/ui";
import { api, revalidate, useApi } from "@/lib/api-client";
import type { AssetStatus, OwnedSatellite, OwnedStation } from "@/lib/assets";

type Owner = { id: string; name: string; email: string; company: string | null; verified: boolean };
type Data = { satellites: (OwnedSatellite & { owner: Owner })[]; stations: (OwnedStation & { owner: Owner })[] };
const URL = "/api/admin/assets";

export default function AssetReview() {
  const data = useApi<Data>(URL);
  const [tab, setTab] = useState<"station" | "satellite">("station");
  const [filter, setFilter] = useState<AssetStatus | "all">("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function act(kind: "station" | "satellite", id: string, status: "active" | "rejected" | "suspended") {
    try { await api(`/api/admin/assets/${kind}/${id}`, { json: { status, note: notes[id] } }); await revalidate(URL); toast.success(`Marked ${status}`); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  if (data === undefined) return <div className="skeleton h-40" />;
  if (data === null) return <div className="panel p-8 text-sm text-muted">Admin access only.</div>;

  const rows = (tab === "station" ? data.stations : data.satellites).filter(a => filter === "all" || a.status === filter);
  const count = (k: "station" | "satellite") => (k === "station" ? data.stations : data.satellites).filter(a => a.status === "pending").length;

  return (
    <div className="max-w-5xl">
      <PageTitle title="Asset review" sub="Activate stations and satellites. Activation is only possible once the owner's verification is approved." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["station", "satellite"] as const).map(k => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-lg border px-3 py-2 text-sm ${tab === k ? "border-accent bg-accent/10" : "border-line text-muted"}`}>
            {k === "station" ? "Ground stations" : "Satellites"} {count(k) > 0 && <Badge tone="warn">{count(k)} pending</Badge>}
          </button>
        ))}
        <select value={filter} onChange={e => setFilter(e.target.value as AssetStatus | "all")} className="ml-auto rounded-lg border border-line bg-bg2 px-3 py-2 text-sm" aria-label="Status filter">
          {["pending", "active", "rejected", "suspended", "all"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {rows.length === 0 && <Empty title={`No ${filter === "all" ? "" : filter + " "}${tab === "station" ? "stations" : "satellites"}`} />}
      <div className="space-y-3">
        {rows.map(a => (
          <div key={a.id} className="panel p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-medium">{a.name}</div>
                <div className="text-xs text-muted">
                  {"noradId" in a ? <>NORAD {a.noradId}{a.intlDesignator ? ` · ${a.intlDesignator}` : ""} · {a.band} · {a.downlinkMHz} MHz · {a.protocol}</>
                    : <>{a.country} · {a.latitude.toFixed(4)}°, {a.longitude.toFixed(4)}° · {a.antennaType} {a.antennaSizeM} m · {a.bands.join("/")} · {a.pricePerPass.toFixed(2)}/pass</>}
                </div>
                <div className="mt-1 text-xs">Owner: {a.owner.company || a.owner.name} · {a.owner.email} · {a.owner.verified ? <Badge tone="ok">verified owner</Badge> : <Badge tone="bad">owner not verified</Badge>}</div>
              </div>
              <StatusPill status={a.status} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input value={notes[a.id] ?? ""} onChange={e => setNotes({ ...notes, [a.id]: e.target.value })} placeholder="Note (required to reject / suspend)" className="min-w-0 flex-1 rounded-lg border border-line bg-bg2 px-3 py-1.5 text-xs outline-none focus:border-accent" />
              <button disabled={!a.owner.verified || a.status === "active"} title={!a.owner.verified ? "Approve the owner's verification first" : undefined} onClick={() => act(tab, a.id, "active")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs disabled:opacity-40">Activate</button>
              {a.status === "active" && <button onClick={() => act(tab, a.id, "suspended")} className="rounded-lg border border-amber-500/50 px-3 py-1.5 text-xs text-amber-300">Suspend</button>}
              {a.status !== "rejected" && <button onClick={() => act(tab, a.id, "rejected")} className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs text-red-300">Reject</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
