"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import { Badge, Empty, PageTitle, fmtTime } from "@/components/ui";
import { api, revalidate, useApi } from "@/lib/api-client";
import { money } from "@/lib/bookings-shared";
import { BANDS, type OwnedSatellite, type PublicStation } from "@/lib/assets";

interface P { id: string; satelliteId: string; stationId: string; satellite: string; station: string; band: string; aos: number; los: number; maxElDeg: number; durationS: number; price: number }
interface R { passes: P[]; activeSatellites: number; activeStations: number; tleUnavailable: string[] }
type Sort = "aos" | "maxElDeg" | "price" | "durationS";

const num = (v: string | null, min: number, max: number, fallback: string) => (v !== null && /^\d+(\.\d+)?$/.test(v) && +v >= min && +v <= max ? v : fallback);
const dur = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;

export default function FindPass() {
  // Filters can arrive from the home page search (?band=&hours=&minEl=&stationId=&norad=).
  const sp = useSearchParams();
  const sats = useApi<{ satellites: OwnedSatellite[] }>("/api/satellites");
  const stations = useApi<{ stations: PublicStation[] }>("/api/v1/stations");
  const [f, setF] = useState(() => ({
    satelliteId: "", stationId: sp.get("stationId") ?? "",
    band: (BANDS as readonly string[]).includes(sp.get("band") ?? "") ? sp.get("band")! : "",
    minEl: num(sp.get("minEl"), 0, 90, "10"), hours: num(sp.get("hours"), 1, 72, "24"), maxPrice: "",
  }));
  const [satTouched, setSatTouched] = useState(false);
  const [sort, setSort] = useState<Sort>("aos");
  const [page, setPage] = useState(0);
  const active = useMemo(() => sats?.satellites.filter(s => s.status === "active") ?? [], [sats]);
  const norad = sp.get("norad");
  const fromNorad = norad ? active.find(s => String(s.noradId) === norad) : undefined;
  const satelliteId = satTouched ? f.satelliteId : fromNorad?.id ?? "";

  const q = new URLSearchParams({ minEl: f.minEl || "0", hours: f.hours || "24" });
  if (satelliteId) q.set("satelliteId", satelliteId);
  if (f.stationId) q.set("stationId", f.stationId);
  if (f.band) q.set("band", f.band);
  const passesUrl = `/api/v1/passes?${q}`;
  const res = useApi<R>(passesUrl);
  const wallet = useApi<{ balance: number }>("/api/wallet");
  const [now] = useState(() => Date.now());
  const router = useRouter();
  const [nlq, setNlq] = useState("");
  const [nl, setNl] = useState<{ passes: P[]; understood: string[]; note?: string } | null>(null);
  const [nlBusy, setNlBusy] = useState(false);

  // Booking confirmation
  const [pending, setPending] = useState<P | null>(null);
  const [busy, setBusy] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const sheet = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = sheet.current;
    if (!d) return;
    if (pending && !d.open) d.showModal();
    if (!pending && d.open) d.close();
  }, [pending]);
  const balance = wallet?.balance;
  const short = pending && balance !== undefined ? balance < pending.price : false;

  async function confirmBooking() {
    if (!pending) return;
    setBusy(true); setBookError(null);
    try {
      await api("/api/bookings", { json: { satelliteId: pending.satelliteId, stationId: pending.stationId, aos: pending.aos } });
      await Promise.all([revalidate("/api/wallet"), revalidate(passesUrl), revalidate("/api/bookings")]);
      setPending(null);
      toast.success("Booking confirmed. Commit your frame manifest before the pass starts.", { action: { label: "My bookings", onClick: () => router.push("/dashboard/operator/bookings") } });
    } catch (e) { setBookError(e instanceof Error ? e.message : "The booking could not be made."); }
    finally { setBusy(false); }
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (nlq.trim().length < 3) return;
    setNlBusy(true);
    try { const d = await api<{ passes: P[]; filters: { understood: string[] }; note?: string }>("/api/v1/passes/search", { json: { query: nlq } }); setNl({ passes: d.passes, understood: d.filters.understood, note: d.note }); setPage(0); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Search failed"); }
    finally { setNlBusy(false); }
  }

  const rows = useMemo(() => (nl?.passes ?? res?.passes ?? [])
    .filter(p => !f.maxPrice || p.price <= +f.maxPrice)
    .sort((a, b) => sort === "aos" ? a.aos - b.aos : sort === "price" ? a.price - b.price : b[sort] - a[sort]), [res, nl, f.maxPrice, sort]);
  const PER = 10, pages = Math.max(1, Math.ceil(rows.length / PER));
  const inp = "mt-1 w-full rounded-lg border border-line bg-bg2 px-3 py-2 text-sm text-white outline-none focus:border-white";
  const upd = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setF({ ...f, [k]: e.target.value }); setPage(0); if (k === "satelliteId") setSatTouched(true); };

  return (
    <>
      <PageTitle title="Find passes" sub="SGP4 predictions on current CelesTrak orbits, for your active satellites over active, verified ground stations." />

      {sats !== undefined && active.length === 0 && (
        <Empty title="No active satellites yet">
          Passes are predicted for your own satellites once they are verified and activated.{norad ? ` NORAD ${norad} is not registered to this account yet.` : ""}{" "}
          <Link href="/dashboard/operator/satellites" className="text-cyan underline">Register a satellite</Link>
        </Empty>
      )}

      {active.length > 0 && <>
        {norad && !fromNorad && (
          <p className="panel mb-3 border-amber-500/50 p-3 text-sm text-amber-300">
            NORAD {norad} is not one of your active satellites, so these are passes for the satellites you have. <Link href="/dashboard/operator/satellites" className="underline">Register it</Link> to see its passes.
          </p>
        )}
        <form onSubmit={ask} className="panel mb-3 flex flex-wrap items-center gap-2 p-3">
          <Search size={16} className="text-muted" aria-hidden />
          <input value={nlq} onChange={e => setNlq(e.target.value)} placeholder="Describe it: next pass over India above 30 degrees for UHF band before 18:00 UTC" className="min-w-0 flex-1 bg-transparent text-sm outline-none" aria-label="Describe the pass you need" />
          <button disabled={nlBusy} className="rounded-lg bg-accent px-3 py-1.5 text-xs disabled:opacity-50">{nlBusy ? <Loader2 size={13} className="animate-spin" /> : "Search"}</button>
          {nl && <button type="button" onClick={() => { setNl(null); setNlq(""); }} className="rounded-lg border border-line px-3 py-1.5 text-xs">Clear</button>}
        </form>
        {nl && <p className="mb-3 text-xs text-muted">Understood: {nl.understood.length ? nl.understood.join(", ") : "nothing specific, so these are your next passes"}{nl.note ? `. ${nl.note}` : ""}</p>}
        <div className={`panel mb-4 grid${nl ? " pointer-events-none opacity-40" : ""} grid-cols-2 gap-3 p-4 md:grid-cols-3 lg:grid-cols-6`}>
          <label className="text-xs text-muted">Satellite<select className={inp} value={satelliteId} onChange={upd("satelliteId")}><option value="">All my satellites</option>{active.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className="text-xs text-muted">Station<select className={inp} value={f.stationId} onChange={upd("stationId")}><option value="">All stations</option>{stations?.stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className="text-xs text-muted">Band<select className={inp} value={f.band} onChange={upd("band")}><option value="">Any band</option>{BANDS.map(b => <option key={b} value={b}>{b}</option>)}</select></label>
          <label className="text-xs text-muted">Min elevation °<input type="number" min={0} max={90} className={inp} value={f.minEl} onChange={upd("minEl")} /></label>
          <label className="text-xs text-muted">Window (hours)<input type="number" min={1} max={72} className={inp} value={f.hours} onChange={upd("hours")} /></label>
          <label className="text-xs text-muted">Max price<input type="number" min={0} className={inp} value={f.maxPrice} onChange={upd("maxPrice")} /></label>
        </div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>{res?.tleUnavailable?.length ? <Badge tone="warn">No current orbit for: {res.tleUnavailable.join(", ")}</Badge> : null}</span>
          <label>Sort <select className="ml-1 rounded border border-line bg-bg2 px-2 py-1 text-white" value={sort} onChange={e => setSort(e.target.value as Sort)}><option value="aos">Soonest</option><option value="maxElDeg">Max elevation</option><option value="durationS">Longest</option><option value="price">Price</option></select></label>
        </div>
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted"><tr>{["Satellite", "Station", "AOS (UTC)", "LOS (UTC)", "Max el", "Duration", "Band", "Price", ""].map(h => <th key={h} scope="col" className="px-4 py-3 font-normal">{h}</th>)}</tr></thead>
            <tbody>
              {res === undefined && !nl && Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={9} className="px-4 py-2"><div className="skeleton h-6" /></td></tr>)}
              {res === null && !nl && <tr><td colSpan={9} className="px-4 py-10 text-center text-red-400">Passes could not be loaded. Reload the page to try again.</td></tr>}
              {res && res.activeStations === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-muted">No verified ground stations are active yet. Passes will appear as stations are approved.</td></tr>}
              {(nl || (res && res.activeStations > 0)) && rows.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-muted">No passes match. Lower the minimum elevation, widen the window or clear the band.</td></tr>}
              {rows.slice(page * PER, page * PER + PER).map(p => {
                const tooSoon = p.aos < now + 10 * 60_000;
                return (
                  <tr key={p.id} className="border-t border-line hover:bg-white/3">
                    <td className="px-4 py-3">{p.satellite}</td><td className="px-4 py-3">{p.station}</td>
                    <td className="mono px-4 py-3">{fmtTime(p.aos)}</td><td className="mono px-4 py-3">{fmtTime(p.los)}</td>
                    <td className="mono px-4 py-3">{p.maxElDeg}°</td><td className="mono px-4 py-3">{dur(p.durationS)}</td>
                    <td className="px-4 py-3"><Badge>{p.band}</Badge></td><td className="mono px-4 py-3">{p.price.toFixed(2)}</td>
                    <td className="px-4 py-3"><button disabled={tooSoon} title={tooSoon ? "Passes starting within 10 minutes can no longer be booked" : undefined} onClick={() => { setBookError(null); setPending(p); }} className="rounded-lg bg-accent px-3 py-1.5 text-xs disabled:opacity-40">{tooSoon ? "Too soon" : "Book"}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>{rows.length} passes, wallet balance {wallet ? money(wallet.balance) : "…"} credits</span>
          <span className="flex items-center gap-2"><button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded border border-line px-3 py-1 disabled:opacity-30">Prev</button>{page + 1}/{pages}<button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} className="rounded border border-line px-3 py-1 disabled:opacity-30">Next</button></span>
        </div>
      </>}

      <dialog ref={sheet} className="sheet" aria-labelledby="book-title" onClose={() => setPending(null)} onCancel={e => { if (busy) e.preventDefault(); }}>
        {pending && (
          <div className="p-6">
            <h2 id="book-title" className="display text-2xl">Book this pass</h2>
            <p className="mt-1 text-sm text-muted">{pending.satellite} over {pending.station}</p>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div><dt className="text-xs text-muted">Rises (AOS)</dt><dd className="mono">{fmtTime(pending.aos)}</dd></div>
              <div><dt className="text-xs text-muted">Sets (LOS)</dt><dd className="mono">{fmtTime(pending.los)}</dd></div>
              <div><dt className="text-xs text-muted">Peak elevation</dt><dd className="mono">{pending.maxElDeg}°</dd></div>
              <div><dt className="text-xs text-muted">Duration</dt><dd className="mono">{dur(pending.durationS)}</dd></div>
              <div><dt className="text-xs text-muted">Band</dt><dd>{pending.band}</dd></div>
              <div><dt className="text-xs text-muted">Price</dt><dd className="mono">{money(pending.price)} credits</dd></div>
            </dl>
            <p className="mt-5 border-t border-line pt-4 text-sm text-muted">
              {money(pending.price)} credits move from your wallet into escrow now. After the pass, the station is paid for the frames that verify and the rest returns to you. You can cancel for a full refund up to one hour before the pass starts.
            </p>
            <p className="mt-2 text-xs text-muted">The server predicts this pass again and checks the station&apos;s calendar before confirming, so a booking can still be refused.</p>
            {short && <p role="alert" className="mt-3 text-sm text-red-400">You have {money(balance ?? 0)} credits and this pass costs {money(pending.price)}. Ask OrbitPass support to add credits to your wallet.</p>}
            {bookError && <p role="alert" className="mt-3 text-sm text-red-400">Not booked: {bookError}</p>}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setPending(null)} className="rounded-full border border-line px-4 py-2 text-sm disabled:opacity-50">Keep looking</button>
              <button type="button" disabled={busy || short || balance === undefined} onClick={confirmBooking} className="inline-flex items-center gap-2 rounded-full bg-navy px-5 py-2 text-sm font-semibold text-bg disabled:opacity-50">
                {busy && <Loader2 size={14} className="animate-spin" />}{busy ? "Booking" : "Book and hold in escrow"}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
