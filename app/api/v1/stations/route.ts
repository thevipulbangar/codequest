import { NextResponse } from "next/server";
import { connection } from "next/server";
import { handle } from "@/lib/server/http";
import { activeStations, publicStation } from "@/lib/server/assets";
import { reliability } from "@/lib/server/bookings";

/** Public marketplace: only active stations whose owners are fully verified. */
export const GET = handle(async () => {
  await connection();
  const list = await activeStations();
  const rel = await reliability(list.map(s => s.id));
  return NextResponse.json({ stations: list.map(s => ({ ...publicStation(s), reliability: rel.get(s.id) ?? null })) });
});
