"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Check, PublicShell } from "@/components/PublicShell";
import { useApi } from "@/lib/api-client";
import { money } from "@/lib/bookings-shared";

interface Proof {
  id: string; contractId: string | null;
  satellite: { name: string; noradId: number; band: string; downlinkMHz: number };
  station: { name: string; country: string; owner: string }; operator: string;
  aos: number; los: number; maxElDeg: number; manifestRoot: string; receivedRoot: string; keyFingerprint: string;
  checks: { signatureValid: boolean; stationKeyMatches: boolean; manifestRootMatches: boolean; promised: number; received: number; verified: number; missing: number; duplicates: number; invalidHashes: number; timestampViolations: number; dopplerAnomalies: number; deliveryBps: number; confidence: string; matchesSettlement: boolean };
  settlement: { price: number; feeBps: number; stationNet: number; platformFee: number; operatorRefund: number; settledAt: number | null };
  reverifiedAt: number;
}
const utc = (t: number) => new Date(t).toISOString().slice(0, 19).replace("T", " ") + " UTC";

export function ProofView() {
  const { id } = useParams<{ id: string }>();
  const d = useApi<{ proof: Proof }>(`/api/v1/proof/${id}`);
  const [copied, setCopied] = useState(false);
  if (d === undefined) return <PublicShell eyebrow="Proof of Downlink" title="Verifying…"><div className="skeleton h-64" /></PublicShell>;
  if (d === null) return <PublicShell eyebrow="Proof of Downlink" title="No proof here" sub="This link doesn't point to a settled pass. Proofs appear once the station's signed receipt has been verified." />;
  const p = d.proof, c = p.checks, s = p.settlement, pct = (c.deliveryBps / 100).toFixed(2);
  const share = async () => { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1600); };
  const rows: [string, number][] = [["Escrow held", s.price], ["Paid to the station", s.stationNet], [`Platform fee (${s.feeBps / 100}% of the earned share)`, s.platformFee], ["Refunded to the operator", s.operatorRefund]];
  return (
    <PublicShell eyebrow="Proof of Downlink · re-verified on every visit" title={`${pct}% delivered`}
      sub={<>{p.satellite.name} (NORAD {p.satellite.noradId}) to {p.station.name}, {p.station.country}. {c.verified} of {c.promised} committed frames arrived intact and on time. Checked again at {utc(p.reverifiedAt)}.</>}>
      <div className="flex flex-wrap gap-3">
        <button onClick={share} className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-bg">{copied ? "Link copied" : "Copy share link"}</button>
        {p.contractId && <Link href={`/proof/contract/${p.contractId}`} className="rounded-full border border-line px-5 py-2 text-sm">Part of a delivery guarantee</Link>}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section className="panel p-5">
          <h2 className="font-medium">Checks</h2>
          <ul className="mt-2">
            <Check ok={c.signatureValid} label="Receipt signed by the station (ed25519)" detail={`key fingerprint ${p.keyFingerprint}`} />
            <Check ok={c.stationKeyMatches} label="Signing key is the station's current registered key" />
            <Check ok={c.manifestRootMatches} label="Receipt refers to the manifest committed before the pass" detail={p.manifestRoot} />
            <Check ok={c.invalidHashes === 0 && c.duplicates === 0} label="Every received frame matches its committed hash" detail={`${c.invalidHashes} altered · ${c.duplicates} duplicated · ${c.missing} missing`} />
            <Check ok={c.timestampViolations === 0} label="Frames received inside the predicted pass window" detail={`${utc(p.aos)} → ${utc(p.los)}, peak ${p.maxElDeg}°`} />
            <Check ok={c.dopplerAnomalies === 0} label="Doppler shift follows the pass geometry" detail={`${p.satellite.downlinkMHz} MHz downlink · ${c.dopplerAnomalies} anomalies`} />
            <Check ok={c.matchesSettlement} label="This re-check matches the stored settlement" detail={`root of received frames ${p.receivedRoot}`} />
          </ul>
        </section>
        <section className="panel p-5">
          <h2 className="font-medium">Settlement</h2>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full" role="img" aria-label="Escrow split between station, platform fee and refund">
            <i className="bg-emerald-500" style={{ width: `${(s.stationNet / s.price) * 100}%` }} />
            <i className="bg-slate-300" style={{ width: `${(s.platformFee / s.price) * 100}%` }} />
            <i className="bg-amber-500" style={{ width: `${(s.operatorRefund / s.price) * 100}%` }} />
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-t border-line pt-2 first:border-t-0 first:pt-0"><dt className="text-muted">{k}</dt><dd className="mono">{money(v)}</dd></div>)}
          </dl>
          <p className="mt-4 text-xs text-muted">Platform credits. Station run by {p.station.owner}; booked by {p.operator}. Settled {s.settledAt ? utc(s.settledAt) : "–"}.</p>
        </section>
      </div>
      <p className="mt-6 text-xs text-muted">Frame contents and individual hashes stay private. Each time this page loads, the server recomputes the Merkle roots, the signature check and the pass-window checks from the stored manifest and signed receipt.</p>
    </PublicShell>
  );
}
