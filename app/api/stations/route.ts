import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { body, handle, rateLimit } from "@/lib/server/http";
import { ownedStation } from "@/lib/server/assets";
import { StationInput } from "@/lib/assets";

export const GET = handle(async () => {
  const u = await requireUser(["owner"]);
  const list = await db.groundStation.findMany({ where: { ownerId: u.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ stations: list.map(ownedStation) });
});

/** Register a ground station. It starts as `pending` and never appears in the marketplace until an admin activates it. */
export const POST = handle(async (req: Request) => {
  const u = await requireUser(["owner"]);
  rateLimit(`stn-create:${u.id}`, 20, 3600_000);
  const b = await body(req, StationInput);
  const s = await db.groundStation.create({ data: { ...b, bands: [...new Set(b.bands)], protocols: [...new Set(b.protocols)], ownerId: u.id } });
  return NextResponse.json({ station: ownedStation(s) }, { status: 201 });
});
