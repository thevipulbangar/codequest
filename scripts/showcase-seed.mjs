#!/usr/bin/env node
// Create the two public showcase accounts (published in README) through the app's real API:
//   sign-up → profile → verification documents (SAMPLE PDFs, encrypted like real ones) → reviewer approves each
//   document and the account → stations / satellites registered and activated → credits granted by the reviewer.
// Then adds a short history of real past NOAA passes between them (manifest, signed receipt, settlement), so
// reliability scores and public proof pages exist, and books their next passes through the API.
//
// Usage: node --env-file=.env scripts/showcase-seed.mjs --url http://localhost:3000
// Needs a build WITHOUT the showcase guard (lib/server/showcase.ts) or the guard blocks the setup steps.
// Logins, the reviewer admin and station keys are saved to .demo/accounts.json (git-ignored).
import prismaPkg from "@prisma/client";
import { createHash, createPrivateKey, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { docsFor } from "../lib/verification/requirements.ts";
import { parseTle, predictPasses } from "../lib/orbital/passes.ts";
import { settle } from "../lib/verifier/settlement.ts";
import { hashPassword } from "../lib/server/password.ts";

const URL_ = process.argv[process.argv.indexOf("--url") + 1] ?? "http://localhost:3000";
const FILE = ".demo/accounts.json";
const demo = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : { accounts: {}, stations: {} };
const { PrismaClient, Prisma } = prismaPkg;
const db = new PrismaClient();
const log = m => console.log(`· ${m}`);

const OPERATOR = { key: "showcaseOperator", email: "operator@orbitpass.example", password: "OrbitPass#Operator26", role: "operator", name: "Arjun Mehta",
  profile: { jobTitle: "Mission Operations Lead", company: "Kestrel Orbital (demo)", companyType: "Private limited company", country: "India", phone: "+91 80 0000 0000", website: "https://example.com/kestrel", about: "Demo satellite operator. Downlinks weather imagery from two NOAA polar orbiters through OrbitPass." } };
const OWNER = { key: "showcaseOwner", email: "owner@orbitpass.example", password: "OrbitPass#Owner26", role: "owner", name: "Priya Rao",
  profile: { jobTitle: "Ground Segment Manager", company: "Deccan Ground Stations (demo)", companyType: "Private limited company", country: "India", phone: "+91 40 0000 0000", website: "https://example.com/deccan", about: "Demo station owner. Runs two VHF/UHF ground stations in Hyderabad and Pune and lists their idle passes on OrbitPass." } };
const SETUP = { ownerType: "company", gstRegistered: false, operatorDiffers: false, assetAcquired: false, siteControl: "leased", representative: false };
const SATS = [
  { name: "NOAA 15", noradId: 25338, intlDesignator: "1998-030A", band: "VHF", downlinkMHz: 137.62, protocol: "APT" },
  { name: "NOAA 18", noradId: 28654, intlDesignator: "2005-018A", band: "VHF", downlinkMHz: 137.9125, protocol: "APT" },
];
const STATIONS = [
  { name: "Demo · Hyderabad", country: "India", latitude: 17.385, longitude: 78.4867, altitudeM: 505, antennaType: "Turnstile + QFH array", antennaSizeM: 1.2, bands: ["VHF", "UHF"], protocols: ["APT", "AX.25"], pricePerPass: 45 },
  { name: "Demo · Pune", country: "India", latitude: 18.5204, longitude: 73.8567, altitudeM: 560, antennaType: "Yagi array", antennaSizeM: 2.4, bands: ["VHF", "UHF"], protocols: ["APT", "AX.25"], pricePerPass: 40 },
];
const TEXT = { reg_no: "U72900KA2024PTC123456", pan: "ABCDE1234F", norad: "25338", intl_des: "1998-030A" };

// ---- HTTP ------------------------------------------------------------------------------------------
async function client(account, signup) {
  let r = signup
    ? await fetch(`${URL_}/api/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: account.name, email: account.email, password: account.password, role: account.role }) })
    : null;
  if (!r || r.status === 409) r = await fetch(`${URL_}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: account.email, password: account.password, role: account.role }) });
  if (!r.ok) throw new Error(`${account.email}: ${r.status} ${await r.text()}`);
  const cookie = r.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
  const call = async (method, path, payload, form) => {
    const res = await fetch(`${URL_}${path}`, { method, headers: { cookie, ...(payload !== undefined ? { "Content-Type": "application/json" } : {}) }, body: form ?? (payload !== undefined ? JSON.stringify(payload) : undefined) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${data.error ?? ""}`);
    return data;
  };
  return { get: p => call("GET", p), post: (p, b) => call("POST", p, b), put: (p, b) => call("PUT", p, b), patch: (p, b) => call("PATCH", p, b), upload: (p, form) => call("POST", p, undefined, form) };
}

/** A small valid PDF that says what it is. */
function samplePdf(title, who) {
  const text = `SAMPLE DOCUMENT - DEMO ACCOUNT - NOT A REAL RECORD. ${title}. ${who}. Generated for the OrbitPass showcase.`.replace(/[()\\]/g, "");
  const stream = `BT /F1 11 Tf 40 760 Td (${text.slice(0, 90)}) Tj 0 -16 Td (${text.slice(90)}) Tj ET`;
  const objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  let out = "%PDF-1.4\n"; const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map(o => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Blob([out], { type: "application/pdf" });
}

// ---- Proof of Downlink helpers (same algorithms as lib/verifier) -------------------------------------
const sha256 = s => createHash("sha256").update(s).digest("hex");
const merkleRoot = frames => {
  let level = frames.map(f => sha256(`${f.id}:${f.hash}`));
  if (!level.length) return sha256("");
  while (level.length > 1) { const n = []; for (let i = 0; i < level.length; i += 2) n.push(sha256(level[i] + (level[i + 1] ?? level[i]))); level = n; }
  return level[0];
};
const rnd = seed => { let a = parseInt(sha256(seed).slice(0, 8), 16); return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// ---- Steps -----------------------------------------------------------------------------------------
async function reviewer() {
  const email = "reviewer@orbitpass.example";
  const password = demo.accounts.showcaseReviewer?.password ?? randomBytes(15).toString("base64url");
  const passwordHash = await hashPassword(password); // also on update: an interrupted run may not have saved the password
  await db.user.upsert({ where: { email }, create: { email, name: "Showcase Reviewer", role: "admin", passwordHash }, update: { passwordHash } });
  demo.accounts.showcaseReviewer = { email, password, role: "admin" };
  return client(demo.accounts.showcaseReviewer, false);
}

async function verify(api, admin, acc, kind) {
  const me = (await api.get("/api/auth/me")).user;
  if ((await db.verification.findUnique({ where: { userId: me.id } }))?.decision === "approved") { log(`${acc.email} already verified`); return me; }
  await api.patch("/api/auth/me", acc.profile);
  await api.put("/api/verification/setup", SETUP);
  const docs = docsFor(kind, SETUP);
  for (const d of docs) {
    if (d.kind === "text") await api.post("/api/verification/documents", { docId: d.id, text: d.id === "norad" ? String(SATS[0].noradId) : TEXT[d.id] });
    else if (d.kind === "kyc") await api.post("/api/verification/documents", { docId: d.id, kyc: true });
    else { const f = new FormData(); f.set("docId", d.id); f.set("file", samplePdf(d.name, acc.profile.company), `${d.id}-sample.pdf`); await api.upload("/api/verification/documents", f); }
  }
  log(`${acc.email}: ${docs.length} documents submitted`);
  for (const d of docs) await admin.post(`/api/admin/verifications/${me.id}/review`, { docId: d.id, status: "approved" });
  await admin.post(`/api/admin/verifications/${me.id}/decide`, { status: "approved", note: "Showcase account: sample documents reviewed and approved." });
  log(`${acc.email}: all documents approved, three badges earned, account approved`);
  return me;
}

async function main() {
  mkdirSync(".demo", { recursive: true });
  demo.accounts[OPERATOR.key] = { email: OPERATOR.email, password: OPERATOR.password, role: "operator" };
  demo.accounts[OWNER.key] = { email: OWNER.email, password: OWNER.password, role: "owner" };
  const admin = await reviewer();
  const op = await client(OPERATOR, true), own = await client(OWNER, true);
  const opUser = await verify(op, admin, OPERATOR, "satellite");
  const ownUser = await verify(own, admin, OWNER, "station");

  // Stations with signing keys
  const mine = (await own.get("/api/stations")).stations ?? [];
  for (const s of STATIONS) {
    let st = mine.find(x => x.name === s.name);
    if (!st) st = (await own.post("/api/stations", s)).station;
    if (!demo.stations[s.name]) {
      const { publicKey, privateKey } = generateKeyPairSync("ed25519");
      await own.put(`/api/stations/${st.id}/key`, { publicKey: publicKey.export({ type: "spki", format: "der" }).toString("hex") });
      demo.stations[s.name] = { id: st.id, privateKey: privateKey.export({ type: "pkcs8", format: "der" }).toString("hex"), owner: OWNER.key };
    }
    if (st.status !== "active") await admin.post(`/api/admin/assets/station/${st.id}`, { status: "active" });
  }
  // Satellites
  const sats = (await op.get("/api/satellites")).satellites ?? [];
  for (const s of SATS) {
    let sat = sats.find(x => x.noradId === s.noradId);
    if (!sat) sat = (await op.post("/api/satellites", s)).satellite;
    if (sat.status !== "active") await admin.post(`/api/admin/assets/satellite/${sat.id}`, { status: "active" });
  }
  writeFileSync(FILE, JSON.stringify(demo, null, 2));
  log("2 stations and 2 satellites registered, keys set, activated by the reviewer");

  // Credits, granted the way admins do after an off-platform payment
  const bal = Number((await op.get("/api/wallet")).balance);
  if (bal < 5000) await admin.post("/api/admin/credits", { email: OPERATOR.email, amount: 10000, note: "Showcase credits for judges and visitors" });

  await history(opUser, ownUser);
  await upcoming(op);
  writeFileSync(FILE, JSON.stringify(demo, null, 2));
  console.log(`\nShowcase ready on ${URL_}\n  operator: ${OPERATOR.email} / ${OPERATOR.password}\n  owner:    ${OWNER.email} / ${OWNER.password}`);
}

/** Settled bookings on real past passes: manifest, station-signed receipt, pro-rata settlement, ledger. */
async function history(opUser, ownUser) {
  if (await db.booking.count({ where: { operatorId: opUser.id, status: "settled" } })) { log("pass history already present"); return; }
  const sats = await db.satellite.findMany({ where: { ownerId: opUser.id } });
  const stations = await db.groundStation.findMany({ where: { ownerId: ownUser.id } });
  const now = Date.now(), cands = [];
  for (const sat of sats) {
    const text = await (await fetch(`https://celestrak.org/NORAD/elements/gp.php?CATNR=${sat.noradId}&FORMAT=TLE`)).text();
    const [, l1, l2] = text.trim().split(/\r?\n/);
    const rec = parseTle(l1, l2);
    for (const st of stations)
      for (const p of predictPasses(rec, { lat: st.latitude, lon: st.longitude, altKm: st.altitudeM / 1000 }, now - 4 * 86400_000, now - 2 * 3600_000, 25))
        cands.push({ sat, st, p });
  }
  cands.sort((a, b) => a.p.aos - b.p.aos);
  const picked = []; // no overlaps per station or satellite
  for (const c of cands) if (!picked.some(x => (x.st.id === c.st.id || x.sat.id === c.sat.id) && x.p.aos < c.p.los + 60_000 && x.p.los + 60_000 > c.p.aos)) picked.push(c);
  const chosen = picked.slice(-6);
  const losses = [0, 2, 6, 1, 0, 4]; // frames missed per pass, out of 100
  for (const [i, { sat, st, p }] of chosen.entries()) {
    const key = createPrivateKey({ key: Buffer.from(demo.stations[st.name].privateKey, "hex"), format: "der", type: "pkcs8" });
    const frames = Array.from({ length: 100 }, (_, k) => ({ id: k + 1, hash: sha256(`showcase:${sat.noradId}:${p.aos}:${k + 1}`) }));
    const root = merkleRoot(frames);
    const r = rnd(`${sat.id}${p.aos}`), drop = new Set();
    while (drop.size < losses[i % losses.length]) drop.add(1 + Math.floor(r() * 100));
    const maxDop = sat.downlinkMHz * 1e6 * 7.6 / 299792.458, span = p.los - p.aos;
    const recv = frames.filter(f => !drop.has(f.id)).map(f => { const frac = (f.id - 0.5) / 100; return { id: f.id, hash: f.hash, receivedAt: Math.round(p.aos + frac * span), rssiDbm: Math.round((-118 + 26 * Math.sin(Math.PI * frac) + (r() - 0.5) * 3) * 10) / 10, dopplerHz: Math.round(maxDop * (1 - 2 * frac) + (r() - 0.5) * maxDop * 0.04) }; });
    const booking = await db.booking.create({ data: { operatorId: opUser.id, satelliteId: sat.id, stationId: st.id, aos: new Date(p.aos), los: new Date(p.los), maxElDeg: p.maxElDeg, price: st.pricePerPass, feeBps: 800, status: "manifest_committed", manifest: { bookingId: "", frames, root }, manifestRoot: root, framesPromised: 100, createdAt: new Date(p.aos - 20 * 3600_000) } });
    await db.booking.update({ where: { id: booking.id }, data: { manifest: { bookingId: booking.id, frames, root } } });
    const body = { bookingId: booking.id, stationId: st.id, manifestRoot: root, frames: recv };
    const digest = sha256(JSON.stringify({ bookingId: body.bookingId, stationId: st.id, manifestRoot: root, frames: recv.map(f => [f.id, f.hash, f.receivedAt, f.rssiDbm, f.dopplerHz]) }));
    const receipt = { ...body, publicKey: st.publicKey, signature: sign(null, Buffer.from(digest), key).toString("hex") };
    const verifiedFrames = frames.filter(f => !drop.has(f.id));
    const deliveryBps = Math.floor(verifiedFrames.length * 10000 / 100);
    const report = { promised: 100, received: recv.length, verified: recv.length, missing: [...drop].sort((a, b) => a - b), duplicates: [], invalidHashes: [], timestampViolations: [], unknownFrames: [], dopplerAnomalies: [], signatureValid: true, manifestRootMatches: true, receivedRoot: merkleRoot(verifiedFrames), deliveryBps, confidence: "high" };
    const s = settle(BigInt(Math.round(Number(st.pricePerPass) * 100)), 100, recv.length, 800);
    const D = c => new Prisma.Decimal(c.toString()).div(100);
    const settledAt = new Date(p.los + 25 * 60_000);
    await db.$transaction(async tx => {
      const move = async (userId, amount, type, note, at) => {
        const acc = await tx.creditAccount.upsert({ where: { userId }, create: { userId, balance: amount }, update: { balance: { increment: amount } } });
        await tx.ledgerEntry.create({ data: { userId, amount, balanceAfter: acc.balance, type, bookingId: booking.id, note, createdAt: at } });
      };
      await move(opUser.id, new Prisma.Decimal(st.pricePerPass).negated(), "escrow_lock", `Escrow: ${sat.name} @ ${st.name}`, booking.createdAt);
      await tx.booking.update({ where: { id: booking.id }, data: { status: "settled", receipt, report, framesVerified: recv.length, deliveryBps, stationGross: D(s.stationGross), platformFee: D(s.platformFee), stationNet: D(s.stationNet), operatorRefund: D(s.operatorRefund), settledAt } });
      if (s.stationNet > 0n) await move(ownUser.id, D(s.stationNet), "payout", `Pass ${sat.name} @ ${st.name}`, settledAt);
      if (s.platformFee > 0n) await tx.ledgerEntry.create({ data: { userId: null, amount: D(s.platformFee), type: "platform_fee", bookingId: booking.id, createdAt: settledAt } });
      if (s.operatorRefund > 0n) await move(opUser.id, D(s.operatorRefund), "refund", `Undelivered ${((10000 - deliveryBps) / 100).toFixed(2)}%`, settledAt);
    });
    log(`settled ${sat.name} @ ${st.name} ${new Date(p.aos).toISOString().slice(0, 16)}Z · ${deliveryBps / 100}% · proof /proof/${booking.id}`);
  }
}

/** Book the operator's next passes over the owner's stations through the normal booking API. */
async function upcoming(op) {
  const open = ((await op.get("/api/bookings")).bookings ?? []).filter(b => b.status === "confirmed" || b.status === "manifest_committed");
  if (open.length >= 2) { log("upcoming bookings already present"); return; }
  const ids = new Set(Object.values(demo.stations).filter(s => s.owner === OWNER.key).map(s => s.id));
  const { passes } = await op.get("/api/v1/passes?hours=48&minEl=20");
  let n = 0;
  for (const p of passes.filter(p => ids.has(p.stationId) && p.aos > Date.now() + 90 * 60_000)) {
    if (n >= 3) break;
    try { await op.post("/api/bookings", { satelliteId: p.satelliteId, stationId: p.stationId, aos: p.aos }); n++; log(`booked ${p.satellite} @ ${p.station} ${new Date(p.aos).toISOString().slice(0, 16)}Z`); }
    catch (e) { log(`skip: ${e.message}`); }
  }
}

try { await main(); } finally { await db.$disconnect(); }
