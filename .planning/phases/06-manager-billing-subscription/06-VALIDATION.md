---
phase: 6
slug: manager-billing-subscription
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
updated: 2026-08-03
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from REQUIREMENTS.md MGR-01..05, the ROADMAP Phase 6 success criteria, and issue #79's
> own "Verification plan" section.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^1.0.0 (already configured — no install needed) |
| **Config file** | `apps/web/vitest.config.ts` (**unchanged** by this phase) |
| **Quick run command** | `cd apps/web && npx vitest run src/server/domain/billing src/server/app/authz src/__tests__/api/manager-billing.test.ts src/__tests__/api/manager-renewals.test.ts` |
| **Full suite command** | `pnpm --filter @sync/web test` |
| **Typecheck gate** | `pnpm --filter @sync/web typecheck` |
| **Estimated runtime** | ~15 seconds quick, ~70 seconds full |

### Constraints this phase must respect (verified 2026-08-03)

- `environment: 'node'` — **no jsdom**, no `@testing-library/react`.
- `include: ['src/**/*.test.ts', 'src/**/*.spec.ts']` — **`.tsx` is never collected.** Component
  behaviour is tested by extracting logic into a `.ts` module with injected dependencies and
  asserting component copy against source text. Plan 06-09 does exactly this.
- **No task may verify against a test file a later task in the same plan creates.** Vitest exits 1
  with "No test files found". Such tasks gate on `pnpm --filter @sync/web typecheck` plus a positive
  `grep` instead. Every plan in this phase was written against this rule.
- No watch-mode flags anywhere — every command is a single-shot `vitest run`.

### The one suite that needs credentials

Nothing in this phase's automated suite talks to Green Invoice. The provider adapter is unit-tested
against a stubbed `fetch`; the live provider behaviour is plan 06-01 (a gate) and plan 06-11 (the
sign-off), both human-run and both recorded as documents rather than tests.

---

## Sampling Rate

- **After every task commit:** `cd apps/web && npx vitest run <changed test files>`
- **After every plan wave:** `pnpm --filter @sync/web test`
- **Before `/gsd:verify-work`:** full suite green, `typecheck` green, `lint` no new warnings, **plus**
  `apps/web/docs/SPIKE-RESULT.md` Part A containing zero `(pending live run)` rows and
  `apps/web/docs/MANAGER-BILLING-VERIFICATION.md` filled
- **Max feedback latency:** 70 seconds

---

