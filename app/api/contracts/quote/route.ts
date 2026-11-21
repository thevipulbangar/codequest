import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { body, handle, rateLimit } from "@/lib/server/http";
import { quote } from "@/lib/server/contracts";
import { ContractBody } from "../schema";

/** Plan and price a guaranteed-downlink contract without booking anything. */
export const POST = handle(async (req: Request) => {
  const u = await requireUser(["operator"]);
  rateLimit(`quote:${u.id}`, 20, 60_000);
  const i = await body(req, ContractBody);
  const { plan } = await quote(u.id, i);
  return NextResponse.json({ quote: {
    ...plan,
    passes: plan.passes.map(p => ({ station: p.station, aos: p.aos, los: p.los, maxElDeg: p.maxElDeg, durationS: p.durationS, price: p.price, mb: p.mb, p: p.p, backup: p.backup })),
  } });
});
