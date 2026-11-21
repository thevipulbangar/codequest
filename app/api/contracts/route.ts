import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { body, handle, rateLimit } from "@/lib/server/http";
import { db } from "@/lib/server/db";
import { expireOverdue } from "@/lib/server/bookings";
import { contractView, createContract, loadContract } from "@/lib/server/contracts";
import { ContractBody } from "./schema";

/** The operator's guaranteed-downlink contracts with live progress. */
export const GET = handle(async () => {
  const u = await requireUser(["operator"]);
  await expireOverdue();
  const ids = await db.dataContract.findMany({ where: { operatorId: u.id }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true } });
  const list = await Promise.all(ids.map(c => loadContract(c.id)));
  return NextResponse.json({ contracts: await Promise.all(list.filter(c => c !== null).map(c => contractView(c))) });
});

/** Buy a contract: books all planned passes and charges passes + premium, atomically. */
export const POST = handle(async (req: Request) => {
  const u = await requireUser(["operator"]);
  rateLimit(`contract:${u.id}`, 5, 60_000);
  const i = await body(req, ContractBody.extend({ expectedTotal: z.number().min(0) }));
  const c = await createContract(u.id, i, i.expectedTotal);
  const full = await loadContract(c.id);
  return NextResponse.json({ contract: await contractView(full!) }, { status: 201 });
});
