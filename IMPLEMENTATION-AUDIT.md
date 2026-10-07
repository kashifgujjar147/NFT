# Patch 4 — Production Hardening Audit

## Current verdict
**NOT FINAL-COMPLETE — RUNTIME GATES BLOCKED**

The source was hardened further, but the final acceptance rule is intentionally not marked complete because this environment cannot currently complete a clean npm dependency install or provide a real transaction-capable MongoDB runtime.

## Patch 4 fixes applied
- Financial reward/profit/capital writes now execute ledger + audit creation inside MongoDB transactions.
- Package purchase now records package purchase audit and commission audits inside the same transaction.
- Commission calculation uses centralized cent-based rounding.
- Withdrawal fee/net calculation uses centralized cent-based calculation.
- Withdrawal cooldown is claimed atomically on the member record inside the transaction, preventing concurrent submissions from bypassing the rolling cooldown.
- Password reset revokes all active refresh sessions for the member.
- Withdrawal reservation reversal marks the original pending transaction `reversed` before creating the release transaction.
- Reward and profit admin adjustments require unique source/idempotency references.
- Package purchase and withdrawal require unique idempotency keys and return an existing record for a repeated key.
- Package inventory decrement remains an atomic conditional update, protecting the last item under concurrent purchases.
- Capital unlock checks `status=locked` and `unlockAt <= server now` inside a transaction and is idempotent.
- Uploaded files are checked against magic-byte signatures after MIME filtering; invalid content is deleted and rejected.
- Payment-change request values are encrypted at rest and member request history no longer exposes encrypted payment values.
- Member withdrawal UI no longer treats a hardcoded 10% rate as authoritative; it reads the server-published fee configuration for preview only.
- Real MongoDB E2E coverage was added for referral hierarchy, deposits, package concurrency/idempotency, 10/2/1 commissions, withdrawal fee/cooldown/global disable, capital locking, and role escalation.

## Verification completed in this environment
- Source TypeScript/TSX parser check: **PASS**
- Local relative import resolution check: **PASS**
- Centralized money/capital rule execution: **PASS**
- Source audit for TODO/FIXME/mock/fake/dummy markers: **PASS** in application source/tests; the final audit documents intentionally mention verification limitations.
- Meaningless `expect(true).toBe(true)` test removed and replaced with executable commission-rule assertions.
- Compiled `server/dist` artifacts removed from the clean release tree.
- ZIP source-artifact policy can be checked locally.

## Verification blocked
- `npm install --no-audit --no-fund`: **TIMED OUT**
- No `node_modules` is available after the timed-out install.
- No `package-lock.json` is present; it must not be fabricated.
- `tsc -p shared/tsconfig.json --noEmit`: **BLOCKED by missing installed dependencies** (`zod` and its inferred types).
- Real MongoDB replica set: **NOT AVAILABLE in this environment**.
- Full API/E2E/security runtime execution: **BLOCKED by missing dependencies and MongoDB**.
- Production client/server build: **BLOCKED by missing dependencies**.
- Browser/mobile runtime QA: **BLOCKED by missing install/build/runtime environment**.

## Release decision
Do **not** label the current artifact as production-complete. A final release requires a clean dependency installation, generated package-lock, transaction-capable MongoDB, successful typecheck/lint/tests/E2E/security tests/build/startup, and final ZIP inspection.