## Per-Task Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|---|---|---|---|---|---|
| GATE (SPIKE-01) | `SPIKE-RESULT.md` Part A has no `(pending live run)` row; the saved-card token field name and the MIT charge/document ids are recorded | doc grep (human-run source) | plan 06-01 Task 1 grep block | ✅ exists (template) | ⬜ pending |
| GATE (cron) | The renewal trigger decision is recorded in `apps/web/docs/MANAGER-BILLING-TRIGGER.md` with the chosen option and its rationale | doc grep | plan 06-01 Task 2 grep block | ❌ W0 | ⬜ pending |
| MGR-02 | The migration creates four tables, eight subscription states as `TEXT`+`CHECK`, an append-only trigger reusing `public.reject_audit_mutation()`, `SELECT`-only RLS `TO authenticated`, and a `UNIQUE` idempotency key | grep on the migration | plan 06-02 Task 1 grep block | ❌ W0 | ⬜ pending |
| MGR-02 | `transitionSubscription(from, event)` allows exactly the transitions in the table and denies everything else; a denied transition returns a reason, never a silent no-op | unit (pure) | `npx vitest run src/server/domain/billing/subscription.test.ts` | ❌ W0 | ⬜ pending |
| MGR-04 | `computeNextPeriod`, `nextRetryAt` (+1/+3/+7d), `graceUntil` (+14d), `deriveDueAction`, and `isBillingActive` (true only for `active` and `grace`) are pure and total | unit (pure, injected clock) | `npx vitest run src/server/domain/billing/schedule.test.ts` | ❌ W0 | ⬜ pending |
| MGR-04 | Every access-affecting transition maps to exactly one Hebrew notice; non-access-affecting transitions map to `null` | unit (pure) | `npx vitest run src/server/domain/billing/notice.test.ts` | ❌ W0 | ⬜ pending |
| MGR-03 | `buildChargeIdempotencyKey` is deterministic from `(subscriptionId, periodStart, attempt)` and contains no timestamp; `claimCharge` returns the existing row on SQLSTATE `23505` instead of throwing | unit (pure) + repo unit | `npx vitest run src/server/domain/billing/idempotency.test.ts src/__tests__/services/subscription-repo.test.ts` | ❌ W0 | ⬜ pending |
| MGR-03 | The provider adapter never logs or persists a card number, sends a server-built idempotency key, and its webhook verifier fails **closed** in production and uses `secureEqual` | unit (stubbed `fetch`) | `npx vitest run src/__tests__/services/billing-greeninvoice.test.ts` | ❌ W0 | ⬜ pending |
| MGR-01 | `requireRole(u,'community_manager',space)` with an active grant and a non-active subscription denies with `billing_inactive`; with an `active` or `grace` subscription it allows; `super_admin` and `space_admin` are **never** billing-gated | unit (mocked repos, real policy) | `npx vitest run src/server/app/authz/require-role.test.ts src/server/domain/authz/policy.test.ts` | ✅ exists (must be extended) | ⬜ pending |
| MGR-01 | `POST /api/manager-billing/checkout` returns 403 for a user with no active `community_manager` grant, and there is no code path from a settled charge to `insertGrant` | route test (mocked repos) | `npx vitest run src/__tests__/api/manager-billing.test.ts` | ❌ W0 | ⬜ pending |
| MGR-03 | Replaying the activation webhook produces one charge row, one `chargeToken` call and one transition; a second delivery returns `{ idempotent: true }` | route test (mocked repos + adapter) | `npx vitest run src/__tests__/api/manager-billing.test.ts` | ❌ W0 | ⬜ pending |
| MGR-03, MGR-04 | The renewal job charges only due subscriptions, calls the provider once per period however many times it runs, and walks `active → past_due → grace → expired` on repeated failure | use-case test (mocked repos + adapter, injected clock) | `npx vitest run src/__tests__/api/manager-renewals.test.ts` | ❌ W0 | ⬜ pending |
| MGR-04 | Cancellation is end-of-period (access retained until `current_period_end`), and a super-admin suspend is recorded with a reason and is independent of billing | use-case + route test | `npx vitest run src/__tests__/api/manager-billing-cancel.test.ts` | ❌ W0 | ⬜ pending |
| MGR-04 | A notification is attempted on every access-affecting transition, and a notifier failure does not reverse or block the transition | use-case test (mocked email) | `npx vitest run src/__tests__/services/billing-notify.test.ts` | ❌ W0 | ⬜ pending |
| MGR-05 | Reconciliation reports both directions of mismatch and returns a non-zero `openMismatches` when either side is missing a row; it performs no writes to subscription state | unit (pure diff) + route test | `npx vitest run src/server/domain/billing/reconcile.test.ts src/__tests__/api/manager-billing-reconcile.test.ts` | ❌ W0 | ⬜ pending |
| MGR-01, MGR-04 | The Hebrew/RTL billing panel renders state from the server and never decides access locally; its copy contains no "₪6" and no "מנוי חבר" | logic unit + source grep | `npx vitest run src/__tests__/services/billing-panel-model.test.ts` + plan 06-09 grep block | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Nothing to install. Vitest, `neverthrow`, `zod`, `jose` and `@supabase/supabase-js` are already
dependencies. Wave 0 is scaffolding that does not exist yet:

