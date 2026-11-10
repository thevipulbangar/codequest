import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import { loadVerification, toState } from "@/lib/server/verification";

/** Own verification state. */
export const GET = handle(async () => {
  const u = await requireUser(["operator", "owner"]);
  return NextResponse.json(toState(u, await loadVerification(u.id)));
});
