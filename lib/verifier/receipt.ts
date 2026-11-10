import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";
import { sha256 } from "./merkle";
import type { Receipt, ReceiptBody } from "./types";

const canonical = (b: ReceiptBody) =>
  sha256(JSON.stringify({ bookingId: b.bookingId, stationId: b.stationId, manifestRoot: b.manifestRoot,
    frames: b.frames.map(f => [f.id, f.hash, f.receivedAt, f.rssiDbm, f.dopplerHz]) }));

export function newStationKeys() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKey: publicKey.export({ type: "spki", format: "der" }).toString("hex"),
    privateKey: privateKey.export({ type: "pkcs8", format: "der" }).toString("hex"),
  };
}

export function signReceipt(body: ReceiptBody, publicKey: string, privateKeyHex: string): Receipt {
  const key = createPrivateKey({ key: Buffer.from(privateKeyHex, "hex"), format: "der", type: "pkcs8" });
  return { ...body, publicKey, signature: sign(null, Buffer.from(canonical(body)), key).toString("hex") };
}

export function receiptSignatureValid(r: Receipt): boolean {
  try {
    const key = createPublicKey({ key: Buffer.from(r.publicKey, "hex"), format: "der", type: "spki" });
    return verify(null, Buffer.from(canonical(r)), key, Buffer.from(r.signature, "hex"));
  } catch { return false; }
}
