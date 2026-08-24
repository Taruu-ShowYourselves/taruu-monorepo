Split. Issue #84 spans at least four independently reviewable PRs:

1. Read-only production API/UI probe and evidence bundle.
2. GitHub incident deduplication, recurrence, and recovery state.
3. Authenticated canary happy-flow after identities, dry-run endpoints, and secret ownership are approved.
4. Scheduling and alert delivery, requiring an explicit decision on protected workflows versus Cloudflare cron.

The spec below covers slice 1 only.

# Spec — issue #84 read-only-production-monitor v1

## Current state

The existing Playwright harness accepts `PLAYWRIGHT_BASE_URL` and already produces retry traces, HTML reports, console access, network observations, and failure screenshots through `apps/web/playwright.config.ts`.
Current smoke coverage in `apps/web/tests/e2e/smoke.spec.ts` checks availability and unauthenticated rejection paths, but its broad response ranges are not production-grade health contracts.
Public, non-mutating integration points include localized council, municipality, votes, vote-detail, and feed pages plus aggregate-only `GET /api/votes`.
Structured logging in `apps/web/src/lib/logger.ts` supplies timestamps but no correlation IDs, so evidence must capture a response correlation header when present and explicitly record its absence otherwise.
Scheduling, authenticated canary provisioning, incident reporting, persistence, and alert transport have no approved seam yet and are intentionally deferred.

## Goal

Add a deterministic, manually runnable Playwright production-monitor suite for public read-only API and UI surfaces. Each run must enforce strict response contracts, collect sanitized route-level evidence, and produce actionable failure artifacts without authenticating, mutating production data, or contacting GitHub or alert recipients. This establishes the probe and evidence boundary consumed by later scheduling and incident-lifecycle slices.

## In scope

- claim: apps/web/tests/e2e/production-monitor.spec.ts
- claim: apps/web/tests/e2e/support/production-monitor.ts
- claim: apps/web/tests/e2e/production-monitor-contract.spec.ts
- claim: apps/web/package.json

## Out of scope

- Scheduled execution in Cloudflare, GitHub Actions, systemd, or an external monitor.
- Authenticated login canaries or storage of canary credentials.
- Resident happy-flow completion.
- Proposal creation, ballot participation, notification sending, payment creation, or any other mutation.
- Notification preview, because it is an authenticated `POST` staging operation and requires an approved canary identity and space.
- Visual-regression baselines or pixel-difference thresholds; screenshots in this slice are diagnostic evidence only.
- GitHub issue creation, fingerprinting, deduplication, recurrence comments, recovery comments, labels, closing, or project movement.
- Email, Telegram, or other immediate alert delivery.
- A new `/api/health`, monitoring dashboard, persistent run-history store, or database schema; ownership overlaps issue #102.
- Multi-region execution, latency SLO enforcement, and production failure-injection switches until their thresholds and execution platform are approved.
- Any changes to application routes, authentication, logger behavior, deployment configuration, or production data.

## Contracts

The package exposes a `monitor:production` script that runs only `tests/e2e/production-monitor.spec.ts` with the existing Playwright configuration. It requires an explicit `PLAYWRIGHT_BASE_URL`; the monitor must fail before issuing requests when the variable is absent, malformed, or not HTTPS, except that loopback HTTP URLs are permitted for deterministic contract tests.

The production suite probes only an explicit allowlist of read-only targets:

- `GET /api/votes`
- `GET /{locale}/council`
- `GET /{locale}/municipalities`
- `GET /{locale}/votes`
- `GET /{locale}/feed`

The locale is supplied by `MONITOR_LOCALE` and defaults to `he`. No target may use a method other than `GET`. Redirects may be followed only within the configured base origin. A redirect to another origin, an authentication form, or a mutating endpoint is a failure.

A successful API probe requires:

- HTTP 200.
- JSON content type.
- A parseable JSON body.
- The documented aggregate/list response shape asserted by the existing application contract, without accepting generic 4xx/5xx ranges.
- No request body, cookie injection, authorization header, or browser storage mutation by monitor code.

A successful UI probe requires:

- Final HTTP status below 400.
- Final URL on the configured origin.
- A non-empty document title or visible main landmark.
- No uncaught page error.
- No failed same-origin document, fetch, or XHR request.
- No same-origin document, fetch, or XHR request using a method other than `GET` or `HEAD`.

Each probe records one sanitized evidence object containing:

