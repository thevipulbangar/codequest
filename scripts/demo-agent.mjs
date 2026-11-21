#!/usr/bin/env node
// Station agent + operator agent for the demo network (see scripts/demo-seed.mts).
// Talks to OrbitPass only through its public HTTP API, exactly like real station software would:
//   operator side: commits a frame manifest for every booking before AOS
//   station side:  after LOS, "receives" the frames, signs the receipt with the station's ed25519 key and submits it
// Frame data is SYNTHETIC (seeded per booking); the verification, settlement and guarantees are the real thing.
//
// Usage: npm run demo:agent -- [--url http://localhost:3000] [--loss 0.08] [--cancel 0.15] [--once]
//   --loss    average share of frames the station misses (default 0.08)
//   --cancel  chance a station cancels a guaranteed pass when it first sees it, to show auto re-booking (default 0)
import { createHash, createPrivateKey, createPublicKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg("url", "http://localhost:3000"), LOSS = Number(arg("loss", 0.08)), CANCEL = Number(arg("cancel", 0)), ONCE = process.argv.includes("--once");
const FRAMES = 100;
const demo = JSON.parse(readFileSync(".demo/accounts.json", "utf8"));

const sha256 = s => createHash("sha256").update(s).digest("hex");
const merkleRoot = frames => { // must match lib/verifier/merkle.ts
  let level = frames.map(f => sha256(`${f.id}:${f.hash}`));
  while (level.length > 1) { const n = []; for (let i = 0; i < level.length; i += 2) n.push(sha256(level[i] + (level[i + 1] ?? level[i]))); level = n; }
  return level[0] ?? sha256("");
};
const framesFor = bookingId => Array.from({ length: FRAMES }, (_, i) => ({ id: i + 1, hash: sha256(`demo-frame:${bookingId}:${i + 1}`) }));
const rnd = seed => { let a = parseInt(sha256(seed).slice(0, 8), 16); return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

async function session(account) {
  const r = await fetch(`${URL_}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: account.email, password: account.password, role: account.role }) });
  if (!r.ok) throw new Error(`login ${account.email}: ${r.status} ${await r.text()}`);
  const cookie = r.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
  return async (path, body) => {
    const res = await fetch(`${URL_}${path}`, { method: body === undefined ? "GET" : "POST", headers: { cookie, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${path}: ${res.status} ${data.error ?? ""}`);
    return data;
  };
}
const log = (who, msg) => console.log(`${new Date().toISOString().slice(11, 19)}  ${who.padEnd(22)} ${msg}`);

/** Station receipt: drop ~LOSS of the frames, timestamps across the pass, Doppler following the pass model. */
function receiptFor(b, stationId, privateKeyHex) {
  const r = rnd(b.id), span = b.los - b.aos, maxDoppler = b.satellite.downlinkMHz * 1e6 * 7.6 / 299_792.458;
  const loss = LOSS * (0.25 + 1.5 * r()); // passes vary around the average
  const frames = framesFor(b.id).filter(() => r() >= loss).map(f => {
    const frac = (f.id - 0.5) / FRAMES;
    return { id: f.id, hash: f.hash, receivedAt: Math.round(b.aos + frac * span),
      rssiDbm: Math.round((-120 + 28 * Math.sin(Math.PI * frac) + (r() - 0.5) * 3) * 10) / 10,
      dopplerHz: Math.round(maxDoppler * (1 - 2 * frac) + (r() - 0.5) * maxDoppler * 0.04) };
  });
  const body = { bookingId: b.id, stationId, manifestRoot: b.manifestRoot, frames };
  const digest = sha256(JSON.stringify({ bookingId: body.bookingId, stationId, manifestRoot: body.manifestRoot, frames: frames.map(f => [f.id, f.hash, f.receivedAt, f.rssiDbm, f.dopplerHz]) }));
  const key = createPrivateKey({ key: Buffer.from(privateKeyHex, "hex"), format: "der", type: "pkcs8" });
  return { ...body, publicKey: createPublicKey(key).export({ type: "spki", format: "der" }).toString("hex"), signature: sign(null, Buffer.from(digest), key).toString("hex") };
}

const seen = new Set();
async function tick(op, owners) {
  const now = Date.now();
  for (const b of (await op("/api/bookings")).bookings) {
    if (b.status === "confirmed" && b.aos > now + 30_000) {
      await op(`/api/bookings/${b.id}/manifest`, { frames: framesFor(b.id) }).then(() => log("operator", `manifest committed · ${b.satellite.name} @ ${b.station.name}`)).catch(e => log("operator", e.message));
    }
  }
  for (const call of owners) {
    for (const b of (await call("/api/bookings")).bookings) {
      const st = Object.values(demo.stations).find(s => s.id === b.station.id);
      if (!st) continue;
      if (b.contractId && !seen.has(b.id) && b.status !== "settled" && b.aos > now + 15 * 60_000 && rnd(`cancel:${b.id}`)() < CANCEL) {
        seen.add(b.id);
        await call(`/api/bookings/${b.id}/cancel`, {}).then(() => log(b.station.name, `cancelled a guaranteed pass (simulated outage) · ${b.satellite.name}`)).catch(e => log(b.station.name, e.message));
        continue;
      }
      seen.add(b.id);
      if (b.status === "manifest_committed" && now >= b.los) {
        await call(`/api/bookings/${b.id}/receipt`, receiptFor(b, b.station.id, st.privateKey))
          .then(d => log(b.station.name, `receipt verified · ${(d.report?.deliveryBps ?? 0) / 100}% of ${b.satellite.name} pass`))
          .catch(e => log(b.station.name, e.message));
      }
    }
  }
}

const op = await session(demo.accounts.operator);
const owners = await Promise.all(["owner1", "owner2", "owner3"].map(k => session(demo.accounts[k])));
log("agent", `watching ${Object.keys(demo.stations).length} demo stations on ${URL_} · loss ${LOSS * 100}% · cancel ${CANCEL * 100}%`);
do {
  await tick(op, owners).catch(e => log("agent", e.message));
  if (!ONCE) await new Promise(r => setTimeout(r, 20_000));
} while (!ONCE);
