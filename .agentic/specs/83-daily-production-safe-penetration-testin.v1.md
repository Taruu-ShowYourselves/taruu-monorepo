# Spec — issue #83 production-security-log-redaction v1

## Current state

Issue #83 cannot be delivered safely as one half-day PR and must be split. No production pentest runner, allowlist, budgets, stop state, evidence store, or finding model exists. The first prerequisite is the researched logging/redaction seam: `sanitizeContext` in `apps/web/src/lib/logger.ts` currently checks serializability but does not redact nested secrets or personal data, matching `SECURITY-AUDIT.md` finding 22. All structured production loggers, including the established `cronLogger` scheduled-job seam, pass context through this function. Cloudflare observability may retain emitted context, so future scanner evidence must not use this sink until recursive redaction is tested. This slice does not modify the scheduler, authenticated cron-route, rate-limiter, alert, issue-writing, human-triage, persistence, or runtime-evidence seams identified by RESEARCH.md.

Proposed later splits, each requiring its own approved spec:

1. Resolve operational policy: authorized targets, canaries, numeric budgets, stop semantics, schedule, alert recipients, severity rubric, evidence storage, and the #22 prerequisite.
2. Add disabled runner contracts, allowlist validation, budgets, stop checks, and production-equivalent fixtures.
3. Add encrypted persistence, retention, finding fingerprints, safe validation, alerts, and human-triaged issue creation.
4. Add the authenticated cron endpoint and Cloudflare schedule after protected-path and operational approval.
5. Add the administrator-only inventory/report UI and sanitized visual evidence.
6. Conduct the separately approved canary-production rollout.

## Goal

Make the central structured logger safe as a future security-agent logging dependency by recursively replacing explicitly sensitive context values with a fixed marker, including values nested in objects and arrays, without changing logger call signatures, severity routing, production JSON shape, or child-context behavior. This is a prerequisite slice only; it does not claim to satisfy the end-to-end acceptance criteria of issue #83.

## In scope

- claim: apps/web/src/lib/logger.ts
- claim: apps/web/src/__tests__/lib/logger.test.ts

## Out of scope

The production security runner; live requests; targets or test allowlists; canary accounts or data; mutation tracking; traffic, error, concurrency, bandwidth, or timeout budgets; emergency-stop storage or polling; rate-limit integration; schedules; cron endpoints; Cloudflare configuration; scanner findings; severity or confidence classification; deduplication; alerts; GitHub issues; database schema; encrypted evidence; retention; reports or UI; checked-in screenshots; dependency scanning; production deployment; changes to existing log call sites; and redaction of free-form log message strings.

No destructive testing, credential attacks, resident-data access, exploitation, third-party probing, automatic remediation, issue creation, PR creation, or deployment is authorized.

## Contracts

`logger`, `cronLogger`, and the other exported logger interfaces remain unchanged.

Before serialization or pretty-printing, every structured context object, including merged child context, must be copied and recursively sanitized:

- Keys are matched case-insensitively after removing non-alphanumeric characters.
- The sensitive-key allowlist is exactly: `password`, `passwd`, `secret`, `clientsecret`, `cronsecret`, `token`, `accesstoken`, `refreshtoken`, `authorization`, `cookie`, `setcookie`, `apikey`, `email`, `phone`, `phonenumber`, `address`, `nationalid`, `identitynumber`, `documentnumber`.
- A value whose normalized key matches that list is replaced with the literal string `[REDACTED]`.
- Matching applies at every object depth and to objects contained in arrays.
- Array order and non-sensitive primitive values are preserved.
- Input objects and arrays are not mutated.
- `Error` values retain the existing `{ name, message, stack }` representation. This slice does not attempt heuristic redaction inside error text or free-form messages; callers must not place sensitive material there.
- Circular or otherwise unserializable branches retain existing fail-safe behavior by becoming a string representation rather than causing logging to throw.
- Production output remains one JSON object containing `level`, `message`, `timestamp`, and optional `context`.
- No migration is introduced.

## Acceptance gates

- G-1: A focused test proves every exact sensitive key above is replaced by `[REDACTED]`, with case and separator variants included. → evidence: `pnpm --filter @sync/web test -- src/__tests__/lib/logger.test.ts`
- G-2: The focused test proves recursive redaction through nested objects and arrays, preservation of array order and non-sensitive values, and non-mutation of the supplied context. → evidence: `pnpm --filter @sync/web test -- src/__tests__/lib/logger.test.ts`
- G-3: The focused test proves sensitive values supplied through both parent and child logger contexts are redacted in captured console output. → evidence: `pnpm --filter @sync/web test -- src/__tests__/lib/logger.test.ts`
- G-4: The focused test proves `Error` formatting and circular-context logging do not throw, preserving the declared compatibility behavior. → evidence: `pnpm --filter @sync/web test -- src/__tests__/lib/logger.test.ts`
- G-5: The web package remains type-correct. → evidence: `pnpm --filter @sync/web typecheck`
- G-6: The complete web test suite passes, detecting regressions in existing logger consumers. → evidence: `pnpm --filter @sync/web test`
- G-7: The diff contains changes only to the two claimed files and none to any protected path. → evidence: `git diff --name-only -- apps/web/src/lib/logger.ts apps/web/src/__tests__/lib/logger.test.ts` and `git diff --name-only -- supabase/migrations .github/workflows apps/web/src/app/api/payments`

## Protected paths

- `supabase/migrations/` — protected; no changes authorized. Persistence and encrypted evidence require a later approved slice and fresh migration-slot collision check.
- `.github/workflows/` — protected; no changes authorized. Human-triage and explicit-comment-only dispatch remain unchanged.
- `apps/web/src/app/api/payments/` — protected; no changes authorized. Payment behavior is unrelated to this prerequisite.
- No protected-path modification is part of this spec.

## Risk & rollback

Overbroad matching could hide useful diagnostics; underbroad matching could leak sensitive context into retained production logs. The fixed, reviewable key list and focused output tests bound both risks. Recursive traversal could mishandle arrays, errors, or circular values, so those behaviors are explicit gates. This protection is key-based and does not make arbitrary message or error text safe for secrets.

Rollback is a normal revert of the two claimed files. No schema, schedule, external state, production data, or deployment configuration is changed.