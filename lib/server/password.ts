// No framework imports: also used by scripts/create-admin.mts.
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const N = 16384, KEYLEN = 64;
const run = (pw: string, salt: Buffer) =>
  new Promise<Buffer>((res, rej) => scrypt(pw.normalize("NFKC"), salt, KEYLEN, { N, r: 8, p: 1 }, (e, k) => (e ? rej(e) : res(k))));

/** Format: scrypt$N$saltHex$hashHex */
export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  return `scrypt$${N}$${salt.toString("hex")}$${(await run(pw, salt)).toString("hex")}`;
}

export async function verifyPassword(pw: string, stored: string) {
  const [alg, n, saltHex, hashHex] = stored.split("$");
  if (alg !== "scrypt" || Number(n) !== N || !saltHex || !hashHex) return false;
  const want = Buffer.from(hashHex, "hex");
  const got = await run(pw, Buffer.from(saltHex, "hex"));
  return got.length === want.length && timingSafeEqual(got, want);
}
