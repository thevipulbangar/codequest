import { NextResponse } from "next/server";
import { endSession } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";

export const POST = handle(async () => {
  await endSession();
  return NextResponse.json({ ok: true });
});
