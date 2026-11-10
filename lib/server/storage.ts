import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Verification documents are encrypted (AES-256-GCM) BEFORE they leave the server, so the storage provider only
 * ever holds ciphertext. Blob layout: iv(12) | tag(16) | ciphertext.
 * Backend: Supabase Storage when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set, else local ./.storage (dev only).
 */
function key(): Buffer {
  const k = process.env.DOC_ENCRYPTION_KEY;
  if (!k) throw new Error("DOC_ENCRYPTION_KEY is not set");
  const b = Buffer.from(k, "base64");
  if (b.length !== 32) throw new Error("DOC_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  return b;
}

export function encrypt(plain: Buffer) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]);
}
export function decrypt(blob: Buffer) {
  const d = createDecipheriv("aes-256-gcm", key(), blob.subarray(0, 12));
  d.setAuthTag(blob.subarray(12, 28));
  return Buffer.concat([d.update(blob.subarray(28)), d.final()]);
}

const BUCKET = process.env.SUPABASE_BUCKET || "verification-docs";
const supa = () => (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? { url: process.env.SUPABASE_URL.replace(/\/$/, ""), key: process.env.SUPABASE_SERVICE_ROLE_KEY } : null);
const LOCAL = path.join(process.cwd(), ".storage");

export async function putObject(objectKey: string, plain: Buffer) {
  const blob = encrypt(plain);
  const s = supa();
  if (s) {
    const r = await fetch(`${s.url}/storage/v1/object/${BUCKET}/${objectKey}`, {
      method: "POST", headers: { apikey: s.key, Authorization: `Bearer ${s.key}`, "Content-Type": "application/octet-stream", "x-upsert": "true" }, body: new Uint8Array(blob),
    });
    if (!r.ok) throw new Error(`storage upload failed: ${r.status} ${await r.text()}`);
    return;
  }
  // Serverless hosts (Netlify, Vercel) have no persistent disk.
  if (process.env.NODE_ENV === "production") throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production");
  const p = path.join(LOCAL, objectKey);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, blob);
}

export async function getObject(objectKey: string): Promise<Buffer> {
  const s = supa();
  if (s) {
    const r = await fetch(`${s.url}/storage/v1/object/${BUCKET}/${objectKey}`, { headers: { apikey: s.key, Authorization: `Bearer ${s.key}` } });
    if (!r.ok) throw new Error(`storage download failed: ${r.status}`);
    return decrypt(Buffer.from(await r.arrayBuffer()));
  }
  return decrypt(await readFile(path.join(LOCAL, objectKey)));
}

export const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

/** Trust file bytes, not the client's Content-Type. */
export function sniffType(b: Buffer): "application/pdf" | "image/png" | "image/jpeg" | null {
  if (b.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  return null;
}
