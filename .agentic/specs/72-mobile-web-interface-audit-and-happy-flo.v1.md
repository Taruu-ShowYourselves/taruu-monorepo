# Spec — issue #72 mobile-critical-route-baseline v1

## Current state

- Mobile verification is incomplete: `mobile-390x844` only runs `space-admin.spec.ts`, while the only explicit mobile overflow assertion covers one council empty state ([apps/web/playwright.config.ts](apps/web/playwright.config.ts), [apps/web/tests/e2e/council-public-page.spec.ts](apps/web/tests/e2e/council-public-page.spec.ts)).
- Tests must use canonical Hebrew `/...` routes or English `/en/...`; `/he/...` is redirected by the locale/routing seam ([apps/web/src/middleware.ts](apps/web/src/middleware.ts), [apps/web/src/lib/i18n/config.ts](apps/web/src/lib/i18n/config.ts)).
- Existing smoke coverage references stale `/login`, `/dashboard/social`, and `/dashboard/verification` paths and permits ambiguous “page or login” outcomes ([apps/web/tests/e2e/smoke.spec.ts](apps/web/tests/e2e/smoke.spec.ts)).
- Global `overflow-x: hidden` can conceal layout defects, so mobile regression coverage must compare `documentElement.scrollWidth` with the viewport ([apps/web/src/styles/globals.css](apps/web/src/styles/globals.css)).
- Issue evidence belongs under `docs/agent-evidence/issue-72`; the evidence checker requires a README and image and permits at most four images ([scripts/agentic/check-evidence.mjs](scripts/agentic/check-evidence.mjs)).

## Goal

The full issue is too large for one half-day PR and must be split. This first slice establishes a deterministic Chromium mobile baseline at 390×844 for the canonical critical entry routes `/`, `/sign-in`, `/dashboard`, and `/votes`, replaces stale smoke-route expectations, and commits a machine-readable audit report with reproducible evidence. Later slices should separately cover authenticated voting, councils and space administration, commerce/payments, accessibility scanning and WebKit, and route-scoped remediation discovered by those audits.

## In scope

- claim: apps/web/playwright.config.ts
- claim: apps/web/tests/e2e/smoke.spec.ts
- claim: apps/web/tests/e2e/mobile-critical-routes.spec.ts
- claim: docs/agent-evidence/issue-72/README.md
- claim: docs/agent-evidence/issue-72/home-390x844.png
- claim: docs/agent-evidence/issue-72/sign-in-390x844.png
- claim: docs/agent-evidence/issue-72/votes-390x844.png

## Out of scope

Authenticated resident fixture creation; vote participation or creation; dynamic `/votes/[id]` and `/councils/[identifier]` journeys; operator routes; native applications; WebKit, Firefox, and real-device certification; axe integration; network throttling; visual redesign; payment-provider interaction; production-data mutation; API, database, migration, or CI workflow changes; and fixing defects not reproducible on the four named routes at 390×844.

This split does not close issue #72. Follow-up PRs are required for:

1. Deterministic authenticated dashboard and vote flows.
2. Council and space-admin mobile flows.
3. Commerce and sandbox payment flows.
4. WCAG/axe, WebKit, throttling, and real-device verification.
5. Route-scoped P0/P1 repairs with before/after evidence.

## Contracts

- The supported combination for this baseline is Playwright Chromium mobile emulation at a 390×844 viewport with touch enabled. It is not a declaration that Chromium-only coverage satisfies the parent issue.
- Tests use canonical Hebrew paths `/`, `/sign-in`, `/dashboard`, and `/votes`; they must not introduce or navigate through `/he/...` or treat `/login` as an implemented route.
- Unauthenticated `/dashboard` behavior must be asserted as the application’s concrete authentication redirect or sign-in state, not accepted through a broad “dashboard or login” condition. Redirect targets must remain compatible with the existing `safeRedirect` post-auth seam.
- Horizontal-overflow checks assert `document.documentElement.scrollWidth <= document.documentElement.clientWidth`; scrollbar visibility is not sufficient.
- Each route record in the evidence README must include route, viewport, browser project, authentication state, result, and any defect’s severity, reproduction steps, and resolution or explicit deferral.
- Tests must not seed, create, update, or delete production data and must not invoke payment endpoints.
- No API shape changes and no database migrations are permitted.
- Existing desktop Playwright projects and existing space-admin mobile selection must continue to run unchanged.

## Acceptance gates

- G-1: Playwright lists a dedicated Chromium 390×844 project that selects `mobile-critical-routes.spec.ts`, while the existing desktop and space-admin mobile projects remain configured → evidence: `cd apps/web && pnpm exec playwright test --list`
- G-2: `/`, `/sign-in`, `/dashboard`, and `/votes` each load through their canonical path with an explicit expected status or authentication redirect and no console page error → evidence: `cd apps/web && pnpm exec playwright test tests/e2e/mobile-critical-routes.spec.ts --project=mobile-critical-390x844`
- G-3: Every tested route satisfies `document.documentElement.scrollWidth <= document.documentElement.clientWidth` at 390×844 → evidence: `cd apps/web && pnpm exec playwright test tests/e2e/mobile-critical-routes.spec.ts --project=mobile-critical-390x844`
- G-4: The stale `/login`, `/dashboard/social`, and `/dashboard/verification` journeys are absent from smoke coverage, and smoke assertions name the actual route or redirect outcome → evidence: `! rg -n '(/login|/dashboard/social|/dashboard/verification)' apps/web/tests/e2e/smoke.spec.ts`
- G-5: The issue-72 report contains one matrix row for each of the four routes and every non-passing row contains severity, reproduction steps, and resolution or deferral → evidence: `rg -n '^\| /(|sign-in|dashboard|votes) \|' docs/agent-evidence/issue-72/README.md`
- G-6: Three committed 390×844 screenshots are generated for the stable public surfaces and pass the repository evidence policy → evidence: `node scripts/agentic/check-evidence.mjs 72`
- G-7: Existing web unit tests, type checking, and linting remain green → evidence: `pnpm --filter web test && pnpm --filter web typecheck && pnpm --filter web lint`

## Protected paths

- `supabase/migrations/` — protected and unchanged; this baseline requires no schema work.
- `.github/workflows/` — protected and unchanged; CI installation and execution of mobile Playwright belongs in a later infrastructure slice.
- `apps/web/src/app/api/payments/` — protected and unchanged; payment flows are outside this slice.

## Risk & rollback

Incorrect route expectations could hide a broken authentication redirect, and widening Playwright project matching could unexpectedly run stateful suites on mobile. Keep the new project restricted to the new critical-route test and preserve existing projects verbatim. Screenshot instability is limited by capturing only stable public surfaces and avoiding dynamic data assertions. Rollback is a revert of this slice’s test configuration, test files, and issue-72 evidence; it requires no database, API, payment, or production-data recovery.