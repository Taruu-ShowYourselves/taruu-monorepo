# Phase 6: Manager Billing + Subscription - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning
**Source:** GitHub issue #79 — "Paid community-manager onboarding and monthly billing" (the billing half, "79c")

<domain>
## Phase Boundary

Issue #79 was split. Phase 5 built the role half ("79a"): a role-grant schema, one server-side
authorization helper (`requireRole`), a human review console, and an append-only audit table.
Phase 6 builds the billing half.

**This phase delivers:**

- A ₪50/month community-manager subscription on the Green Invoice saved-card (token) rail.
- A subscription state machine with the seven states issue #79 names, plus explicit recorded transitions.
- Idempotent renewal handling: one charge, one document, one role transition per period, however
  many times a provider event is delivered.
- A cancellation path and a failed-payment grace policy with documented access outcomes.
- Notification on every state change that affects access.
- A reconciliation check between Green Invoice settlement records and the internal charge rows.

**The load-bearing property of this phase:** approval and billing are two *independent*
prerequisites. A ₪50 charge from someone who was never approved grants nothing. An approved
applicant with no billing gets nothing. Authorization is never derived from payment state — it
runs through Phase 5's single helper, which composes requirements. Phase 6's contribution to
authorization is **exactly one line**: replacing `billingRequirementSatisfied()`'s hardcoded
`okAsync(true)` in `apps/web/src/server/app/authz/require-role.ts` with a real subscription
lookup. No call site changes. That is what Phase 5 was shaped for.

**Explicitly NOT in this phase:**

