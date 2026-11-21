"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PublicShell } from "@/components/PublicShell";
import { useApi } from "@/lib/api-client";
import { BOOKING_STATUS, money } from "@/lib/bookings-shared";

interface Cert {
  id: string; status: "fulfilled" | "missed" | "cancelled"; operator: string;
  satellite: { name: string; noradId: number; band: string };
  targetMB: number; verifiedMB: number; deadline: number; closedAt: number | null; createdAt: number; compensation: number;
  passes: { id: string; station: string; country: string; aos: number; status: string; backup: boolean; plannedMB: number; deliveryBps: number | null; verifiedMB: number; proof: boolean }[];
}
const utc = (t: number) => new Date(t).toISOString().slice(0, 16).replace("T", " ") + " UTC";
const VERDICT = { fulfilled: "Delivered on time", missed: "Missed, compensation paid", cancelled: "Cancelled" } as const;

export function CertificateView() {
  const { id } = useParams<{ id: string }>();
  const d = useApi<{ certificate: Cert }>(`/api/v1/proof/contract/${id}`);
  if (d === undefined) return <PublicShell eyebrow="Delivery certificate" title="Loading…"><div className="skeleton h-64" /></PublicShell>;
  if (d === null) return <PublicShell eyebrow="Delivery certificate" title="No certificate yet" sub="Certificates are issued when a guarantee closes: fulfilled, missed or cancelled." />;
  const c = d.certificate, used = c.passes.filter(p => p.status === "settled");
  return (
    <PublicShell eyebrow={`Delivery certificate · contract ${c.id.slice(0, 8)}`} title={VERDICT[c.status]}
      sub={<>{c.operator} ordered {c.targetMB} MB from {c.satellite.name} (NORAD {c.satellite.noradId}, {c.satellite.band} band) by {utc(c.deadline)}. {c.verifiedMB.toFixed(1)} MB were verified by Proof of Downlink across {used.length} {used.length === 1 ? "pass" : "passes"}{c.closedAt ? `, closed ${utc(c.closedAt)}` : ""}.</>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="panel p-4"><div className="text-xs text-muted">Target</div><div className="display mt-1 text-3xl">{c.targetMB} MB</div></div>
        <div className="panel p-4"><div className="text-xs text-muted">Verified</div><div className={`display mt-1 text-3xl ${c.verifiedMB >= c.targetMB ? "text-emerald-400" : "text-amber-400"}`}>{c.verifiedMB.toFixed(1)} MB</div></div>
        <div className="panel p-4"><div className="text-xs text-muted">{c.status === "missed" ? "Compensation paid" : "Passes used"}</div><div className="display mt-1 text-3xl">{c.status === "missed" ? money(c.compensation) : used.length}</div></div>
      </div>
      <div className="panel mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted"><tr>{["Station", "Pass start", "Planned", "Verified", "Status", ""].map(h => <th key={h} className="px-4 py-3 font-normal">{h}</th>)}</tr></thead>
          <tbody>{c.passes.map(p => (
            <tr key={p.id} className="border-t border-line">
              <td className="px-4 py-2.5">{p.station}, {p.country}{p.backup && <span className="ml-2 text-xs text-amber-400">backup</span>}</td>
              <td className="mono px-4 py-2.5">{utc(p.aos)}</td>
              <td className="mono px-4 py-2.5">{p.plannedMB.toFixed(1)} MB</td>
              <td className="mono px-4 py-2.5">{p.proof ? `${p.verifiedMB.toFixed(1)} MB (${((p.deliveryBps ?? 0) / 100).toFixed(1)}%)` : "–"}</td>
              <td className="px-4 py-2.5 text-xs">{BOOKING_STATUS[p.status as keyof typeof BOOKING_STATUS]?.label ?? p.status}</td>
              <td className="px-4 py-2.5 text-xs">{p.proof && <Link href={`/proof/${p.id}`} className="text-cyan underline">Proof</Link>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-muted">Each settled pass links to its own proof, which is re-verified from the signed receipt when opened. Released backups and cancelled passes were refunded in full.</p>
    </PublicShell>
  );
}
