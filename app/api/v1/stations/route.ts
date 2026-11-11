import { NextResponse } from "next/server";
import { connection } from "next/server";
import { handle } from "@/lib/server/http";
import { activeStations, publicStation } from "@/lib/server/assets";

/** Public marketplace: only active stations whose owners are fully verified. */
export const GET = handle(async () => {
  await connection();
  return NextResponse.json({ stations: (await activeStations()).map(publicStation) });
});
