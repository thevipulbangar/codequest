# OrbitPass — Project Context

Living hand-over document: what exists, how it fits together, key decisions, and what is left.
Last updated: 11 November 2026.

## 1. Product in one paragraph

OrbitPass is a pay-per-pass marketplace connecting small-satellite operators with independent ground-station owners. Operators book individual passes; the fee is held in escrow (platform credits) and released only for frames proven delivered through **Proof of Downlink**: the operator commits a Merkle-rooted frame manifest before the pass, the station submits an ed25519-signed receipt after it, and a deterministic verifier settles pro-rata (station paid for the verified share minus the platform fee, operator refunded the rest).

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

- **Frontend:** Next.js 16 App Router, TypeScript, Tailwind v4, Framer Motion, React Three Fiber globe, Recharts. Dark aerospace theme; liquid-glass fixed nav; logo cropped from the provided artwork (`public/logo.png`, `app/icon.png`).
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
| Public | `/` landing (live stats, verified stations, globe), `/login`, `/forgot`, `/reset`, `/verify-email`, `/terms`, `/privacy` |
| Operator | Overview, Find Passes (book + plain-English search), My Bookings (manifest, cancel, refund, dispute), Stations, My Satellites, Wallet, Disputes, Owner verification |
| Station owner | Overview, My Stations (signing key, blackout periods), Bookings (signed receipts), Earnings & reliability, Disputes, Owner verification |
| Admin | Overview (KPIs, health, credit grants), Verification review, Asset review, Disputes |
| Shared | Profile (+ change password), Live pass view `/dashboard/live-pass/[id]` (countdown, SGP4 sky track, RSSI chart) |

## 6. Tools (`scripts/`)

- `station-keygen.mjs` — station signing key pair; register the public key under My Stations.
- `make-manifest.mjs <framesDir>` — operator manifest of frame hashes.
- `sign-receipt.mjs --booking --station --root --frames --key` — station receipt.
- `create-admin.mts` — via `npm run create-admin -- <email> <password> [name]`.

## 7. Testing status

- Unit tests (`npm test`): 25 — verifier, settlement, verification rules, NL search.
- End-to-end against the real database (run ad hoc, test data cleaned up): verification gate (21 checks), full booking lifecycle (49 checks: escrow, manifest, signed receipt, 94/100 settlement = 86.48 / 7.52 / 6.00, cancel, expiry, dispute clawback, notifications, password change), live-site smoke tests.
- CI: `.github/workflows/ci.yml` (validate schema, type-check, lint, test, build).

## 8. Decisions made with the owner

- Payments: credits ledger first; real rail (Razorpay/Stripe/on-chain) later behind the same booking flow.
- Email provider: Resend (key not yet added).
- Demo mode removed: no sample stations/prices; marketplace shows only verified assets (currently none).
- Google sign-in and the visible admin link were removed.
- Commits must not mention AI tooling or add co-author trailers.

## 9. Status — done vs remaining

### Done — live on https://orbitpasss.netlify.app (commit `794ed49` and later)
- Landing page: 3D globe, liquid-glass nav, animations, responsive layout, new logo, live counts of verified stations and satellites.
- Login: satellite operator / station owner tabs, unlisted admin login (`/login?as=admin`), show/hide password, real accounts in Supabase, secure sessions; change / forgot / reset password; email confirmation (needs email set up).
- Owner verification: encrypted document uploads, three badges, admin review and approval.
- Satellites and stations: owners register them; live only after the owner is verified **and** an admin approves the asset. Station signing key and blocked-time calendar.
- Pass finder: real SGP4 predictions for your own approved satellites over approved stations; **Book** button; plain-English search.
- Booking with credits escrow, cancel, refund when the station doesn't deliver, **automatic expiry** of undelivered bookings (checked on page loads, at most once a minute).
- Proof of Downlink: manifest before the pass, signed receipt after, automatic verification and pro-rata payout; invalid receipts refused.
- Operator wallet; station earnings and reliability score; disputes; live pass view (countdown, sky track, signal chart); notifications bell; admin overview with platform stats and credit grants.
- Terms and Privacy pages; CLI tools for signing key, manifest and receipt; GitHub Actions checks; README and this file.
- Netlify environment variables complete, including `APP_URL` and `PLATFORM_FEE_BPS`.
- **Verified on the live site:** the 49-step booking-lifecycle test passed (settlement 86.48 / 7.52 / 6.00 to the cent, tamper refusal, cancel, expiry, dispute clawback, search, notifications, password change), and every page returns 200.

### Fixed along the way (worth knowing)
- Receipts with a bad signature used to settle at 0% — now refused and resubmittable.
- The live pass page bundled the orbit library in the browser, which hung the production build (Netlify timed out on commit `93a71dd`). The sky track is now computed on the server.

### Remaining — can be done without the owner
1. Click through the new pages in a real browser on desktop and phone (so far verified through the API and page loads, not visually).
2. Optional: a scheduled function for auto-expiry if the site has no visitors for days (today expiry runs when pages are loaded).

### Remaining — needs the owner's accounts or decisions
3. **Speed:** create a Supabase project in **East US (Ohio)**, next to the Netlify functions; then migrate data, recreate the bucket and update env vars. Each DB query is ~1 s today.
4. **Email:** Resend account + verified domain; set `RESEND_API_KEY` and `EMAIL_FROM` (password reset and confirmations are off until then).
5. **Real payments:** choose Razorpay, Stripe or on-chain; add withdrawals for station owners. Today admins add credits after off-platform payment.
6. **KYC provider** for individual owners' identity and selfie checks (manual reviewer step today).
7. **Legal review** of the template Terms and Privacy pages.
8. **Custom domain** instead of `orbitpasss.netlify.app`.
9. **Monitoring:** error tracking (e.g. Sentry) and an uptime monitor on `/api/health`; confirm Supabase backups for the plan.
