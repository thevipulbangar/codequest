import { NextResponse } from "next/server";
import { HttpError, requireUser } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import { contractView, loadContract, reconcileContract } from "@/lib/server/contracts";

export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requireUser(["operator", "admin"]);
  const id = (await params).id;
  const c = await loadContract(id);
  if (!c || (u.role !== "admin" && c.operatorId !== u.id)) throw new HttpError(404, "Contract not found");
  if (c.status === "active") { await reconcileContract(id); }
  return NextResponse.json({ contract: await contractView((await loadContract(id))!) });
});
