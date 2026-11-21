"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PageTitle } from "@/components/ui";
import { ContractProgress, type ContractView } from "@/components/ContractProgress";
import { useApi } from "@/lib/api-client";
import { BOOKING_STATUS, money } from "@/lib/bookings-shared";

const utc = (t: number) => new Date(t).toISOString().slice(5, 16).replace("T", " ") + " UTC";

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const d = useApi<{ contract: ContractView }>(`/api/contracts/${id}`);
  if (d === undefined) return <div className="skeleton h-40 max-w-4xl" />;
  if (d === null) return <p className="text-muted">This guarantee doesn&apos;t exist or isn&apos;t yours.</p>;
  const c = d.contract;
  return (
    <div className="max-w-4xl">
      <Link href="/dashboard/operator/contracts" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-white"><ArrowLeft size={14} />All guarantees</Link>
      <PageTitle title="Guarantee" sub={`Contract ${c.id.slice(0, 8)} · bought ${utc(c.createdAt)} · ${c.rateKbps} kbps planning rate · passes above ${c.minElDeg}°`} />
      <ContractProgress c={c} />

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="panel p-4"><div className="text-xs text-muted">Passes booked</div><div className="display mt-1 text-2xl">{money(c.passCost)}</div></div>
        <div className="panel p-4"><div className="text-xs text-muted">Guarantee premium</div><div className="display mt-1 text-2xl">{money(c.premium)}</div></div>
        <div className="panel p-4"><div className="text-xs text-muted">Compensation if missed</div><div className="display mt-1 text-2xl">{money(c.compensation)}</div></div>
      </div>

      {c.status !== "active" && (
        <Link href={`/proof/contract/${c.id}`} target="_blank" className="panel mt-4 flex items-center justify-between p-4 text-sm hover:border-accent/40">
          <span><b>Contract certificate</b> · a public page with the target, verified volume and every pass. Share it with your customers.</span><ExternalLink size={15} />
        </Link>
      )}

      <h2 className="display mt-8 mb-3 text-2xl">Passes</h2>
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted"><tr>{["Station", "AOS", "Max el", "Planned", "Verified", "Price", "Status", ""].map(h => <th key={h} className="px-4 py-3 font-normal">{h}</th>)}</tr></thead>
          <tbody>{c.passes.map(p => (
            <tr key={p.id} className="border-t border-line">
              <td className="px-4 py-2.5">{p.station}{p.backup && <span className="ml-2 text-xs text-amber-400">backup</span>}</td>
              <td className="mono px-4 py-2.5">{utc(p.aos)}</td><td className="mono px-4 py-2.5">{p.maxElDeg}°</td>
              <td className="mono px-4 py-2.5">{p.plannedMB.toFixed(1)} MB</td>
              <td className="mono px-4 py-2.5">{p.status === "settled" ? `${(p.plannedMB * (p.deliveryBps ?? 0) / 10000).toFixed(1)} MB` : "–"}</td>
              <td className="mono px-4 py-2.5">{money(p.price)}</td>
              <td className="px-4 py-2.5 text-xs">{BOOKING_STATUS[p.status as keyof typeof BOOKING_STATUS]?.label ?? p.status}</td>
              <td className="px-4 py-2.5 text-xs">{p.status === "settled" ? <Link href={`/proof/${p.id}`} target="_blank" className="text-cyan underline">Proof</Link> : <Link href={`/dashboard/live-pass/${p.id}`} className="text-cyan underline">Live</Link>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">Manifests are still committed per pass from <Link href="/dashboard/operator/bookings" className="underline">My bookings</Link>. Each settled pass adds its planned volume × verified delivery to the total.</p>
    </div>
  );
}
