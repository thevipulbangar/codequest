#!/usr/bin/env node
// Station tool: sign the downlink receipt for a booking after the pass (LOS).
// Usage:
//   node scripts/sign-receipt.mjs --booking <bookingId> --station <stationId> --root <manifestRoot> \
//        --frames received.json --key station-key.pem [--out receipt.json]
// received.json: [{ "id": 0, "hash": "<sha256 of the frame bytes>", "receivedAt": "2026-11-11T10:00:05Z" | <epoch ms>,
//                   "rssiDbm": -112.5, "dopplerHz": 8450 }, ...]
// Upload receipt.json in OrbitPass → Bookings → Submit receipt. Verification and settlement happen immediately.
import { createHash, createPrivateKey, createPublicKey, sign } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith("--") ? [...a, [v.slice(2), all[i + 1]]] : a), []));
for (const k of ["booking", "station", "root", "frames", "key"]) if (!args[k]) { console.error(`Missing --${k}`); process.exit(1); }

const key = createPrivateKey(readFileSync(args.key));
const publicKey = createPublicKey(key).export({ type: "spki", format: "der" }).toString("hex");
const frames = JSON.parse(readFileSync(args.frames, "utf8")).map(f => ({
  id: Number(f.id), hash: String(f.hash).toLowerCase(),
  receivedAt: typeof f.receivedAt === "number" ? f.receivedAt : Date.parse(f.receivedAt),
  rssiDbm: Number(f.rssiDbm), dopplerHz: Number(f.dopplerHz),
}));
if (frames.some(f => !Number.isFinite(f.receivedAt) || !/^[0-9a-f]{64}$/.test(f.hash))) { console.error("Every frame needs a valid receivedAt and a SHA-256 hex hash"); process.exit(1); }

const body = { bookingId: args.booking, stationId: args.station, manifestRoot: args.root, frames };
// Must match lib/verifier/receipt.ts canonical form exactly.
const digest = createHash("sha256").update(JSON.stringify({ bookingId: body.bookingId, stationId: body.stationId, manifestRoot: body.manifestRoot, frames: frames.map(f => [f.id, f.hash, f.receivedAt, f.rssiDbm, f.dopplerHz]) })).digest("hex");
const signature = sign(null, Buffer.from(digest), key).toString("hex");
const out = args.out || "receipt.json";
writeFileSync(out, JSON.stringify({ ...body, signature, publicKey }));
console.log(`Signed ${frames.length} frames → ${out}`);
