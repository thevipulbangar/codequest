#!/usr/bin/env node
// Operator tool: build a Proof-of-Downlink manifest from the frames you expect the satellite to send.
// Usage: node scripts/make-manifest.mjs <frames-directory> [manifest.json]
// Each file in the directory is one frame; frame ids follow the sorted file names (0, 1, 2…).
// Upload the resulting manifest.json in OrbitPass → My Bookings → Commit manifest, BEFORE the pass starts.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const [dir, out = "manifest.json"] = process.argv.slice(2);
if (!dir) { console.error("Usage: node scripts/make-manifest.mjs <frames-directory> [manifest.json]"); process.exit(1); }
const files = readdirSync(dir).filter(f => statSync(path.join(dir, f)).isFile()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
if (!files.length) { console.error("No files found in", dir); process.exit(1); }
const frames = files.map((f, id) => ({ id, file: f, hash: createHash("sha256").update(readFileSync(path.join(dir, f))).digest("hex") }));
writeFileSync(out, JSON.stringify({ frames: frames.map(({ id, hash }) => ({ id, hash })) }, null, 1));
writeFileSync(out.replace(/\.json$/, "") + ".index.json", JSON.stringify(frames, null, 1)); // id ↔ file name, for your records
console.log(`${frames.length} frames → ${out}`);
