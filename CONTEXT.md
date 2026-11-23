# OrbitPass — Project Context

Living hand-over document: what exists, how it fits together, key decisions, and what is left.
Last updated: 23 November 2026.

## 1. Product in one paragraph

OrbitPass is a pay-per-pass marketplace connecting small-satellite operators with independent ground-station owners. Operators book individual passes, or buy a **Guaranteed Downlink** contract (a data volume by a deadline, planned across stations, with backups, auto re-booking and compensation); the fee is held in escrow (platform credits) and released only for frames proven delivered through **Proof of Downlink**: the operator commits a Merkle-rooted frame manifest before the pass, the station submits an ed25519-signed receipt after it, and a deterministic verifier settles pro-rata (station paid for the verified share minus the platform fee, operator refunded the rest).

## 2. Where things are

| | |
|---|---|
| Live site | https://orbitpasss.netlify.app (Netlify site `orbitpasss`, auto-deploys from `main`) |
| Repository | https://github.com/thevipulbangar/codequest (branch `main`) |
| Database + files | Supabase project `dnbemdyllhinydwwokbj`, region **ap-southeast-2 (Sydney)**; private bucket `verification-docs` |
| Server functions | Netlify, region **us-east-2 (Ohio)** — region change needs a paid Netlify plan |
| Admin sign-in | `/login?as=admin` (unlisted). Admins are created only with `npm run create-admin` |
| Secrets | `orbitpass/.env` (git-ignored) and Netlify environment variables. See `.env.example` |

## 3. Architecture

- **Frontend:** Next.js 16 App Router, TypeScript, Tailwind v4, Framer Motion, three.js (landing intro, loaded on demand), Recharts. Editorial light theme with a dark hero; SVG emblem logo (`components/Logo.tsx`), app icons in `app/icon.png`.
- **Backend:** Next.js route handlers under `app/api/**`, wrapped by `lib/server/http.ts#handle` (maps `HttpError`, re-throws Next control-flow errors).
- **Data:** Prisma 6 + Postgres (`prisma/schema.prisma`, migrations in `prisma/migrations`). `relationJoins` preview enabled to cut round trips.
- **Auth (`lib/server/auth.ts`):** email + password (scrypt), opaque session token in an httpOnly cookie, only its SHA-256 stored; 60 s per-instance session cache. Roles: `operator`, `owner`, `admin`; role fixed at sign-up; the login tab must match the account type (checked after the password).
- **Orbital (`lib/orbital/*`):** CelesTrak TLE (cached 1 h, never substituted) + satellite.js SGP4 for AOS/LOS/max elevation; network stats over active assets only.
- **Verifier (`lib/verifier/*`):** Merkle root, ed25519 receipt signatures, duplicate/missing/invalid-hash/timestamp/Doppler checks, integer-cent pro-rata settlement. Tested in `tests/verifier.test.ts`.
- **Storage (`lib/server/storage.ts`):** documents encrypted with AES-256-GCM (`DOC_ENCRYPTION_KEY`) before upload to Supabase Storage; file type sniffed from bytes.

## 4. Business rules (as implemented)

**Verification & activation**
- Owner verification uses document rules in `lib/verification/requirements.ts` (company vs individual, satellite vs station, conditional docs). Three badges: Organisation, Asset Owner, Operator. A badge = all applicable *minimum* docs approved. Final approval needs all three (enforced server-side).
- A satellite/station is visible or bookable **only** if `status = active` **and** its owner's verification decision is `approved` (`lib/server/assets.ts`). Losing approval hides assets immediately.

**Bookings & money** (`lib/server/bookings.ts`, `lib/server/ledger.ts`)
- Payment rail: **platform credits ledger** (no real money yet). Admin grants credits after off-platform payment. Ledger is append-only; for every booking `escrow_lock = payout + platform_fee + refund`.
- Booking: server re-predicts the pass (±2 min of requested AOS), min lead 10 min, Postgres advisory lock per station, rejects overlaps with bookings and station blackout periods, debits escrow atomically.
- Platform fee: `PLATFORM_FEE_BPS` (default 800 = 8%), taken from the station's earned share.
- Cancel: operator up to 1 h before AOS, station any time before AOS → full refund.
- No settlement within 24 h after LOS → operator/admin can reclaim full escrow (`expired`).
- Receipts with an invalid signature or wrong manifest root are **refused** (resubmittable), never settled at 0%.
- Disputes: within 24 h of settlement, one open per booking; admin may move up to the station's payout back to the operator.
- Reliability score: 60% avg verified delivery + 30% completion rate + 10% dispute record (−20 per lost dispute); "New" until first settlement.

**Other**
- Natural-language pass search (`lib/nl-search.ts`) is deterministic regex parsing — no LLM — and never affects prices.
- Shared Postgres rate limiting for login, sign-up, password reset (`lib/server/ratelimit.ts`); in-memory limits elsewhere.
- Email via Resend (`lib/server/email.ts`); without `RESEND_API_KEY` + `EMAIL_FROM`, reset/confirmation are disabled and the UI says so.

## 5. Pages

