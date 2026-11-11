import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { HttpError, requireUser } from "@/lib/server/auth";
import { body, handle } from "@/lib/server/http";
import { isOwnerApproved } from "@/lib/server/assets";
import { audit } from "@/lib/server/verification";

const Schema = z.object({ status: z.enum(["active", "rejected", "suspended"]), note: z.string().trim().max(500).optional() })
  .refine(b => b.status === "active" || !!b.note, { message: "A note is required to reject or suspend", path: ["note"] });

export const POST = handle(async (req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) => {
  const admin = await requireUser(["admin"]);
  const { kind, id } = await params;
  if (kind !== "satellite" && kind !== "station") throw new HttpError(404, "Not found");
  const b = await body(req, Schema);
  const asset = kind === "satellite" ? await db.satellite.findUnique({ where: { id } }) : await db.groundStation.findUnique({ where: { id } });
  if (!asset) throw new HttpError(404, "Not found");
  // Never activate an asset whose owner isn't fully verified.
  if (b.status === "active" && !(await isOwnerApproved(asset.ownerId)))
    throw new HttpError(409, "The owner's verification must be approved before this can be activated");
  const data = { status: b.status, reviewNote: b.note || null, reviewedAt: new Date() };
  if (kind === "satellite") await db.satellite.update({ where: { id }, data });
  else await db.groundStation.update({ where: { id }, data });
  await audit(admin.id, `asset:${b.status}`, `${kind}/${id}`, b.note);
  return NextResponse.json({ ok: true });
});