- Any change to the `/api/payments/*` vote rail, the `payments` table, or the `payment_type` enum.
- Vote-submission fees, salary or payment *to* managers, automatic approval (all out of scope per issue #79).
- Any manager-gated *resource*. Phase 5 shipped no route that calls
  `requireRole(userId, 'community_manager', space)`, and Phase 6 does not add one. The billing
  gate is proven at the enforcement point by test, not by a feature that consumes it. The first
  manager tool is a later phase. Say this out loud rather than pretending otherwise.
- The ₪6/month VOTER membership. **It is retired and unrelated.** PAY-01..05 were retired
  2026-08-03 when participation became free (`cfa5d25`). Do not resurrect ₪6, `VOTE_COST`, or
  "membership" copy anywhere. This phase's ₪50/month is a *community-manager* subscription and is
  live scope.

</domain>

<gates>
## Hard Gates — verified against the repo 2026-08-03

Each of these is a real blocker, not a caution. Each has a plan that closes it.

### Gate 1 — SPIKE-01 is contested and is unclosed (plan 06-01)

`apps/web/docs/SPIKE-RESULT.md` Part A is still seven `(pending live run)` rows. Nobody appears to
have run `pnpm spike:gi --charge` against the Green Invoice sandbox. `.planning/ROADMAP.md` marks
Phase 2 complete and plan `02-01-PLAN.md` unchecked, and REQUIREMENTS.md marks SPIKE-01 `[x]` — the
document those marks refer to is an unfilled template.

Phase 3 was re-scoped onto the GI **hosted form**, which already works in production, and
explicitly dropped its SPIKE-01 dependency (ROADMAP Phase 3 "Depends on"). **Phase 6 is now the
only remaining phase that genuinely needs the off-session MIT token charge verified.** Clearing
SPIKE-01 is therefore the first gate of this phase and blocks every other plan in it.

Three things the live run must produce that no amount of code reading can:

1. Does `POST /payments/tokens/{id}/charge` return a usable `chargeId` **and** `documentId` in the
   same synchronous response? (Criterion #1. `chargeToken()` at
   `apps/web/src/services/greenInvoice/index.ts:220` already reads both defensively, but the field
   names are guesses.)
2. **What is the saved-card token id called, and how does it arrive?** `gi-spike.ts` STEP 2 tells
   the operator to "capture the webhook payload" and set `GI_SPIKE_TOKEN_ID` by hand — the field
   name is unknown. `parseWebhookEvent()`
   (`apps/web/src/services/payments/greenInvoice.ts:328`) throws away everything except `custom`
   and the document id, so nothing in this repo has ever read a token id. Also unknown: whether
   `/payments/form` saves a card at all without an extra request field.
3. 3DS/SCA and soft-decline behaviour on the MIT charge — HTTP status, error shape, whether a
   retriable flag exists. The whole retry/grace policy is designed around this answer.

**Do not write renewal code before Part A is filled.**

### Gate 2 — Green Invoice has no subscription object (design constraint, not a blocker)

`chargeToken()` (`apps/web/src/services/greenInvoice/index.ts:220`) is a one-shot off-session MIT
charge. There is no `/subscriptions` resource, no provider-side schedule, no provider-side dunning,
no provider-side proration. "₪50/month" therefore means **Taruu owns the scheduler, the renewal
state machine, the retry policy, and the reconciliation.** Every plan in this phase is written on
that assumption. Nothing may be deferred to "the provider handles it".

Corollary: the provider is not the source of truth for *whether a subscription is active*. The
internal `manager_subscriptions` row is. Green Invoice is the source of truth for *whether a
particular charge settled*, which is what reconciliation compares against.

### Gate 3 — Cloudflare cron is account-gated (plan 06-01, implemented in 06-07)

`apps/web/wrangler.jsonc:58` records that the schedules API rejected the four-cron list at deploy
behind an account-level gate. The commented-out block is still there; only `"0 */6 * * *"` is live,
and `worker.ts`'s `CRON_ROUTES` maps that single expression to `/api/cron/knesset-agenda`. A
monthly renewal job cannot assume a new slot.

The decision is plan 06-01 Task 2. The recommended resolution needs **no** gate: make the renewal
route a *due-check* (`WHERE next_charge_at <= now()`), which is safe to invoke at any frequency,
and fan the existing 6-hourly trigger out to more than one route by widening `CRON_ROUTES` to
`Record<string, string[]>`. Four harmless invocations a day also give four retry windows a day.
The alternatives (resolve the account gate in the dashboard; drive it from an external scheduler)
stay on the table and are recorded, not assumed.

### Gate 4 — Phase 5 must be executed, not merely planned

Phase 6 compiles against `role_grants`, `role.repo.ts`, `require-role.ts`, and
`@sync/shared/contracts/role`. As of 2026-08-03: plans 05-01 and 05-02 are committed
(`96448b3`, `3dedcf0` on `feat/rls-transport`), 05-03's files are on disk uncommitted, and
05-04..05-09 are unbuilt. Neither Phase 5 migration has been applied to any database,
`SUPABASE_JWT_SECRET` is unset, and no `super_admin` grant exists anywhere.

Phase 6 may be **planned** now. It may not be **executed** before plan 05-09 signs off. Plan 06-01
Task 3 makes that an explicit checked precondition rather than a footnote.

</gates>

<decisions>
## Implementation Decisions

Locked. Derived from issue #79's Requirements and Acceptance criteria, REQUIREMENTS.md MGR-01..05,
the ROADMAP Phase 6 success criteria, and facts verified against the repo.

### Authorization (MGR-01)

- **Authorization is never derived from payment state.** The only enforcement point stays
  `requireRole` in `apps/web/src/server/app/authz/require-role.ts`. Phase 6 replaces the body of
  `billingRequirementSatisfied()` and changes nothing else about the module's shape.
- **The billing requirement applies to `community_manager` only.** `super_admin` and `space_admin`
  are never billed and must return `true` unconditionally. Getting this wrong locks every human out
  of the Phase 5 admin console, including the bootstrapped super admin — this is the single most
  dangerous mistake available in this phase.
- **Approval alone is still not access, and billing alone is still not access.** A subscription row
  can only be created for a user who already holds an `active` `community_manager` grant in that
  space, sourced from an approved application. There is no code path from "charge succeeded" to
  "grant created".
- **Ambiguous payment state ⇒ inactive role.** Issue #79's stated rollback posture. Any state the
  state machine cannot resolve to `active` or `grace` denies.

### Subscription state machine (MGR-02)

- Eight states: `pending`, `active`, `past_due`, `grace`, `cancelled`, `rejected`, `suspended`,
  `expired`. Issue #79 names seven; `pending` is the pre-activation state between "checkout started"
  and "first charge settled", and without it the first charge has nothing to transition *from*.
- `TEXT` + `CHECK`, never a native `CREATE TYPE ... AS ENUM`. This mirrors the decision Phase 5 made
  for `role_grants.status` and exists because `ALTER TYPE ... ADD VALUE` is transaction-hostile.
  **The repo already contains the counterexample:** `payment_type` (`20240101000000_initial_schema.sql:15`)
  is a native enum with only `vote_participation` and `vote_creation`, which is one of the reasons
  subscription charges get their own table rather than riding the `payments` table.
- Transitions are a **table**, not scattered `if`s: a pure `transitionSubscription(from, event)` in
  `server/domain/billing/subscription.ts` returning allow/deny. Any transition not in the table is
  denied, and a denied transition is a `CONFLICT`, never a silent no-op.
- Every transition writes an append-only `manager_subscription_events` row with actor, from, to,
  reason and timestamp — reusing `public.reject_audit_mutation()`, the trigger function Phase 5's
  `20260802000002` migration already created.
- **A super admin can suspend independently of billing, with a stored reason.** Suspension is
  reachable from `active`, `past_due` and `grace`, and it is not a billing event. It suspends the
  *role grant* through Phase 5's existing `actOnGrant`, and separately records a subscription-side
  `suspended` state so billing does not silently keep renewing an access the platform revoked.

### Money handling (MGR-03)

- **No raw card data, ever.** The only card artefact stored is Green Invoice's own saved-card token
  id, in `billing_payment_methods.provider_token_id`, plus non-identifying display fields
  (brand, last four, expiry) if and only if the provider returns them. No PAN, no CVV, no
  expiry-plus-PAN combination, no provider payload dumped into a JSONB column.
- **Idempotency keys are server-generated and deterministic**, never `Date.now()`, never a client
  value. Format: `mgrsub:{subscriptionId}:{periodStart as YYYY-MM-DD}:{attempt}`. This is the same
  discipline SEC-04 demands of the vote rail (`{userId}:{type}:{voteId|optionId}`).
- **Claim before charge.** The charge row is inserted first, with the idempotency key under a
  `UNIQUE` constraint. Only the insert that wins calls Green Invoice. A duplicate or replayed event
  loses the insert (SQLSTATE `23505`) and returns the existing row — exactly one charge, one
  document, one transition. This is the pattern the existing payments webhook already uses at
  `apps/web/src/app/api/payments/webhook/route.ts:169` (`markPaymentCompleted` as an atomic claim);
  it is not a new invention here.
- **Provider events dedupe on `webhook_events`.** That table
  (`20250115000002_webhook_events.sql`) already has `event_id UNIQUE` and a provider column. Reuse
  it; do not create a second replay table.
- **Webhook secret via constant-time compare, fail closed in production.** Use
  `secureEqual` (`apps/web/src/lib/secureCompare.ts`). Accept the `x-greeninvoice-token` header
  first; the `?token=` query param is tolerated only because GI's hosted form takes a URL and
  cannot attach a header, and that tolerance must be documented in the file that does it. Never
  fail open in production.

### Grace, retry and cancellation (MGR-04)

- Failed charge ⇒ `past_due`, access **retained**, retry scheduled. This is a dunning window, not a
  punishment: the first failure is usually an expired card.
- Retry schedule: three attempts at +1 day, +3 days, +7 days from the first failure. After the third
  failure ⇒ `grace`, access **retained**, `grace_until = failure + 14 days`.
- `grace_until` passes with no successful charge ⇒ `expired`, access **lost**. `expired` is terminal
  for that subscription row; re-subscribing creates a new row against the same grant.
- Cancellation is **end-of-period**: `cancel_at_period_end = true`, state stays `active`, access
  runs to `current_period_end`, then ⇒ `cancelled`, access lost. No proration, no partial refund —
  and the Hebrew copy must say so plainly.
- A first charge that is declined ⇒ `rejected`. The subscription never activated; the grant is
  untouched and still authorizes nothing (it never did).
- **The user is notified on every state change that affects access**, in Hebrew, RTL: activation,
  past_due, grace, expired, cancelled, suspended, reinstated. Notification is best-effort and never
  blocks or reverses a state transition — a Resend outage must not leave money and state disagreeing.

### Reconciliation (MGR-05)

- A reconciliation routine compares the internal `manager_subscription_charges` rows against Green
  Invoice's records for the same window, in both directions: a settled GI charge with no internal
  row, and an internal `succeeded` row with no GI document. Output is a report with an explicit
  open-mismatch count; zero is the pass condition.
- Reconciliation **reports**; it does not silently repair. Any mismatch leaves the role inactive if
  it is currently ambiguous, and is escalated to a human.

### Naming and placement

- Migration: `supabase/migrations/20260803000001_manager_billing.sql`.
- Domain (pure): `apps/web/src/server/domain/billing/`.
- Use-cases: `apps/web/src/server/app/billing/`.
- Repository: `apps/web/src/server/infra/supabase/subscription.repo.ts`.
- Provider adapter: `apps/web/src/services/billing/greenInvoice.ts` — a **new** module composing
  `getToken`/`chargeToken` from `@/services/greenInvoice`. Do not edit
  `apps/web/src/services/payments/greenInvoice.ts`; that file is the vote rail and Phase 3 owns it.
- Contracts: `packages/shared/src/contracts/managerBilling.ts`, re-exported from the barrel.
- API namespace: `/api/manager-billing/*` for the subscriber, `/api/admin/manager-subscriptions/*`
  for admins, `/api/cron/manager-renewals` and `/api/cron/manager-billing-reconcile` for the jobs.
- UI: the Hebrew/RTL billing panel extends Phase 5's `/he/settings/community-manager` screen rather
  than adding a second page.

### Claude's Discretion

- Exact Hebrew wording of notification emails and UI copy, within the locked constraint that no copy
  may say "מנוי חבר"/"membership"/"₪6" or imply the retired voter membership.
- Whether the reconciliation job runs as a cron route or as a `pnpm` script (both are acceptable;
  a cron route reuses the existing `secureEqual` guard and is preferred).
- Column-level naming inside the three new tables, as long as it matches the Zod contracts.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase definition
- `.planning/ROADMAP.md` — Phase 6 section: goal, "Context and open risks", the five success criteria
- `.planning/REQUIREMENTS.md` — MGR-01 through MGR-05
- `.planning/STATE.md` — Blockers/Concerns: the SPIKE-01 contest, the GI-has-no-subscription
  finding, and the Cloudflare cron gate are all recorded there

### Phase 5 — the foundation this phase extends (read all of it)
- `.planning/phases/05-rbac-admin-review/05-CONTEXT.md` — the split, and why approval grants nothing
- `.planning/phases/05-rbac-admin-review/05-02-SUMMARY.md` — the **as-built** schema: `role_grants`,
  `community_manager_applications`, `role_grant_events`, `public.reject_audit_mutation()`, the two
  `SECURITY DEFINER` scope helpers, the six policy names
- `.planning/phases/05-rbac-admin-review/05-03-PLAN.md` — `requireRole` / `role.repo.ts` / `mappers.ts`
- `apps/web/src/server/app/authz/require-role.ts` — the one line Phase 6 changes
- `apps/web/src/server/domain/authz/policy.ts` — `AUTHZ_REQUIREMENTS`, `billingActive`, `DenyReason`
- `apps/web/src/server/infra/supabase/role.repo.ts` — the `ResultAsync` repo idiom
- `supabase/migrations/20260802000002_role_grants_and_applications.sql` — the RLS/TEXT+CHECK/append-only conventions to copy

### Green Invoice
- `apps/web/docs/SPIKE-RESULT.md` — Part A is the gate; Part B is the code-derived trace
- `apps/web/src/services/greenInvoice/index.ts` — `getToken()`, `createPaymentForm()`, `chargeToken()`
- `apps/web/src/services/payments/greenInvoice.ts` — the vote rail: `verifyWebhook`,
  `parseWebhookEvent`, the `?token=` transport and why it exists. **Read, do not edit.**
- `apps/web/scripts/gi-spike.ts` — the harness plan 06-01 runs
- `apps/web/src/app/api/payments/webhook/route.ts` — the replay/claim pattern to copy

### Scheduling and infrastructure
- `apps/web/wrangler.jsonc` — the cron gate note at line 58 and the single live trigger
- `apps/web/worker.ts` — `CRON_ROUTES`, the one-cron-to-one-route map that plan 06-07 widens
- `apps/web/src/app/api/cron/resolve-votes/route.ts` — the `CRON_SECRET` + `secureEqual` guard shape
- `apps/web/src/lib/secureCompare.ts`

### Project conventions
- `CLAUDE.md` — design tokens, Hebrew/RTL only, naming, import order, no hardcoded values
- `.planning/codebase/TESTING.md` — the `vi.mock`-before-import pattern and file layout
- `.planning/codebase/CONVENTIONS.md`, `ARCHITECTURE.md`, `CONCERNS.md`
- `apps/web/src/server/http/errors.ts` + `respond.ts` — the `AppError` taxonomy and the shell edge
- `apps/web/vitest.config.ts` — `environment: 'node'`, `include: ['src/**/*.test.ts', 'src/**/*.spec.ts']`

</canonical_refs>

<specifics>
## Specific Ideas

Carried from issue #79 in intent:

- "A successful ₪50 monthly payment without approval does not grant manager access." Acceptance
  criterion 1. Testable today: the checkout use-case refuses to create a subscription for a user
  with no active `community_manager` grant, and there is no code path from a charge to a grant.
- "An approved applicant receives scoped access only after confirmed billing activation."
  Acceptance criterion 2. Testable at the enforcement point: `requireRole` with an active grant and
  a `pending`/`rejected`/`expired` subscription must deny with `billing_inactive` — the exact
  assertion Phase 5's `policy.test.ts` already makes against a stub.
- "Duplicate renewal events do not duplicate invoices, charges, or role transitions." Acceptance
  criterion 3. Testable: drive the renewal use-case twice for the same period and assert
  `chargeToken` was called once.
- "Confirm provider contracts first; fall back to manual invoice/reconciliation and keep roles
  inactive on ambiguous payment state." The Risks section — this is why plan 06-01 is a gate and
  why every unresolved state denies.
- Visual evidence (issue #79): screenshots of application, admin review, checkout, billing status,
  and manager activation/suspension with sanitized test records.

</specifics>

<deferred>
## Deferred Ideas

- **Refunds and credit notes (זיכוי) for subscription charges.** `createRefund` exists on the vote
  rail (`services/payments/greenInvoice.ts:268`) but subscription refund policy is a legal/accounting
  question, not a code one. v2 `BAG-04`/`HARD-02` territory.
- **Proration, plan changes, annual billing, coupons.** Not in issue #79.
- **Dunning by SMS or push.** Email only in this phase; the notification settings table
  (`20260615000002_user_notification_settings.sql`) exists and can carry this later.
- **Manager-gated features.** The first route that actually calls
  `requireRole(userId, 'community_manager', space)` is a later phase. See the Phase Boundary.
- **Moving the vote rail onto tokens.** Phase 3 deliberately runs vote creation on the hosted form.
  Phase 6 must not touch it.
- **Migrating these tables off the service-role client.** Phase 7 (MIG-01..04). The new tables get
  real `SELECT` policies for defence in depth, exactly as Phase 5's did, but the app writes with
  `supabaseAdmin`.

</deferred>

---

*Phase: 06-manager-billing-subscription*
*Context gathered: 2026-08-03 from GitHub issue #79 (billing half), ROADMAP Phase 6, REQUIREMENTS MGR-01..05, and Phase 5's as-built artefacts*
