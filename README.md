# OrbitPass

Pay-per-pass ground-station marketplace. Satellite operators book individual passes over verified ground stations; the fee is held in escrow and released **only for frames proven delivered** (Proof of Downlink).

Live: https://orbitpasss.netlify.app

## How it works

1. **Verify** — operators and station owners upload company, ownership and licensing documents. Admins review them and award three badges (Organisation / Asset Owner / Operator).
2. **Register assets** — satellites (NORAD ID) and ground stations start as *pending*. An asset goes live only when an admin activates it **and** its owner is approved.
3. **Find & book** — passes are predicted with SGP4 from live CelesTrak orbits. Booking re-predicts the pass on the server, prevents double-booking, respects station blackout periods, and locks the price in escrow (platform credits).
4. **Manifest** — before AOS the operator commits SHA-256 hashes of the expected frames; the Merkle root is immutable.
5. **Receipt** — after LOS the station uploads an ed25519-signed receipt of what it received.
6. **Verify & settle** — the receipt is checked (signature, manifest root, hashes, duplicates, pass window, Doppler). The station is paid for the verified share minus the platform fee; the operator is refunded the rest. All amounts are integer cents and always balance.
7. **Disputes** — either side can dispute within 24 h; admins can claw back part of the payout.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind · Prisma + PostgreSQL (Supabase) · Supabase Storage (documents, AES-256-GCM encrypted before upload) · satellite.js (SGP4) · Netlify.

## Local setup

```bash
npm install --legacy-peer-deps
cp .env.example .env          # fill in the values (see comments in the file)
npm run db:migrate            # create tables
npm run create-admin -- you@example.com 'a-strong-password' 'Your Name'
npm run dev                   # http://localhost:3000
```

Admins sign in at `/login?as=admin`. Admin accounts can only be created with the script.

## Tools for operators and station owners (`scripts/`)

| Command | Who | What |
|---|---|---|
| `node scripts/station-keygen.mjs` | Station | Creates `station-key.pem` and prints the public key to register under **My Stations** |
| `node scripts/make-manifest.mjs ./frames manifest.json` | Operator | Hashes each expected frame file into a manifest to commit before the pass |
| `node scripts/sign-receipt.mjs --booking <id> --station <id> --root <manifestRoot> --frames received.json --key station-key.pem` | Station | Signs the receipt to upload after the pass |

## Scripts

| | |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Unit tests (verifier, settlement, verification rules, natural-language search) |
| `npm run lint` | ESLint |
| `npm run db:migrate` / `db:deploy` | Prisma migrations (dev / production) |
| `npm run create-admin -- <email> <password> [name]` | Create or promote an admin |

## Deployment (Netlify + Supabase)

1. Supabase: create a project, a **private** bucket `verification-docs`, then run `npm run db:deploy` against it.
2. Netlify: import the GitHub repo (build settings come from `netlify.toml`) and add every variable from `.env.example` under *Site configuration → Environment variables*.
3. Deploys run on every push to `main`. GitHub Actions runs type-check, lint, tests and build on each push.
4. Health check for uptime monitoring: `GET /api/health`.

**Performance:** keep the database in the same region as the server functions (Netlify defaults to `us-east-2`), otherwise every query crosses continents.

## Security notes

- Passwords: scrypt; sessions: random tokens in httpOnly cookies (only the hash is stored).
- Every API checks the signed-in user and role on the server; booking, document and asset access is scoped to the owner.
- Login, sign-up and password reset are rate-limited across all instances (Postgres).
- Settlement amounts are never taken from the client; the natural-language search is deterministic and never touches prices.
- Admin actions and document views are written to an audit log.

## Guaranteed Downlink

Operators can order a volume of data by a deadline ("2 MB from ISS within 48 h") instead of single passes:

- **Planner** (`lib/guarantee/planner.ts`, tested in `tests/planner.test.ts`): picks the cheapest passes per expected MB across all stations, using each station's reliability as its success rate, then adds backup passes until the chance of meeting the target is at least 95% (Monte Carlo, seeded).
- **Guarantee price** = pass prices + premium, where premium = compensation × miss probability × 1.25. More reliable stations and longer deadlines lower it.
- **Auto re-booking**: when a contract's booking is cancelled, expires or under-delivers, `reconcileContract` (`lib/server/contracts.ts`) books replacement passes until confidence is back at 95%, never re-using a slot the contract already lost.
- **Fulfilment and compensation**: once the verified volume reaches the target, unused future passes are released and refunded. If the deadline passes short of the target, the agreed compensation is paid from the platform reserve automatically.
- **Public proof** `/proof/<bookingId>` re-verifies the signed receipt on every visit. `/proof/contract/<id>` is the contract certificate.
- **Earnings estimate** `/estimate` (public): real SGP4 passes over any location for OrbitPass satellites and well-known reference missions.
- **Calendar export**: `/api/bookings/ics`.

## Demo network

```bash
npm run demo:seed                       # 6 "Demo ·" stations, 3 owners, 1 operator with ISS + NOAA 19, 5,000 credits
npm run demo:agent -- --url https://orbitpasss.netlify.app --cancel 0.2
                                        # station agent: commits manifests, signs receipts after each real pass,
                                        # and cancels ~20% of guaranteed passes to show auto re-booking
npm run demo:seed -- --remove           # delete all demo data
```

Logins and station signing keys are written to `.demo/accounts.json` (git-ignored). Frame data from the agent is synthetic; passes, verification, settlement and guarantees are real.
