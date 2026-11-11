#!/usr/bin/env node
// Generate a ground station's receipt-signing key pair (ed25519).
// Usage: node scripts/station-keygen.mjs [out-file]   (default: station-key.pem)
// Keep the private key file secret and on the station. Register the printed PUBLIC key in OrbitPass → My Stations.
import { generateKeyPairSync } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

const out = process.argv[2] || "station-key.pem";
if (existsSync(out)) { console.error(`${out} already exists — refusing to overwrite a signing key.`); process.exit(1); }
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
writeFileSync(out, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
console.log(`Private key saved to ${out} (keep it secret).`);
console.log("\nPublic key — paste this into OrbitPass (My Stations → Signing key):\n");
console.log(publicKey.export({ type: "spki", format: "der" }).toString("hex"));
