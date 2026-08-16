# Research — issue #72

## Already-done check

- Acceptance criterion 1 — **MISSING.** There is no agreed mobile route/browser matrix or complete happy-flow report. The only configured mobile project is `mobile-390x844`, and it runs only `space-admin.spec.ts` ([apps/web/playwright.config.ts](apps/web/playwright.config.ts)). A council test manually checks overflow at 390×844, but only for one empty-state route ([apps/web/tests/e2e/council-public-page.spec.ts](apps/web/tests/e2e/council-public-page.spec.ts)).
- Acceptance criterion 2 — **MISSING.** No issue-72 defect register records severity, reproduction steps, route, viewport, and resolution. The only committed web evidence is for issue 65 ([docs/agent-evidence/issue-65/README.md](docs/agent-evidence/issue-65/README.md)).
- Acceptance criterion 3 — **MISSING.** RTL foundations exist through locale direction and logical CSS, but no automated accessibility scanner or critical-route RTL test suite exists ([apps/web/src/lib/i18n/config.ts](apps/web/src/lib/i18n/config.ts), [apps/web/src/app/[locale]/layout.tsx](apps/web/src/app/[locale]/layout.tsx), [apps/web/src/styles/globals.css](apps/web/src/styles/globals.css)). No axe dependency or accessibility CI step was found.
- Acceptance criterion 4 — **MISSING.** `test:e2e` exists, but PR CI runs Vitest, typecheck, lint, and build—not Playwright ([apps/web/package.json](apps/web/package.json), [.github/workflows/agent-verification.yml](.github/workflows/agent-verification.yml)). Playwright’s general project is desktop Chromium only; the mobile project is restricted to space-admin ([apps/web/playwright.config.ts](apps/web/playwright.config.ts)).

**Verdict: proceed.** The tree has useful partial coverage and responsive foundations, but does not satisfy the issue.

## Current-state map

### Route inventory

All user-facing pages use the Next App Router under `apps/web/src/app/[locale]`. Hebrew is exposed without a prefix; English uses `/en`. Middleware rewrites bare Hebrew paths internally and redirects visible `/he` paths to canonical bare URLs ([apps/web/src/middleware.ts](apps/web/src/middleware.ts), [apps/web/src/lib/i18n/config.ts](apps/web/src/lib/i18n/config.ts)).

- Public/product: `/`, `/about`, `/download`, `/economics`, `/explore`, `/faq`, `/feed`, `/government`, `/government/[slug]`, `/how-it-works`, `/knesset`, `/mandate`, `/municipality/[slug]`, `/pilot`, `/pitchdeck`, `/pricing`, `/support`, `/treasury`, `/what-is-taruu`.
- Legal: `/privacy`, `/refund`, `/terms`.
- Authentication/onboarding: `/sign-in`, `/sign-up`, `/sign-up/connect-social`, `/onboarding`.
- Resident account: `/dashboard`, `/settings/profile`, `/settings/municipality`, `/settings/notifications`, `/settings/social-connections`, `/verification`.
- Voting: `/votes`, `/votes/archive`, `/votes/create`, `/votes/[id]`. Survey/ballot interaction lives in [ParticipationFlow.tsx](apps/web/src/app/[locale]/votes/[id]/flow/ParticipationFlow.tsx).
- Councils/spaces: `/councils/[identifier]`, `/space-admin/[spaceId]`, plus its `/members`, `/proposals`, `/stats`, `/audit`, and `/dispatch` children.
- Commerce/payment: `/coin`, `/coin/[id]`, `/store`, `/store/[slug]`, `/store/cart`, `/store/thank-you`, `/payments/return`.
- Restricted operator surface: `/admin/pilot`.

There is no page implementing `/login`, `/dashboard/social`, `/dashboard/verification`, or a dedicated `/billing` route. Existing smoke tests still navigate to the first three stale paths ([apps/web/tests/e2e/smoke.spec.ts](apps/web/tests/e2e/smoke.spec.ts)). No route-level `error.tsx`, `global-error.tsx`, or `not-found.tsx` was found under `apps/web/src/app`.

### Layout and responsive pattern

- Global device viewport metadata permits zoom up to 5× ([apps/web/src/app/layout.tsx](apps/web/src/app/layout.tsx)).
- Locale layout owns the HTML language/direction, fonts, providers, and shared application shell ([apps/web/src/app/[locale]/layout.tsx](apps/web/src/app/[locale]/layout.tsx)).
- Global reset, tokens, reduced-motion handling, and base RTL-first styling live in [apps/web/src/styles/globals.css](apps/web/src/styles/globals.css) and [apps/web/src/styles/tokens.css](apps/web/src/styles/tokens.css).
- Route and component styling normally uses colocated CSS Modules. Existing modules contain numerous route-specific mobile breakpoints.
- `body { overflow-x: hidden; }` globally suppresses horizontal overflow. This can conceal an overflowing descendant, so regression tests should compare `documentElement.scrollWidth` with the viewport rather than rely on the absence of a scrollbar ([apps/web/src/styles/globals.css](apps/web/src/styles/globals.css)).
- Shared navigation is split between the regular header and the press-style masthead ([apps/web/src/components/layout/Header/Header.tsx](apps/web/src/components/layout/Header/Header.tsx), [apps/web/src/components/press/Masthead/Masthead.tsx](apps/web/src/components/press/Masthead/Masthead.tsx)).
- Space-admin has its own shared layout, navigation, dialogs, and route-local CSS ([apps/web/src/app/[locale]/space-admin/[spaceId]/layout.tsx](apps/web/src/app/[locale]/space-admin/[spaceId]/layout.tsx), [apps/web/src/components/space-admin](apps/web/src/components/space-admin)).

