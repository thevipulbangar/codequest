import { createPublicKey } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { HttpError, requireUser } from "@/lib/server/auth";
import { body, handle } from "@/lib/server/http";

/** Register / rotate the station's ed25519 receipt-signing public key (SPKI DER, hex). */
export const PUT = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requireUser(["owner"]);
  const { id } = await params;
  const { publicKey } = await body(req, z.object({ publicKey: z.string().trim().toLowerCase().regex(/^[0-9a-f]{88}$/, "Expected the 88-character hex key printed by the key generator") }));
  try {
    const k = createPublicKey({ key: Buffer.from(publicKey, "hex"), format: "der", type: "spki" });
    if (k.asymmetricKeyType !== "ed25519") throw new Error();
  } catch { throw new HttpError(400, "That isn't a valid ed25519 public key"); }
  const r = await db.groundStation.updateMany({ where: { id, ownerId: u.id }, data: { publicKey } });
  if (!r.count) throw new HttpError(404, "Not found");
  return NextResponse.json({ ok: true });
});
