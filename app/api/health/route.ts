import { NextResponse } from "next/server";
import { connection } from "next/server";
import { db } from "@/lib/server/db";

/** Uptime check: 200 when the database answers, 503 otherwise. No secrets, no auth. */
export async function GET() {
  await connection();
  const t = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", dbMs: Date.now() - t }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "degraded", db: "unreachable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
