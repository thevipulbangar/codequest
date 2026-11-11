import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { HttpError, requireUser } from "@/lib/server/auth";
import { body, handle, rateLimit } from "@/lib/server/http";
import { ownedSatellite } from "@/lib/server/assets";
import { SatelliteInput } from "@/lib/assets";

export const GET = handle(async () => {
  const u = await requireUser(["operator"]);
  const list = await db.satellite.findMany({ where: { ownerId: u.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ satellites: list.map(ownedSatellite) });
});

/** Register a satellite. It starts as `pending` and is never usable until an admin activates it. */
export const POST = handle(async (req: Request) => {
  const u = await requireUser(["operator"]);
  rateLimit(`sat-create:${u.id}`, 20, 3600_000);
  const b = await body(req, SatelliteInput);
  if (await db.satellite.findUnique({ where: { noradId: b.noradId } }))
    throw new HttpError(409, "This NORAD ID is already registered. If you own it, contact support to dispute the claim.");
  // Fill the international designator from the public catalogue when the owner didn't give one.
  let intl = b.intlDesignator;
  if (!intl) {
    try {
      const r = await fetch(`https://celestrak.org/NORAD/elements/gp.php?CATNR=${b.noradId}&FORMAT=JSON`, { signal: AbortSignal.timeout(6000) });
      const j = r.ok ? await r.json() : null;
      intl = Array.isArray(j) && j[0]?.OBJECT_ID ? String(j[0].OBJECT_ID) : undefined;
    } catch { /* optional */ }
  }
  const s = await db.satellite.create({ data: { ...b, intlDesignator: intl ?? null, ownerId: u.id } });
  return NextResponse.json({ satellite: ownedSatellite(s) }, { status: 201 });
});
