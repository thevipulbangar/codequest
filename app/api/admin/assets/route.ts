import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import { ownedSatellite, ownedStation } from "@/lib/server/assets";

const owner = { select: { id: true, name: true, email: true, company: true, verification: { select: { decision: true } } } } as const;
type Owner = { id: string; name: string; email: string; company: string | null; verification: { decision: string | null } | null };
const ownerInfo = (o: Owner) => ({ id: o.id, name: o.name, email: o.email, company: o.company, verified: o.verification?.decision === "approved" });

export const GET = handle(async () => {
  await requireUser(["admin"]);
  const [sats, stations] = await Promise.all([
    db.satellite.findMany({ include: { owner }, orderBy: { createdAt: "desc" } }),
    db.groundStation.findMany({ include: { owner }, orderBy: { createdAt: "desc" } }),
  ]);
  return NextResponse.json({
    satellites: sats.map(s => ({ ...ownedSatellite(s), owner: ownerInfo(s.owner) })),
    stations: stations.map(s => ({ ...ownedStation(s), owner: ownerInfo(s.owner) })),
  });
});
