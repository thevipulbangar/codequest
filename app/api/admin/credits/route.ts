import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { HttpError, requireUser } from "@/lib/server/auth";
import { body, handle } from "@/lib/server/http";
import { TX, credit } from "@/lib/server/ledger";
import { audit } from "@/lib/server/verification";
import { notify } from "@/lib/server/notify";

const Schema = z.object({
  email: z.email().transform(e => e.toLowerCase()),
  amount: z.number().positive().max(1_000_000).refine(n => Math.round(n * 100) === n * 100, "At most 2 decimal places"),
  note: z.string().trim().min(3, "Add a note (e.g. invoice number)").max(200),
});

/** Admin grants credits after an off-platform payment. Every grant is in the ledger and the audit log. */
export const POST = handle(async (req: Request) => {
  const admin = await requireUser(["admin"]);
  const b = await body(req, Schema);
  const user = await db.user.findUnique({ where: { email: b.email } });
  if (!user || user.role === "admin") throw new HttpError(404, "No operator or station owner with that email");
  const balance = await db.$transaction(tx => credit(tx, user.id, new Prisma.Decimal(b.amount), { type: "credit_grant", note: b.note }), TX);
  await audit(admin.id, "credit_grant", user.id, `${b.amount} — ${b.note}`);
  void notify(user.id, "Credits added", `${b.amount.toFixed(2)} credits were added to your account (${b.note}).`, user.role === "operator" ? "/dashboard/operator/wallet" : "/dashboard/station-owner/earnings");
  return NextResponse.json({ balance: Number(balance) });
});