| Role | Pages |
|---|---|
| Public | `/` landing (intro animation, live stats, verified stations, Guaranteed Downlink section), `/estimate` (earnings estimate, no sign-up), `/proof/[id]` (re-verified pass proof), `/proof/contract/[id]` (contract certificate), `/login`, `/forgot`, `/reset`, `/verify-email`, `/terms`, `/privacy` |
| Operator | Overview, Find Passes (book + plain-English search), Guaranteed Downlink (plan, price, buy, progress), My Bookings (+ calendar export) (manifest, cancel, refund, dispute), Stations, My Satellites, Wallet, Disputes, Owner verification |
| Station owner | Overview, My Stations (signing key, blackout periods), Bookings (signed receipts), Earnings & reliability, Disputes, Owner verification |
| Admin | Overview (KPIs, health, credit grants), Verification review, Asset review, Disputes |
| Shared | Profile (+ change password), Live pass view `/dashboard/live-pass/[id]` (countdown, SGP4 sky track, RSSI chart) |

## 6. Tools (`scripts/`)

- `station-keygen.mjs` — station signing key pair; register the public key under My Stations.
- `make-manifest.mjs <framesDir>` — operator manifest of frame hashes.
- `sign-receipt.mjs --booking --station --root --frames --key` — station receipt.
- `create-admin.mts` — via `npm run create-admin -- <email> <password> [name]`.
- `demo-seed.mts` — `npm run demo:seed` creates the labelled demo network (6 "Demo ·" stations, 3 owners, 1 operator with ISS + NOAA 19, 5,000 credits); `-- --remove` deletes it. Logins and keys in `.demo/accounts.json` (git-ignored).
- `demo-agent.mjs` — `npm run demo:agent -- --url https://orbitpasss.netlify.app --cancel 0.2`: station + operator agent; commits manifests, signs receipts after real passes, optionally cancels guaranteed passes to show re-booking.

## 7. Testing status

- Unit tests (`npm test`): 36 — verifier, settlement, verification rules, NL search, guarantee planner (capacity, backups, premium, confidence, progress, re-booking top-up).
- Guaranteed Downlink tested against the real database: quote, purchase (charged exactly the quote), stale-price refusal, and auto re-booking after 7 simulated station cancellations.
- End-to-end against the real database (run ad hoc, test data cleaned up): verification gate (21 checks), full booking lifecycle (49 checks: escrow, manifest, signed receipt, 94/100 settlement = 86.48 / 7.52 / 6.00, cancel, expiry, dispute clawback, notifications, password change), live-site smoke tests.
- CI: `.github/workflows/ci.yml` (validate schema, type-check, lint, test, build).

## 8. Decisions made with the owner

- Payments: credits ledger first; real rail (Razorpay/Stripe/on-chain) later behind the same booking flow.
- Email provider: Resend (key not yet added).
- Demo mode removed: no sample stations/prices; marketplace shows only verified assets. Exception approved for the hackathon (21 Nov 2026): the clearly labelled demo network from `npm run demo:seed`, to be removed after judging.
- Google sign-in and the visible admin link were removed.
- Commits must not mention AI tooling or add co-author trailers.

## 9. Status — done vs remaining

### Done — live on https://orbitpasss.netlify.app
- Everything from the first release: accounts and sessions, owner verification, asset approval, SGP4 pass finder, escrow booking, Proof of Downlink settlement, disputes, reliability, live pass view, notifications, admin tools.
- **Database moved to Supabase US East** (project `aezbgmscxzeusukxncrj`); queries ~70 ms from Netlify instead of ~1 s. Old Sydney project kept as a fallback.
- **New frontend**: editorial landing page with WebGL intro and a turning dotted-globe emblem, restyled dashboard, login and pass finder.
- **Guaranteed Downlink**: data contracts, pass planner, backup passes to 95% confidence, guarantee premium, auto re-booking, release of unused passes on fulfilment, automatic compensation on a missed deadline, progress tracker.
- **Public proof page** per settled pass (re-verified on each visit) and **contract certificate**.
- **Earnings estimate** for prospective stations; **calendar (.ics) export**; demo seed + station agent.
- Passes that start with no committed manifest are released straight away (cancelled, refunded, not counted against the station) instead of waiting 24 h.

### Not yet seen working end to end
- Release-on-fulfilment and compensation-on-miss: built and wired, waiting for real settled passes from the demo agent.

### Remaining — can be done without the owner
1. Optional scheduled function for the expiry/contract sweep (today it runs when pages or APIs are read).
2. Delivery-history model, coverage-gap map, guaranteed-demand bonus, saved searches, webhook alerts, operator API, invoices/CSV export.
3. Update the explainer video to show Guaranteed Downlink.

### Remaining — needs the owner's accounts or decisions
4. **Email:** Resend account + verified domain; set `RESEND_API_KEY` and `EMAIL_FROM`.
5. **Real payments and station payouts** (Razorpay, Stripe or on-chain); subscriptions on top.
6. **Weather / space-weather risk** data feeds.
7. **KYC provider**, **legal review** of Terms and Privacy, **custom domain**, **monitoring** (Sentry, uptime on `/api/health`, backups).
8. After judging: `npm run demo:seed -- --remove`; delete the old Sydney Supabase project; remove the `OLD_*` lines from `.env`.