### Existing regression coverage

- Playwright tests cover smoke/API checks, vote detail, council public pages, identity documents, and space administration ([apps/web/tests/e2e](apps/web/tests/e2e)).
- The council suite has one explicit 390×844 no-overflow assertion and keyboard-focus assertion ([apps/web/tests/e2e/council-public-page.spec.ts](apps/web/tests/e2e/council-public-page.spec.ts)).
- Space-admin has deterministic SQL data and desktop/mobile screenshot mechanics ([apps/web/tests/e2e/fixtures/space-admin-seed.sql](apps/web/tests/e2e/fixtures/space-admin-seed.sql), [apps/web/tests/e2e/space-admin.spec.ts](apps/web/tests/e2e/space-admin.spec.ts)).
- Vote-detail tests query live Supabase data and skip if no active vote exists, so they are not deterministic coverage of the required flow ([apps/web/tests/e2e/vote-detail.spec.ts](apps/web/tests/e2e/vote-detail.spec.ts)).
- A payment Playwright-style file exists under the Vitest source-test tree rather than Playwright’s configured `tests/e2e` directory ([apps/web/src/__tests__/e2e/payment.test.ts](apps/web/src/__tests__/e2e/payment.test.ts), [apps/web/playwright.config.ts](apps/web/playwright.config.ts)).
- No visual comparison service, accessibility scanner, network-throttling suite, WebKit project, or real-device report was found.

## Integration points

- **Locale/routing seam:** `middleware()` and `localePath()`/`localePrefix()` control canonical Hebrew and English navigation ([apps/web/src/middleware.ts](apps/web/src/middleware.ts), [apps/web/src/lib/i18n/config.ts](apps/web/src/lib/i18n/config.ts)). Tests must use canonical `/...` Hebrew paths or `/en/...`, not `/he/...`.
- **Auth seam:** client session state is provided by [AuthProvider.tsx](apps/web/src/providers/AuthProvider.tsx); server enforcement uses `requireAuth()` in [apps/web/src/services/auth/session.ts](apps/web/src/services/auth/session.ts). Post-auth returns must pass through [safeRedirect.ts](apps/web/src/lib/safeRedirect.ts).
- **Dashboard seam:** `/api/dashboard` delegates to `server/app/dashboard/get-dashboard.ts`, which composes existing Supabase DB helpers ([apps/web/src/app/api/dashboard/route.ts](apps/web/src/app/api/dashboard/route.ts), [apps/web/src/server/app/dashboard/get-dashboard.ts](apps/web/src/server/app/dashboard/get-dashboard.ts)).
- **Vote seam:** UI routes are under `app/[locale]/votes`; HTTP endpoints are under `app/api/votes`; application use cases are under `server/app/votes`; persistence is in [vote.repo.ts](apps/web/src/server/infra/supabase/vote.repo.ts) and legacy/shared DB helpers in [db.ts](apps/web/src/lib/supabase/db.ts).
- **Council seam:** page → `/api/councils/[identifier]` → `server/app/council/get-public-profile.ts` → Supabase helpers, with the external response contract in `packages/shared/src/contracts/council.ts`.
- **Space-admin seam:** route handlers call `server/app/space-admin` use cases; authorization is centralized in `authorize.ts`; persistence is split across `server/infra/supabase/space-*.repo.ts`.
- **Payment seam:** public endpoints live under `app/api/payments`; Green Invoice defaults to its sandbox base URL unless `GREENINVOICE_ENV=production` ([apps/web/src/services/payments/greenInvoice.ts](apps/web/src/services/payments/greenInvoice.ts), [apps/web/src/lib/env.ts](apps/web/src/lib/env.ts)). Proposal approval depends on `CreationFeePort`; its current adapter records a pending obligation and does not capture money ([apps/web/src/server/app/space-admin/ports/creation-fee.ts](apps/web/src/server/app/space-admin/ports/creation-fee.ts), [apps/web/src/server/infra/payments/creation-fee.ts](apps/web/src/server/infra/payments/creation-fee.ts)).
- **Testing seam:** add route journeys under `apps/web/tests/e2e`; browser/viewports belong in [apps/web/playwright.config.ts](apps/web/playwright.config.ts). Deterministic relational data should follow the existing SQL-fixture pattern.
- **Evidence seam:** committed reports and screenshots belong under `docs/agent-evidence/issue-72`. The evidence checker requires a README and at least one image, while limiting an issue to four images ([scripts/agentic/check-evidence.mjs](scripts/agentic/check-evidence.mjs)).
- **Migration numbering:** migrations use timestamp filenames. The highest currently committed name is `20260811000004_pilot_program.sql` ([supabase/migrations](supabase/migrations)). Any required schema work must use a unique later timestamp; mobile layout/test remediation does not presently demonstrate a need for a migration.