- [ ] `apps/web/docs/MANAGER-BILLING-TRIGGER.md` — the recorded renewal-trigger decision (06-01)
- [ ] `supabase/migrations/20260803000001_manager_billing.sql` (06-02)
- [ ] `packages/shared/src/contracts/managerBilling.ts` (06-02)
- [ ] `apps/web/src/server/domain/billing/subscription.ts` + `subscription.test.ts` (06-03)
- [ ] `apps/web/src/server/domain/billing/schedule.ts` + `schedule.test.ts` (06-03)
- [ ] `apps/web/src/server/domain/billing/notice.ts` + `notice.test.ts` (06-03)
- [ ] `apps/web/src/server/domain/billing/idempotency.ts` + `idempotency.test.ts` (06-04)
- [ ] `apps/web/src/server/infra/supabase/subscription.repo.ts` + `src/__tests__/services/subscription-repo.test.ts` (06-04)
- [ ] `apps/web/src/services/billing/greenInvoice.ts` + `src/__tests__/services/billing-greeninvoice.test.ts` (06-04)
- [ ] `apps/web/src/server/app/billing/notify.ts` + `src/__tests__/services/billing-notify.test.ts` (06-04)
- [ ] `apps/web/src/server/app/billing/status.ts` (06-05)
- [ ] `apps/web/src/__tests__/api/manager-billing-status.test.ts` (06-05)
- [ ] `apps/web/src/server/app/billing/charge.ts`, `start-checkout.ts`, `activate.ts` (06-06)
- [ ] `apps/web/src/__tests__/api/manager-billing.test.ts` (06-06)
- [ ] `apps/web/src/server/app/billing/renew.ts` + `src/__tests__/api/manager-renewals.test.ts` (06-07)
- [ ] `apps/web/src/server/app/billing/cancel.ts` + `src/__tests__/api/manager-billing-cancel.test.ts` (06-08)
- [ ] `apps/web/src/server/domain/billing/reconcile.ts` + `reconcile.test.ts` (06-10)
- [ ] `apps/web/src/__tests__/api/manager-billing-reconcile.test.ts` (06-10)
- [ ] `apps/web/src/app/[locale]/settings/community-manager/billing-panel-model.ts` + `src/__tests__/services/billing-panel-model.test.ts` (06-09)
- [ ] `apps/web/docs/MANAGER-BILLING-VERIFICATION.md` (06-11)

Two existing files must be **edited**, not created:

- [ ] `apps/web/src/server/app/authz/require-role.ts` — `billingRequirementSatisfied()` stops being
      `okAsync(true)` (06-05). Its colocated `require-role.test.ts` must be extended in the same
      plan or it asserts a behaviour that no longer exists.
- [ ] `apps/web/src/server/domain/authz/policy.test.ts` — already contains the
      `billingActive: false ⇒ 'billing_inactive'` assertion Phase 5 wrote as a forward-compat proof.
      It must stay green unchanged; if a plan needs to edit it, that plan is wrong.

All new mocked test files follow the `vi.mock`-before-import pattern in
`.planning/codebase/TESTING.md`, mocking `@/services/auth/session`, the repositories, the provider
adapter and `@/lib/logger`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|---|---|---|---|
| The off-session MIT token charge returns a usable charge id **and** document id in one response | SPIKE-01 gate | Requires live Green Invoice sandbox credentials and a real card-setup step in a browser | Plan 06-01 Task 1 |
| The saved-card token id's field name and delivery channel | SPIKE-01 gate, MGR-03 | Nothing in this repo has ever read one; `parseWebhookEvent` discards it | Plan 06-01 Task 1 |
| 3DS/SCA and soft-decline shape on an MIT charge | SPIKE-01 gate, MGR-04 | Only observable against the provider | Plan 06-01 Task 1 |
| The renewal trigger actually fires on Cloudflare | MGR-03 | The account-level cron gate (`wrangler.jsonc:58`) can only be observed from the dashboard after a deploy | Plan 06-11 |
| The migration is applied to the live database | MGR-02 | No `supabase db push` script and no local Postgres; DDL goes through the Supabase Management API with a keychain token | Plan 06-11 |
| Worker secrets are set (`GREENINVOICE_*`, `CRON_SECRET`) | MGR-03 | Values live in the provider dashboard and the secret store | Plan 06-11 |
| End-to-end sandbox lifecycle: checkout → activate → renew → fail → grace → expire | MGR-01..05 | Needs a real provider and a real clock | Plan 06-11 |
| Visual evidence: checkout, billing status, activation, suspension | issue #79 | Screenshots with sanitized records | Plan 06-11 |

---

## Validation Sign-Off

- [ ] All tasks have an `<automated>` verify command or a declared Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references listed above
- [ ] No watch-mode flags
- [ ] Feedback latency < 70s
- [ ] No task verifies against a test file created later in the same plan
- [ ] `pnpm --filter @sync/web test` green
- [ ] `pnpm --filter @sync/web typecheck` green
- [ ] `apps/web/docs/SPIKE-RESULT.md` Part A contains zero `(pending live run)` rows
- [ ] `apps/web/docs/MANAGER-BILLING-VERIFICATION.md` filled with real, secret-redacted output
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