- Probe name and target route.
- UTC start timestamp and duration in milliseconds.
- Configured region from `MONITOR_REGION`, defaulting to `unspecified`.
- Request method and final status.
- Expected and actual result summaries.
- Correlation ID from `x-correlation-id`, `cf-ray`, or `traceparent`, in that priority order; otherwise the literal value `absent`.
- Sanitized console errors, page errors, and failed-network summaries.
- Screenshot path for UI failures.
- Playwright trace path when Playwright creates a retry trace.

Evidence must never include cookies, authorization headers, request or response bodies, canary credentials, query-string secrets, or resident data. URLs written to evidence must omit query strings and fragments.

A run-level JSON report is written beneath `apps/web/test-results/production-monitor/run-report.json`. Failure screenshots are written beneath `apps/web/test-results/production-monitor/screenshots/`. These are ephemeral CI/local artifacts and are not committed.

The contract test uses Playwright routing or a loopback fixture to inject deterministic success, HTTP failure, timeout, cross-origin redirect, console error, missing correlation ID, and attempted mutation cases. It must not require production access.

No database migration is introduced. No persistent state is introduced. The suite must not create votes, ballots, charges, notifications, users, sessions, or other application records.

## Acceptance gates

- G-1: The monitor refuses an unset, malformed, or non-HTTPS non-loopback `PLAYWRIGHT_BASE_URL` before any probe executes. → evidence: `pnpm --filter web exec playwright test tests/e2e/production-monitor-contract.spec.ts --grep "base URL boundary"`

- G-2: Deterministic API success, HTTP failure, timeout, and malformed-contract fixtures produce the expected pass/fail results with strict status and JSON-shape assertions. → evidence: `pnpm --filter web exec playwright test tests/e2e/production-monitor-contract.spec.ts --grep "API contract"`

- G-3: Deterministic UI fixtures detect an HTTP failure, uncaught page error, failed same-origin request, and cross-origin redirect. → evidence: `pnpm --filter web exec playwright test tests/e2e/production-monitor-contract.spec.ts --grep "UI failure detection"`

- G-4: A fixture that attempts `POST`, `PUT`, `PATCH`, or `DELETE` from a monitored page fails the run and records the attempted method and sanitized route. → evidence: `pnpm --filter web exec playwright test tests/e2e/production-monitor-contract.spec.ts --grep "mutation guard"`

- G-5: A seeded failure writes a JSON report containing route, UTC timestamp, region, duration, correlation ID or `absent`, expected/actual summaries, console/network errors, and a resolvable screenshot path. → evidence: `pnpm --filter web exec playwright test tests/e2e/production-monitor-contract.spec.ts --grep "failure evidence"` and `apps/web/test-results/production-monitor/run-report.json`

- G-6: Evidence-redaction tests prove that cookies, authorization values, query strings, response bodies, and configured secret sentinel values do not appear in the JSON report or screenshot filename. → evidence: `pnpm --filter web exec playwright test tests/e2e/production-monitor-contract.spec.ts --grep "evidence redaction"`

- G-7: The production monitor source contains only the declared read-only allowlist and issues no method other than `GET` or `HEAD`. → evidence: `pnpm --filter web exec playwright test tests/e2e/production-monitor-contract.spec.ts --grep "read-only allowlist"`

- G-8: The complete web test suite, typecheck, and lint remain green. → evidence: `pnpm --filter web test && pnpm --filter web typecheck && pnpm --filter web lint`

- G-9: A human-authorized production smoke run generates the requested run report and UI failure screenshot when pointed at an approved seeded-failure environment. This gate is not satisfied by running against live production without that authorization. → evidence: `PLAYWRIGHT_BASE_URL=<approved-seeded-environment> MONITOR_REGION=<region> pnpm --filter web monitor:production` plus `apps/web/test-results/production-monitor/run-report.json` and `apps/web/test-results/production-monitor/screenshots/`

## Protected paths

- `supabase/migrations/` — protected; no schema or migration change is permitted in this slice.
- `.github/workflows/` — protected; scheduling and CI workflow changes are deferred.
- `apps/web/src/app/api/payments/` — protected; real payment boundaries must not be probed or modified.

## Risk & rollback

The primary risks are false positives from overly strict public-page expectations, accidental mutation from page-side requests, sensitive data leaking into artifacts, and synthetic traffic being mistaken for resident activity. The explicit target allowlist, browser-level mutation guard, same-origin checks, sanitized evidence contract, and absence of authentication limit those risks.

If a probe proves unstable, remove that route from the explicit allowlist or revert this PR; no deployment schema, application endpoint, scheduled job, persistent state, incident issue, or production record requires cleanup. The entire slice can be disabled by ceasing invocation of `monitor:production`.