# Nexus Member / NFT / Package / Team / Deposit / Withdrawal / Capital Platform

A new full-stack TypeScript implementation with separate React/Vite client, Express API, MongoDB/Mongoose persistence, shared schemas, auditable ledger logic, role-based authorization, and mobile-first member UX.

## Stack
- Client: React 19, TypeScript, Vite, React Router, Axios
- Server: Node.js, TypeScript, Express 5, Mongoose, MongoDB
- Security: Helmet, CORS, rate limiting, bcrypt, JWT access tokens, HttpOnly refresh cookie, Zod validation, secure upload filtering

## Setup
1. Install Node.js 20+ and MongoDB 7+ / MongoDB Atlas.
2. Copy `.env.example` to `server/.env`.
3. Set a strong `JWT_SECRET` and `REFRESH_TOKEN_SECRET` (32+ characters each).
4. Set `MONGODB_URI` and `CLIENT_URL`.
5. Run `npm install` from the root.
6. Run `npm run seed` from the root workspace wrapper if added, or `npm --workspace server run seed`.
7. Start with `npm run dev`.

The seed command creates an initial super-admin only when `SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD`, and `SEED_ADMIN_MOBILE` are explicitly configured. No default administrator credentials are created.

## Commands
- `npm install`
- `npm run dev`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm --workspace server run seed`

## Environment
See `.env.example`. SMTP variables enable real password-reset email delivery. Without SMTP configuration the reset token is generated server-side but is not exposed by the production API; configure SMTP for the complete forgot-password delivery workflow.

## Financial architecture
Balances are not authoritative in the browser. Deposits are pending until server-side admin approval. Withdrawals use server timestamps, a configurable global enable/disable switch, a configurable fee (default 10%), and a configurable cooldown (default 24 hours). Package inventory is decremented atomically. Referral commissions are created with unique `(beneficiary, source reference, level)` protection. Capital is stored separately as locked/available state and unlocks from server timestamps after the configured lock period (default 30 days).

The ledger contains transaction IDs, type, amount, direction, status, reference, description, related entity, actor, timestamps and metadata. Platform withdrawal fees are recorded separately from the member wallet to avoid double-debiting the member.

## Referral rules
Default configurable rates are Level 1 = 10%, Level 2 = 2%, Level 3 = 1%. The backend resolves the three upliner levels and calculates commissions. The client does not calculate authoritative commissions.

## Security notes
- Role checks are enforced on the API.
- Access tokens are short-lived; refresh tokens are HttpOnly cookies.
- Passwords use bcrypt with cost 12.
- Validation is server-side with Zod.
- File uploads are MIME/extension/size restricted, checked against magic-byte signatures, and receive generated filenames.
- Important admin actions create audit records.
- Financial state changes use MongoDB transactions, unique references/idempotency keys, and atomic inventory/wallet updates where required.
- No secrets are committed.

## Deployment
Build the client and server independently. Set the production client URL and server environment values. Use HTTPS, MongoDB Atlas/managed MongoDB, secure upload storage, and a reverse proxy. Do not expose MongoDB publicly.

## Product/legal note
Configurable rewards/profit rules are platform rules and are not represented in the UI as guaranteed investment returns. Operators are responsible for applicable financial, consumer-protection, licensing, tax, AML/KYC, and other legal requirements in their jurisdiction.

## Patch 4 verification status
Patch 4 additionally hardens transaction-scoped audits, cent-based money calculations, duplicate financial requests, withdrawal reversal state, package concurrency, capital unlock idempotency, encrypted payment-change requests, and upload magic-byte validation. A real MongoDB E2E suite is included under `server/tests/e2e/`.

The current artifact is **NOT PRODUCTION READY / NOT RELEASE-CERTIFIED**. In this verification environment, a clean npm dependency installation timed out and no transaction-capable MongoDB replica set is available. Therefore typecheck/lint/full tests/E2E/build/startup/browser verification could not honestly be marked passed, and no `package-lock.json` was fabricated. A release candidate must complete those gates in a networked environment with MongoDB transactions enabled.

## PATCH 4 verification note

Final hardening added atomic withdrawal cooldown claiming to prevent concurrent withdrawal submissions from bypassing the cooldown, and password reset now revokes active refresh sessions. Compiled `server/dist` artifacts are excluded from the clean source release.

## PATCH 3 security note — encryption key migration

Encrypted payment fields now use the dedicated `ENCRYPTION_KEY` environment variable. Existing `v1:` values created before this change remain decryptable through a compatibility fallback derived from the legacy `JWT_SECRET`; new writes always use `ENCRYPTION_KEY`. Do not rotate or remove the legacy JWT secret until existing encrypted data has been migrated/re-encrypted under the dedicated key.

## Final Fix Patch Verification (2026-10-06)

This release includes the final audit-gap fixes for referral `?ref=` registration, authenticated admin receipt preview, in-memory access-token handling with refresh-on-reload, safe nested settings updates, and package image management (remove/reorder/primary image).

Verification status:
- Source TypeScript/TSX syntax audit: PASS.
- Frontend/backend dependency-backed typecheck, lint, tests, and builds: BLOCKED because `npm install --no-audit --no-fund` timed out in the verification environment.
- Real MongoDB transaction/E2E verification: BLOCKED because no transaction-capable MongoDB runtime was available.
- No package-lock was fabricated; a real lockfile must be generated by a successful npm install/ci before production certification.
