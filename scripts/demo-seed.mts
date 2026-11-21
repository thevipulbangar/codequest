// Create a clearly labelled DEMO network so the whole flow can be shown end to end:
// 3 station owners with 6 verified "Demo ·" stations (VHF + UHF), 1 operator with two real public satellites
// (ISS and NOAA 19, so passes are real SGP4 predictions) and 5,000 credits.
// Accounts and station signing keys are written to .demo/ (git-ignored). Run again to reuse them.
//
// Usage: npm run demo:seed            (uses DATABASE_URL from .env)
//        npm run demo:seed -- --remove  (deletes the demo accounts, stations, satellites and their bookings)
import prismaPkg from "@prisma/client";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { hashPassword } from "../lib/server/password.ts";

const { PrismaClient, Prisma } = prismaPkg;
const db = new PrismaClient();
const DIR = ".demo", FILE = `${DIR}/accounts.json`;
const DOMAIN = "orbitpass.demo";
const SETUP = { ownerType: "company", gstRegistered: false, operatorDiffers: false, assetAcquired: false, siteControl: "leased", representative: false };

const OWNERS = [
  { key: "owner1", name: "Demo Ground Networks", country: "India", stations: [
    { name: "Demo · Bengaluru", country: "India", lat: 12.9716, lon: 77.5946, alt: 920, price: 40 },
    { name: "Demo · Tokyo", country: "Japan", lat: 35.6762, lon: 139.6503, alt: 40, price: 55 } ] },
  { key: "owner2", name: "Demo Polar Stations", country: "Iceland", stations: [
    { name: "Demo · Reykjavík", country: "Iceland", lat: 64.1466, lon: -21.9426, alt: 30, price: 60 },
    { name: "Demo · Punta Arenas", country: "Chile", lat: -53.1638, lon: -70.9171, alt: 35, price: 50 } ] },
  { key: "owner3", name: "Demo Southern Sky", country: "South Africa", stations: [
    { name: "Demo · Cape Town", country: "South Africa", lat: -33.9249, lon: 18.4241, alt: 20, price: 35 },
    { name: "Demo · Madrid", country: "Spain", lat: 40.4168, lon: -3.7038, alt: 650, price: 45 } ] },
];
const SATS = [
  { norad: 25544, name: "ISS (demo)", band: "UHF", mhz: 437.8, protocol: "AX.25" },
  { norad: 33591, name: "NOAA 19 (demo)", band: "VHF", mhz: 137.1, protocol: "AX.25" },
];

type Saved = { accounts: Record<string, { email: string; password: string; role: string }>; stations: Record<string, { id: string; privateKey: string; owner: string }> };
const saved: Saved = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : { accounts: {}, stations: {} };

async function user(key: string, role: "operator" | "owner", name: string, country: string) {
  const email = `${key}@${DOMAIN}`;
  const password = saved.accounts[key]?.password ?? randomBytes(12).toString("base64url");
  const u = await db.user.upsert({
    where: { email },
    create: { email, name, role, company: name, country, passwordHash: await hashPassword(password), emailVerifiedAt: new Date() },
    update: {},
  });
  await db.verification.upsert({ where: { userId: u.id }, create: { userId: u.id, setup: SETUP, decision: "approved", decisionNote: "Demo account", decidedAt: new Date() }, update: { decision: "approved" } });
  saved.accounts[key] = { email, password, role };
  return u;
}

async function remove() {
  const users = await db.user.findMany({ where: { email: { endsWith: `@${DOMAIN}` } }, select: { id: true } });
  const ids = users.map(u => u.id);
  const bookings = await db.booking.findMany({ where: { OR: [{ operatorId: { in: ids } }, { station: { ownerId: { in: ids } } }] }, select: { id: true } });
  const bIds = bookings.map(b => b.id);
  await db.$transaction([
    db.dispute.deleteMany({ where: { bookingId: { in: bIds } } }),
    db.ledgerEntry.deleteMany({ where: { OR: [{ bookingId: { in: bIds } }, { userId: { in: ids } }] } }),
    db.booking.deleteMany({ where: { id: { in: bIds } } }),
    db.dataContract.deleteMany({ where: { operatorId: { in: ids } } }),
    db.auditLog.deleteMany({ where: { actorId: { in: ids } } }),
    db.user.deleteMany({ where: { id: { in: ids } } }),
  ]);
  console.log(`Removed ${ids.length} demo accounts and ${bIds.length} bookings.`);
}

try {
  if (process.argv.includes("--remove")) { await remove(); process.exit(0); }
  mkdirSync(DIR, { recursive: true });
  for (const o of OWNERS) {
    const u = await user(o.key, "owner", o.name, o.country);
    for (const s of o.stations) {
      let st = await db.groundStation.findFirst({ where: { ownerId: u.id, name: s.name } });
      if (!st) {
        const { publicKey, privateKey } = generateKeyPairSync("ed25519");
        st = await db.groundStation.create({ data: {
          ownerId: u.id, name: s.name, country: s.country, latitude: s.lat, longitude: s.lon, altitudeM: s.alt,
          antennaType: "Yagi array", antennaSizeM: 2.4, bands: ["VHF", "UHF"], protocols: ["AX.25"], pricePerPass: new Prisma.Decimal(s.price),
          publicKey: publicKey.export({ type: "spki", format: "der" }).toString("hex"), status: "active", reviewNote: "Demo station", reviewedAt: new Date(),
        } });
        saved.stations[s.name] = { id: st.id, privateKey: privateKey.export({ type: "pkcs8", format: "der" }).toString("hex"), owner: o.key };
      }
    }
  }
  const op = await user("operator", "operator", "Demo Orbital Ops", "India");
  for (const s of SATS) {
    const taken = await db.satellite.findUnique({ where: { noradId: s.norad } });
    if (taken && taken.ownerId !== op.id) { console.warn(`NORAD ${s.norad} is registered by a real account; skipping it.`); continue; }
    if (!taken) await db.satellite.create({ data: { ownerId: op.id, name: s.name, noradId: s.norad, band: s.band, downlinkMHz: s.mhz, protocol: s.protocol, status: "active", reviewNote: "Demo satellite", reviewedAt: new Date() } });
  }
  const acc = await db.creditAccount.findUnique({ where: { userId: op.id } });
  if (!acc || acc.balance.lt(5000)) {
    const top = new Prisma.Decimal(5000).minus(acc?.balance ?? 0);
    await db.$transaction(async tx => {
      const a = await tx.creditAccount.upsert({ where: { userId: op.id }, create: { userId: op.id, balance: top }, update: { balance: { increment: top } } });
      await tx.ledgerEntry.create({ data: { userId: op.id, amount: top, balanceAfter: a.balance, type: "credit_grant", note: "Demo credits" } });
    });
  }
  writeFileSync(FILE, JSON.stringify(saved, null, 2));
  console.log(`Demo network ready: ${Object.keys(saved.stations).length} stations, operator ${saved.accounts.operator.email}. Logins and station keys: ${FILE}`);
} finally {
  await db.$disconnect();
}
