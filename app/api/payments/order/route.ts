import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { body, handle, rateLimit } from "@/lib/server/http";
import { createTopUp } from "@/lib/server/payments";

/** Start a wallet top-up: creates a Razorpay order for the amount; credits are fixed server-side. */
export const POST = handle(async (req: Request) => {
  const u = await requireUser(["operator"]);
  rateLimit(`topup:${u.id}`, 10, 60_000);
  const { amountInr } = await body(req, z.object({ amountInr: z.number() }));
  return NextResponse.json({ ...(await createTopUp(u.id, amountInr)), name: u.name, email: u.email });
});