## Prior art

The nearest merged PR is **PR #87**, commit `e7c7884`, “feat(web): add public council profiles.” It added a localized route, API handler, application/domain layers, shared contract, migration, deterministic mocked Playwright coverage, a 390×844 overflow check, keyboard-focus verification, and committed desktop/mobile evidence.

Copy its structure from:

- [apps/web/tests/e2e/council-public-page.spec.ts](apps/web/tests/e2e/council-public-page.spec.ts)
- [docs/agent-evidence/issue-65/README.md](docs/agent-evidence/issue-65/README.md)
- [apps/web/src/app/[locale]/councils/[identifier]/page.module.css](apps/web/src/app/[locale]/councils/[identifier]/page.module.css)

For screenshot naming across two widths and deterministic authenticated/operator data, also copy the newer space-admin pattern in [apps/web/tests/e2e/space-admin.spec.ts](apps/web/tests/e2e/space-admin.spec.ts) and its [SQL fixture](apps/web/tests/e2e/fixtures/space-admin-seed.sql).

For a narrowly scoped mobile CSS repair, commit `60ca74f`, “fix(press): all three clippings on mobile,” is the closest route-local precedent.

## Constraint register

- The worktree is clean; no pre-existing local modifications were reported by `git status --short`.
- Applied database state cannot be established from the working tree. The repository contains migrations through `20260811000004`, while [apps/web/docs/MORNING-CHECKLIST.md](apps/web/docs/MORNING-CHECKLIST.md) still describes `supabase db push` as an integration step. Treat migration application status as unknown.
- Protected paths potentially implicated are `.github/workflows/` for mandatory mobile CI and `apps/web/src/app/api/payments/` if payment-flow defects require server changes. Per [docs/PR-AUTOPILOT.md](docs/PR-AUTOPILOT.md), changes to either require an explicit protected-path declaration. `supabase/migrations/` is protected too, but no schema change is currently evidenced.
- Existing PR verification does not install Playwright browsers, start a web server, seed deterministic accounts, or execute `test:e2e` ([.github/workflows/agent-verification.yml](.github/workflows/agent-verification.yml).
- Existing mobile Playwright coverage is Chromium emulation at one viewport and is restricted to space-admin. Safari/WebKit and additional supported viewport decisions remain absent.
- Current smoke coverage references stale routes and accepts broad “page or login” outcomes, so it cannot prove the named happy flows ([apps/web/tests/e2e/smoke.spec.ts](apps/web/tests/e2e/smoke.spec.ts)).
- Vote-detail coverage can skip when environment data is absent; this violates deterministic-data intent ([apps/web/tests/e2e/vote-detail.spec.ts](apps/web/tests/e2e/vote-detail.spec.ts)).
- No deterministic resident test-account fixture was found. The existing deterministic SQL fixture is specifically for space-admin.
- No accepted lower-priority mobile finding register exists.
- No issue-72 evidence directory exists. The current evidence checker permits at most four screenshots, while the issue requests before/after evidence for every repaired route; that constraint may conflict with the requested evidence volume.
- Payment production integration is explicitly deferred in [apps/web/docs/MORNING-CHECKLIST.md](apps/web/docs/MORNING-CHECKLIST.md). Green Invoice sandbox is the default, and proposal approval currently records obligations rather than captures.
- Global `overflow-x: hidden` can mask defects rather than demonstrate their absence.
- No dedicated notification inbox or billing page exists; only notification settings and pricing/payment-return/store surfaces are present.
- No route-level error UI was found, despite errors being in scope.

## Open questions

1. Which browser set is approved: Chromium-only emulation, Chromium plus WebKit, or additional Firefox coverage?
2. Which exact mobile viewports and representative real devices are required beyond the existing 390×844 viewport?
3. Does “all user-facing routes” include operator routes (`/admin/pilot` and `/space-admin/*`), commerce/coin routes, and every marketing/legal page, or should the audit be split into bounded PRs?
4. Should the issue’s `/login` evidence requirement be interpreted as the actual `/sign-in` route, or must a `/login` compatibility redirect be introduced?
5. What are the approved deterministic resident roles and states for authentication, voting, vote creation, verification, dashboard, notification, and payment flows?
6. Which environment may be seeded for E2E, and may CI start an isolated local Supabase instance?
7. Is Green Invoice sandbox sufficient for payment acceptance, or is a provider stub required for fully deterministic CI?
8. What accessibility standard and scanner are authoritative: WCAG 2.2 AA with axe, another rule set, or a defined subset?
9. What network profiles and pass criteria define the required throttling checks?
10. How should before/after evidence for every repaired route fit the existing four-image-per-issue evidence limit?
11. Should missing notification-inbox, billing, and route-level error surfaces be treated as defects in this issue or documented as accepted gaps?
12. Who assigns P0/P1 severity and approves lower-priority deferrals before remediation begins?