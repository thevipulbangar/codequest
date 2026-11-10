import { Badge, PageTitle, Stat } from "@/components/ui";
import { STATIONS } from "@/lib/orbital/catalog";

/** Reliability = 50% avg verified delivery + 30% pass-completion + 20% receipt validity (transparent rule, sample inputs). */
export default function StationOwner() {
  const mine = STATIONS.slice(0, 2);
  return (
    <>
      <PageTitle title="Station owner overview" sub="Sample data — persistence and onboarding arrive with the database phase." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total earnings" value="4,812.40 tUSD" hint="sample" /><Stat label="Available balance" value="620.15 tUSD" hint="sample" />
        <Stat label="Completed passes" value="826" hint="sample" /><Stat label="Avg delivery" value="95.1%" tone="ok" hint="sample" />
      </div>
      <div className="panel p-4">
        <div className="eyebrow mb-3">My stations</div>
        {mine.map(s => (
          <div key={s.id} className="flex items-center justify-between border-t border-line py-3 text-sm">
            <div><div>{s.name}</div><div className="text-xs text-muted">{s.country} · {s.antenna} {s.diameterM} m · {s.bands.join("/")}</div></div>
            <div className="flex items-center gap-3"><Badge tone={s.verified ? "ok" : "warn"}>{s.verified ? "verified" : "pending approval"}</Badge><span className="mono">{s.reliability}/100</span></div>
          </div>
        ))}
      </div>
    </>
  );
}
