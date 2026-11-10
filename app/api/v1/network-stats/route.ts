import { NextResponse } from "next/server";
import { getNetworkStats } from "@/lib/orbital/stats";

export async function GET() {
  return NextResponse.json(await getNetworkStats());
}
