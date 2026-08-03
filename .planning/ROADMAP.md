# Roadmap: Taruu — P0 Payments + Go-Live

## Overview

Starting from a brownfield Next.js codebase with Paddle vote payments and a working Green Invoice merch rail, this milestone makes the money rails correct and secure and ships a live product. **Re-scoped 2026-08-03:** participation is free, vote creation costs ₪50 through the GI hosted form, and the civic pool is funded by a tradeable Bags.fm token rather than the card-on-file monthly membership originally planned. Four phases, sequenced by hard dependencies: land the coherent working-tree change first, validate the GI integration in sandbox before writing a line of production payment code, build all payment rails and security hardening together, then go live once the external gates (legal sign-off, GI Prime provisioning) have cleared. Two further phases, added from GitHub issue #79, follow go-live: the role/approval system Taruu has never had, then the ₪50/month community-manager subscription built on top of it.

## Phases

- [x] **Phase 1: Clean Foundation** - Land the uncommitted change and corrective RLS migration — clean, secure base before payment rails
- [x] **Phase 2: Spike + Gate** - Validate GI card-on-file in sandbox (hard technical gate); initiate parallel external tracks (legal sign-off, Prime plan) (completed 2026-06-30)
- [ ] **Phase 3: Payment Rails + Hardening** - ₪50 creation fee + token-funded civic pool (behind a legal gate) + security hardening — RE-SCOPED 2026-08-03
- [ ] **Phase 4: Go-Live** - Deploy with real credentials, run end-to-end money check, reconcile treasury
- [ ] **Phase 5: RBAC + Admin Review** - Working RLS transport, role model, server-side authorization helper, and the human approval console for community-manager applicants (issue #79a + RLS corrective) — no billing
- [ ] **Phase 6: Manager Billing + Subscription** - ₪50/month community-manager subscription on the GI token rail, with a full billing state machine gating role activation (issue #79c)
- [ ] **Phase 7: Service-Role Migration** - Move every user-initiated database path off unguarded service-role access onto the RLS transport built in Phase 5; audit all 25 tables' policies

## Phase Details

### Phase 1: Clean Foundation
**Goal**: The codebase is a coherent, deployable base — uncommitted Auth0/Printful/RLS change landed, the latent HIGH RLS bug corrected on treasury and phone tables, no dead artifacts remaining.
**Depends on**: Nothing (first phase)
**Requirements**: LAND-01, SEC-01
**Success Criteria** (what must be TRUE):
  1. The working-tree change (Auth0 OIDC swap + Printful service/webhook/test deletion + existing RLS fixes + dead Printful `.dev.vars.example` entries + orphaned `merch_orders` tracking/`pod_order_id` columns) lands as a single clean commit with green CI — no compilation errors, tests pass.
  2. A new corrective migration replaces `auth.uid()` with `public.user_id()` on `treasury_transactions`, `issue_coin_holdings`, and `phone_verifications` policies — authenticated users' per-user SELECT policies now return their own rows instead of nothing.
  3. The `merch_orders` RLS migration (already in tree) is in effect: anon-key reads of merch orders are denied.
  4. No dead code artifacts remain: Printful webhook and fulfillment-service files are gone, `.dev.vars.example` contains no `PRINTFUL_*` entries, and orphaned tracking/pod columns are either dropped via migration or documented as reserved.
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Land the Auth0/Printful/RLS bundle + cleanups (dead env vars, orphaned merch_orders POD columns, gitignore CLI temp) as one clean commit [LAND-01] — commit 44961e0
- [x] 01-02-PLAN.md — New corrective RLS migration: auth.uid() to public.user_id() on treasury_transactions, issue_coin_holdings, phone_verifications [SEC-01] — commit 31d6860

### Phase 2: Spike + Gate
**Goal**: The GI card-on-file integration is technically verified in sandbox (hard gate — no production payment code before this clears); the slow external dependencies (accountant/legal sign-off and GI Prime provisioning) are initiated as parallel tracks that must resolve before go-live.
**Depends on**: Phase 1

> **Note on SPIKE-02 and SPIKE-03:** These are parallel external tracks, not sequential coding blockers. Accountant/legal sign-off (SPIKE-02) and GI Prime plan provisioning (SPIKE-03) can be pursued concurrently with Phase 3 payment rails build. They gate Phase 4 (go-live) only. SPIKE-01 (sandbox verification) is the only item here that gates the start of Phase 3.

**Requirements**: SPIKE-01, SPIKE-02, SPIKE-03
**Success Criteria** (what must be TRUE):
  1. A documented sandbox result confirms that `POST /payments/tokens/{id}/charge` is a valid off-session MIT — actual 3DS/SCA and soft-decline behavior is observed and recorded, the API returns a usable document id + charge id in the same response.
  2. The integration sequence — card setup via `/payments/form`, webhook delivery, token persistence, repeat token charge — is traced end-to-end in sandbox with no undocumented surprises; any deviations from the merch flow (different webhook shape, header vs query-param secret, settlement timing) are documented.
  3. Accountant/legal sign-off is obtained (or a written timeline is in place) covering: correct GI document type per flow (חשבונית קבלה vs חשבונית מס), VAT treatment, refund/credit-note (זיכוי) mechanics, and consumer-protection obligations under Israeli law.
  4. GI Prime plan (₪0.15/receipt rate) is provisioned and confirmed in writing; real `GREENINVOICE_*` and Supabase production credentials are staged in the Cloudflare Workers secret store; written merchant clearing terms (actual clearing %, hard minimums, brand/tourist-card surcharges, settlement payout threshold) are on file.
**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md — GI card-on-file sandbox spike harness (chargeToken MIT call + guarded runner) + SPIKE-RESULT trace [SPIKE-01]
- [ ] 02-02-PLAN.md — External-track checklists: legal/accountant merchant-of-record + GI Prime/creds/clearing terms [SPIKE-02, SPIKE-03]

### Phase 02.1: Participation Persistence (INSERTED — URGENT)

**Goal**: A resident's free vote is actually recorded. The participation flow reaches the server, the ballot lands in `user_votes`, the tally and participant count move, and the receipt states only what is true — no fabricated blockchain seal.
**Depends on**: Nothing (P0 defect on live traffic; independent of the payment gate)
**Source**: `.planning/v1.0-MILESTONE-AUDIT.md` — P0 finding, outside the original requirement set
**Requirements**: VOTE-01, VOTE-02, VOTE-03, VOTE-04, VOTE-05
**Context**: Commit `cfa5d25` (2026-07-29) made participation free but never resolved the payment-shaped contract on the participate API — the UI bypassed it instead. `apps/web/src/app/[locale]/votes/[id]/flow/ParticipationFlow.tsx:149-157` seals the vote with `mockHash()` (`crypto.getRandomValues` over 32 bytes) plus a fabricated block number, sets local React state, and stops; the file contains zero `fetch()` calls. `/api/votes/[id]/participate` is fully orphaned (zero client references) and still rejects any body without `paymentTxId` (`route.ts:52`, 402 at `:136-145`) while hardcoding ₪3 semantics (3 tokens at `:190-194`, `amount: 3` at `:224`, `tokensEarned: 3` at `:253`). `recordUserVote` has exactly two call sites — `payments/webhook/route.ts:191` (requires a completed GI payment) and the unreachable participate route (`:200`) — so no free vote can ever persist. This ships on taruu.co.il today.
**Success Criteria** (what must be TRUE):
  1. A signed-in, residency-verified resident casting a free vote produces a `user_votes` row, an `incrementVoteOption` bump, and an updated `participant_count` — verified by reading the row back after a real request, not by a client-state assertion.
  2. `/api/votes/[id]/participate` accepts a free-participation body with no `paymentTxId` and never returns 402 for it; it remains gated on session and residency, and a double submission (double-click, retry, replay) records exactly one vote rather than a second row or a 500.
  3. `ParticipationFlow.tsx` calls the endpoint and advances to the receipt only after a server-confirmed write; a failed or rejected write shows a Hebrew/RTL error and no seal, and never leaves the user believing an unrecorded vote was counted.
  4. `mockHash()` is gone and no user-facing copy claims a blockchain seal (`נחתם`, `✓ חתום בבלוקצ׳יין · בלתי ניתן לשינוי`) unless an actual chain write backs it — the receipt states only verifiable facts about the recorded ballot.
  5. The ₪3 legacy is reconciled across the monorepo: the participate route no longer mints 3 tokens or emails `amount: 3` on a free vote, and `packages/shared/src/constants/index.ts` no longer leaves mobile (`apps/mobile/app/vote/[id].tsx:340`) charging ₪3 for what web gives free.
**Plans**: 5 plans in 2 waves

Plans:
- [ ] 02.1-01-PLAN.md — Free-participation contract: shared Zod schema + types + api-client, and drop the fabricated chain/GPS fields from participation history [VOTE-01, VOTE-05] (wave 1)
- [ ] 02.1-02-PLAN.md — Server persistence primitives: `recordUserVoteOnce` (UNIQUE-violation tolerant) + server-side voter eligibility mirroring the client rule [VOTE-01, VOTE-03] (wave 1)
- [ ] 02.1-03-PLAN.md — ₪3 legacy: retire `VOTE_COST`, honest mobile cost copy, pin the legacy GI rail locally, guard test [VOTE-05] (wave 1)
- [ ] 02.1-04-PLAN.md — Rewrite `/api/votes/[id]/participate` to the free contract; rewrite its 30-test suite in place [VOTE-01, VOTE-03, VOTE-05] (wave 2)
- [ ] 02.1-05-PLAN.md — Client: extract `submitParticipation`, server-confirmed write, honest receipt, remove `mockHash`/`SealCard`/chain copy from the casting funnel [VOTE-02, VOTE-04] (wave 2)

### Phase 3: Payment Rails + Hardening
**Goal**: The money model matches the product — participation is free, vote creation charges ₪50 through the working GI hosted form with a correct receipt, the civic pool is funded by a tradeable Bags.fm token behind a written legal gate, and the security gaps from CONCERNS.md are closed.
> **Re-scoped 2026-08-03.** This phase originally built a ₪6/month card-on-file membership. That model is retired: `cfa5d25` made participation free and the pool is now token-funded. PAY-01..05 are RETIRED, not deferred; COIN-01..04 are new. Re-read REQUIREMENTS.md before planning — the old success criteria below no longer apply.
**Depends on**: Phase 1 (corrective RLS migration in place). **No longer gated on SPIKE-01** — that spike verified the off-session MIT token charge, which only the retired membership needed. The ₪50 creation fee runs on the GI *hosted form*, which already works in production. SPIKE-01 now gates Phase 6 alone.
**Requirements**: SEC-02, SEC-03, SEC-04, SEC-05, PAY-06, PAY-07, PAY-08, COIN-01, COIN-02, COIN-03, COIN-04

> **Splittable.** The security block (SEC-02..05) and the ₪50 creation rail (PAY-06..08) depend on nothing external and can be planned and executed now. The token block (COIN-01..04) is behind COIN-01, a written legal sign-off nobody in this repo can produce. Plan the phase so the coin work is its own wave and the phase can ship its security and creation-fee value without it.

**Success Criteria** (what must be TRUE):
  1. Vote creation charges ₪50 through the Green Invoice hosted form (`services/payments/greenInvoice.ts:213`) — 100% platform, no civic-pool credit on creation — and a settled charge issues a GI receipt (חשבונית/קבלה) with correct Israeli private-payer fields whose document id is stored with the transaction.
  2. Paddle is gone from the vote-payment route, and the `/api/payments/create` pricing endpoint plus every user-facing surface state the real model: participation free, creation ₪50, civic pool funded by the token — no "membership", no "₪6", no per-vote civic share, no "70%".
  3. A failed or abandoned creation payment creates no vote; a webhook replay of the same settled event produces exactly one transaction row and one vote, and no gateway error string reaches the user — the failure is a Hebrew/RTL message with a retry path.
  4. The payments webhook verifies its secret via constant-time comparison of an HTTP header (never `?token=`) and fails closed in production on any secret mismatch or DB error; the payment idempotency key is server-generated and deterministic (`{userId}:{type}:{voteId|optionId}`), never `Date.now()`.
  5. `env.ts` validates the variables actually read at runtime (`SUPABASE_SERVICE_ROLE_KEY`, the `GREENINVOICE_*` set) and `validateEnv()` runs at startup and fails fast — it is currently dead code that would reject production if wired as written; the treasury transactions endpoint scopes results to the caller's `user_id` or exposes only anonymized aggregates.
  6. **Gated on COIN-01.** No token surface is live without written Israeli legal sign-off covering securities status, treasury custody, and permissible claims. Once cleared: token proceeds accrue to a per-municipality civic pool on an append-only ledger reconciling to the chain with zero open mismatches, buy/sell runs through the Bags surfaces with server-side validation where the quote shown is the quote that executes, and every public claim about return, pool size, or what the money funds is one Taruu can back — with no implied guarantee of profit or of civic outcome.
**Plans**: TBD

### Phase 4: Go-Live
**Goal**: The platform is live — residents vote free, a real ₪50 vote-creation charge lands with a correct Israeli receipt, and the end-to-end money flow reconciles with zero open mismatches.
> **Re-scoped 2026-08-03.** GO-02's participation leg is gone — there is no participation charge to test. Any token go-live is gated on COIN-01 (written legal sign-off), which is stricter than SPIKE-02.
**Depends on**: Phase 3 (payment rails complete) + SPIKE-02/03 cleared (legal sign-off obtained, GI Prime provisioned with real credentials)
**Requirements**: GO-01, GO-02
**Success Criteria** (what must be TRUE):
  1. The app deploys to Cloudflare Workers with real GI Prime credentials, all production secrets validated at startup (no `validateEnv()` failures), and the Cloudflare Worker serving live traffic without errors.
  2. A real ₪50 vote-creation charge lands in the GI dashboard, a חשבונית with correct Israeli private-payer fields is issued, and the charge id + document id are stored in the internal `transactions` table.
  3. A real resident casts a free vote on production and the `user_votes` row, tally bump, and `participant_count` are read back from live Supabase — the one Phase 02.1 check no automated test can make (see `02.1-05-SUMMARY.md`).
  4. GI settlement report and the internal `transactions` table reconcile to zero open mismatches after the end-to-end check — every settled creation charge has a matching transaction row and vice versa. *(The `treasury_ledger` leg moves to the token track and is gated on COIN-01; there is no participation charge to reconcile.)*

> **Planning note (2026-08-03):** there is no `transactions` table in any migration — the internal ledger is `payments` (`supabase/migrations/20240101000000_initial_schema.sql:148`), where the GI document id lands in `provider_id` and amounts are stored in agorot. Criterion 4 is planned against `payments`.
>
> **Hard gates encoded in `04-CONTEXT.md` (G0–G6), all verified against the repo:** Phase 3 unplanned (no `03-*` directory); `GI-LEGAL-CHECKLIST.md` 0/19 and `GI-PRIME-CHECKLIST.md` 0/24, both unsigned **and** written against the retired ₪6 membership; `wrangler.jsonc:74` runs `GREENINVOICE_ENV=production` in front of them; `validateEnv()` (`env.ts:146`) has zero callers and requires 6 variables with 0 runtime readers (owner: Phase 3 SEC-05); `CLOUDFLARE_API_TOKEN` is absent from `gh secret list` and the last 10 `deploy.yml` runs failed; UPSTASH/GI-prod/SMS Worker secrets are empty.

**Plans**: 6 plans in 4 waves

Plans:
- [ ] 04-01-PLAN.md — Re-scope the legal + GI Prime checklists to free participation / ₪50 creation, and create the G0–G6 gate ledger [GO-01] (wave 1)
- [ ] 04-02-PLAN.md — Deploy path: fail-fast CI credential guard, non-fatal notifier, names-only production secret preflight, corrected runbook [GO-01] (wave 1)
- [ ] 04-03-PLAN.md — Reconciliation: pure tested core + tsx CLI over a GI settlement export and the `payments` table + runbook [GO-02] (wave 1)
- [ ] 04-04-PLAN.md — Hard external gate: SPIKE-02 legal sign-off, SPIKE-03 Prime/creds/clearing, `GREENINVOICE_ENV` reconciled, go/no-go decision [GO-01] (wave 2, checkpoints)
- [ ] 04-05-PLAN.md — Production deploy + live smoke; record the deployment id, cron reality, and the `validateEnv()` state [GO-01] (wave 3, checkpoints)
- [ ] 04-06-PLAN.md — Real ₪50 charge + free-vote read-back from live Supabase + reconcile to zero; sign off `04-VALIDATION.md` [GO-01, GO-02] (wave 4, checkpoints)

### Phase 5: RBAC + Admin Review

**Goal**: Taruu has a real authorization system — a working RLS transport, a role model, one server-side authorization helper enforced on every privileged route, and a human review console where an admin approves, rejects, or suspends a community-manager applicant with a recorded reason. Approval is modeled as a standalone prerequisite that by itself grants nothing.
**Depends on**: Phase 4 (go-live ships first; this is post-launch work)
**Source**: GitHub issue #79 (split — this is the role/approval half, "79a"), plus the RLS corrective track chosen 2026-08-02
**Requirements**: RBAC-01, RBAC-02, RBAC-03, RBAC-04, RLS-01, RLS-02, RLS-03, RLS-04, RLS-05
**Context**: The codebase currently has **no** role concept at all — `users` (`supabase/migrations/20240101000000_initial_schema.sql:24`) has no role column, and there is not a single `is_admin` / `super_admin` / `space_admin` check anywhere in `apps/web/src`. Everything in issue #79 that reads "platform or authorized space admins review applicants" and "super admins may suspend" presumes infrastructure that does not exist yet. This phase builds it, with no money involved, so it can proceed regardless of the Green Invoice sandbox gate.

> **RLS foundation folded in (2026-08-02).** Phase 5 research found RLS is not a real enforcement layer anywhere in this app. `public.user_id()` (`20240101000001_rls_policies.sql:10-21`) reads `request.jwt.claims->>'sub'` first — the correct design — but nothing ever populates it. `withUserContext()` (`apps/web/src/lib/supabase/server.ts:67`) writes `app.user_id` while the function reads `app.current_user_id`, has zero call sites, and could not work regardless because `set_config(…, true)` is transaction-local and PostgREST is stateless HTTP. All traffic uses the service-role client, which bypasses RLS entirely.
>
> Rather than ship Phase 5's tables with deny-all policies and inherit the problem, this phase builds the transport: mint a short-lived Supabase-signed token from the verified session and pass it to an anon-key client via supabase-js's `accessToken` callback (confirmed present in the installed 2.90.1). `public.user_id()` then resolves and RLS enforces. This also converts the previously manual anon-key check into an automated test, giving the repo its first RLS test precedent. The full migration of existing tables and routes onto this foundation is **Phase 7**.

**Success Criteria** (what must be TRUE):
  1. A roles/role-grants schema exists with `super_admin`, `space_admin`, and `community_manager`, scoped per space where applicable; grants are rows with an explicit lifecycle, not a boolean column on `users`.
  2. One server-side authorization helper is the single enforcement point, and every privileged route calls it — authorization is never inferred client-side and never derived from payment state.
  3. An applicant can submit a community-manager application; an admin sees it in a review console and can approve, reject, or suspend it, and every one of those transitions records an actor, a timestamp, and a reason.
  4. An **approved** applicant with no billing has **no** manager access — approval alone changes no authorization outcome (issue #79 acceptance criteria 1 and 2, role half).
  5. Every grant, revocation, and suspension writes an append-only audit row that survives the role change itself.
  6. A user-scoped Supabase client exists that carries a short-lived Supabase-signed token minted from the verified session, so `public.user_id()` returns the real user id and RLS actually enforces; the dead `withUserContext()`/`set_claim` transport is deleted rather than left to mislead.
  7. Phase 5's three new tables carry real working policies rather than deny-all, with any role-table lookup inside a policy routed through a `SECURITY DEFINER` helper so evaluation cannot recurse.
  8. An automated test proves it: a token minted for user A cannot read user B's rows, and anon-key reads return zero rows. This replaces the manual-only check and is the harness Phase 7 extends.
**Plans**: 9 plans in 6 waves

Plans:
- [ ] 05-01-PLAN.md — RLS transport: short-lived Supabase token minter, anon-key user-scoped client, delete `withUserContext`/`set_claim` (wave 1)
- [ ] 05-02-PLAN.md — Schema: role_grants + community_manager_applications + append-only role_grant_events, SECURITY DEFINER scope helpers, real RLS policies, DB types, shared Zod contracts (wave 2)
- [ ] 05-03-PLAN.md — Authorization core: pure policy, role repository, and `requireRole` — the single enforcement point (wave 3)
- [ ] 05-04-PLAN.md — RLS test harness: cross-user and anon denial proven automatically; the repo's first RLS test, extended by Phase 7 (wave 3)
- [ ] 05-05-PLAN.md — Applicant API: POST/GET /api/manager-applications (wave 4)
- [ ] 05-06-PLAN.md — Admin review API: scoped queue, approve/reject, suspend/reinstate/revoke, audit on every transition (wave 4)
- [ ] 05-07-PLAN.md — Applicant screen /he/settings/community-manager + UX-only roles on the profile (wave 5)
- [ ] 05-08-PLAN.md — Admin review console /he/admin/manager-applications (wave 5)
- [ ] 05-09-PLAN.md — Manual gate: apply both migrations, set the Worker JWT secret, run the RLS harness live, append-only proof, super_admin bootstrap, visual evidence (wave 6, checkpoints)

### Phase 6: Manager Billing + Subscription

**Goal**: An approved community-manager applicant subscribes for ₪50/month on the Green Invoice token rail and holds scoped access only while approval **and** billing are both live — with a full billing state machine, idempotent renewals, and reconciliation.
**Depends on**: Phase 5 (role model + authorization helper), Phase 3 (shared GI token-charge rail, webhook, idempotency, treasury), Phase 2 SPIKE-01 **actually cleared**
**Source**: GitHub issue #79 (split — this is the billing half, "79c")
**Requirements**: MGR-01, MGR-02, MGR-03, MGR-04, MGR-05
**Context and open risks**:
  - **The sandbox gate is not actually closed.** `apps/web/docs/SPIKE-RESULT.md` Part A is still seven rows of `(pending live run)`, and `.planning/ROADMAP.md` plan `02-01-PLAN.md` is unchecked even though Phase 2 is marked complete. Issue #79's own Risks section says to confirm provider contracts first. Someone must run `pnpm spike:gi --charge` against the GI sandbox before any renewal code is written.
  - **Green Invoice has no subscription object.** `chargeToken()` (`apps/web/src/services/greenInvoice/index.ts:220`) is a one-shot off-session MIT charge. "Monthly ₪50" therefore means Taruu owns the scheduler, the renewal state, and the retry policy — the provider does not.
  - **The renewal scheduler needs a cron slot that Cloudflare currently refuses.** `apps/web/wrangler.jsonc:58` records that the schedules API rejected the cron list at deploy behind an account-level gate; only `0 */6 * * *` is active. Resolve the gate or pick an alternative trigger before planning the renewal job.
**Success Criteria** (what must be TRUE):
  1. A successful ₪50 charge from someone who was never approved grants **no** manager access, and an approved applicant gains scoped access only after billing activation is confirmed server-side (issue #79 acceptance criteria 1 and 2, billing half).
  2. The states `active`, `past_due`, `grace`, `cancelled`, `rejected`, `suspended`, and `expired` exist with explicit, recorded transitions; a super admin can suspend access independently of billing, with the reason stored.
  3. Duplicate or replayed renewal events produce exactly one charge, one invoice, and one role transition — idempotency keys are generated server-side, and no raw card data is ever stored.
  4. Cancellation and the failed-payment grace policy produce predictable, documented access outcomes, and the user is notified on every state change that affects their access.
  5. A reconciliation check matches GI settlement records against internal subscription and charge rows with zero open mismatches; on any ambiguous payment state the role stays inactive (the issue's stated rollback posture).
**Plans**: 11 plans in 7 waves

Plans:
- [ ] 06-01-PLAN.md — Gates: run `pnpm spike:gi --charge` and fill SPIKE-RESULT Part A + Part C, decide the renewal trigger around the Cloudflare cron gate, confirm Phase 5 is executed [MGR-03] (wave 1, checkpoints)
- [ ] 06-02-PLAN.md — Schema: billing_payment_methods + manager_subscriptions + charges + append-only events, SELECT-only RLS, DB types, shared Zod contracts, the ₪50 constant [MGR-02, MGR-03] (wave 2)
- [ ] 06-03-PLAN.md — Pure domain: the eight-state transition table, the +1/+3/+7 retry ladder, the 14-day grace, `isBillingActive`, and the transition→Hebrew-notice map [MGR-02, MGR-04] (wave 3)
- [ ] 06-04-PLAN.md — Adapters: deterministic idempotency key, claim-before-charge repository, the Green Invoice billing module, the best-effort notifier [MGR-03, MGR-04] (wave 3)
- [ ] 06-05-PLAN.md — Wire the billing prerequisite into Phase 5's `requireRole` + GET /api/manager-billing [MGR-01, MGR-02] (wave 4)
- [ ] 06-06-PLAN.md — Approval-gated checkout and the idempotent activation webhook [MGR-01, MGR-03] (wave 4)
- [ ] 06-07-PLAN.md — Renewal due-check job + the widened worker cron dispatch [MGR-03, MGR-04] (wave 5)
- [ ] 06-08-PLAN.md — End-of-period cancellation + admin suspend/reinstate on the billing lever [MGR-02, MGR-04] (wave 5)
- [ ] 06-09-PLAN.md — Hebrew/RTL billing panel on /he/settings/community-manager [MGR-01, MGR-04] (wave 6)
- [ ] 06-10-PLAN.md — Two-directional reconciliation against GI documents [MGR-05] (wave 6)
- [ ] 06-11-PLAN.md — Manual gate: apply the migration, set the secrets, walk the sandbox lifecycle, confirm the cron fires, visual evidence, sign-off [MGR-01..05] (wave 7, checkpoints)

## Progress

**Execution Order:** 1 → 2 → **02.1** → 3 → 4 → 5 → 6 → 7
(SPIKE-02/03 run as parallel external tracks during Phase 2 and Phase 3; they gate Phase 4 only)
(Phases 5 and 6 are the two halves of issue #79, deliberately sequenced **after** go-live so manager onboarding never delays the voter launch. Phase 5 carries no payment code and is unblocked by the GI sandbox gate; Phase 6 is blocked on it.)
(Phase 02.1 is an urgent insertion from the v1.0 audit — a P0 on live traffic. It depends on nothing and should run before any further phase work, including Phase 5.)

> **Post-audit status (2026-08-02):** `.planning/v1.0-MILESTONE-AUDIT.md` found 2/28 requirements satisfied. Phase 2's three requirement artifacts are unfilled templates, so its gate is **not** actually passed. Phase 3's requirements (PAY-02/03/04/08) and GO-02 are **contradicted** by shipped free participation, not merely unbuilt — they need re-scoping before Phase 3 can be planned. Statuses below reflect the roadmap as written, not the audit's findings.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Clean Foundation | 2/2 | Done (audit: partial — see AUDIT) | 2026-06-29 |
| 2. Spike + Gate | 2/2 | Complete (audit: gate NOT passed) | 2026-06-30 |
| 02.1 Participation Persistence | 5/5 | Complete    | 2026-08-02 |
| 3. Payment Rails + Hardening | 0/TBD | Re-scoped 2026-08-03 — ready to plan | - |
| 4. Go-Live | 0/6 | Planned 2026-08-03 — 6 plans / 4 waves; blocked on Phase 3 + gates G1/G2 | - |
| 5. RBAC + Admin Review | 0/9 | Planned — RLS foundation folded in (RLS-01..05); carries issue #76 | - |
| 6. Manager Billing + Subscription | 0/11 | Planned — blocked on SPIKE-01 (gate 06-01) and on Phase 5 executing | - |
| 7. Service-Role Migration | 0/16 | Planned 2026-08-03 (16 plans, 6 waves) — GATED on Phase 5 RLS-01..05 being **built**, not planned | - |
| 8. Municipality Onboarding + Authority Dashboard | 0/TBD | Not started — blocked on Phase 5 RBAC primitives (issue #76) | - |

### Phase 7: Service-Role Migration

**Goal**: Every user-initiated database path in the app runs RLS-enforced through the user-scoped client built in Phase 5, every remaining privileged access is deliberate and justified in writing, and every migrated table has a test proving cross-user reads are denied.
**Depends on**: Phase 5 (the RLS foundation, RLS-01..05 — there is nothing to migrate onto until the transport works)
**Source**: Chosen 2026-08-02 after Phase 5 research found RLS is not currently a real enforcement layer anywhere in the app
**Requirements**: MIG-01, MIG-02, MIG-03, MIG-04
**Measured scope** (counted 2026-08-02, not estimated):
  - 25 tables with RLS enabled, 39 policies, of which **15 are `USING (true)`** — each needs a deliberate keep-or-replace decision
  - 27 files reference `supabaseAdmin`, heavily concentrated: `apps/web/src/lib/supabase/db.ts` alone holds 111 references across **2404 lines and 112 exports**; the rest are ≤10 each
  - 7 API routes use it directly
**Framing**: This is explicitly **not** "delete `supabaseAdmin`". Webhooks, cron routes, NFT minting, and notification fan-out have no user session and legitimately require privileged access. The goal is that privileged access becomes a visible, justified exception rather than the default every path reaches for.
**Success Criteria** (what must be TRUE):
  1. All 25 RLS-enabled tables have policies audited against the working transport; each of the 15 `USING (true)` policies is either confirmed deliberately public with a written reason or replaced.
  2. All 112 `db.ts` exports are classified user-initiated vs system, and every user-initiated path runs through the RLS-enforced user-scoped client.
  3. Remaining privileged call sites each carry a written justification; no route uses service-role by habit.
  4. Each migrated table has a test in the RLS-04 harness proving cross-user reads are denied, and the full suite is green.

> **Scope re-counted 2026-08-03 during planning; the figures above drifted.** Verified: **25** tables (matches), **36 live distinct policies** (39 `CREATE POLICY` statements — `20260628000002` DROPs and re-CREATEs 3), **14** `USING (true)` policies (the 15th grep hit is a comment), **30** files referencing `supabaseAdmin` (19 source + 11 test, up from 27), `db.ts` at **2441 lines / 114 exports** (107 functions + 7 types) with 112 `supabaseAdmin` references, and **7** API routes (matches). MIG-02 is written against "112 exports"; the real number is 114.
>
> **Two live security findings surfaced by the audit, neither of which is a keep-or-replace judgement call:** (1) `webhook_events`'s only policy is `FOR ALL USING (true) WITH CHECK (true)` with **no `TO` clause**, so it defaults to `TO PUBLIC` — anyone holding the published anon key can read the replay guard, DELETE rows to re-enable webhook replay, or INSERT a row to make a real webhook look already-processed. Fixed in wave 1. (2) `vote_nfts` is `SELECT USING (true)` over a table carrying `user_id` and `wallet_address`, publishing the join from a Taruu user to a specific vote and a Solana wallet.

**Plans**: 16 plans in 6 waves

Plans:
- [ ] 07-01-PLAN.md — Policy audit of all 25 tables + `USING (true)` verdicts + the `webhook_events` anon read/write hotfix [MIG-01] (wave 1)
- [ ] 07-02-PLAN.md — Classify all 114 `db.ts` exports user-initiated vs system + the privileged-justification convention [MIG-02, MIG-03] (wave 1)
- [ ] 07-03-PLAN.md — `createAnonClient()` for public reads + generalize the RLS-04 harness to all 28 tables [MIG-02, MIG-04] (wave 1)
- [ ] 07-04-PLAN.md — Split `db.ts` part 1: eight domain modules, 66 exports [MIG-02] (wave 1)
- [ ] 07-05-PLAN.md — The corrective policy migration: every replace verdict + every required addition [MIG-01] (wave 2)
- [ ] 07-06-PLAN.md — Split `db.ts` part 2: seven more modules, delete `db.ts`, `db/index.ts` barrel [MIG-02] (wave 2)
- [ ] 07-07-PLAN.md — CHECKPOINT: verify the Phase 5 gate, apply both migrations, prove both findings closed live [MIG-01, MIG-04] (wave 3)
- [ ] 07-08-PLAN.md — Identity slice: users, social_proofs, identity_documents, identity_document_events [MIG-02, MIG-03, MIG-04] (wave 4)
- [ ] 07-09-PLAN.md — Residency slice: verification_runs/schedule/attempts, phone_verifications [MIG-02, MIG-03, MIG-04] (wave 4)
- [ ] 07-10-PLAN.md — Ballot slice: user_votes + user statistics — the secret-ballot proof [MIG-02, MIG-03, MIG-04] (wave 4)
- [ ] 07-11-PLAN.md — Public catalogue slice: votes, vote_sources, knesset_*, municipalities [MIG-01, MIG-02, MIG-04] (wave 4)
- [ ] 07-12-PLAN.md — Payments slice: payments, entitlements [MIG-02, MIG-03, MIG-04] (wave 4)
- [ ] 07-13-PLAN.md — Money-visibility slice: treasury, treasury_transactions, issue_coins, issue_coin_holdings [MIG-02, MIG-03, MIG-04] (wave 4)
- [ ] 07-14-PLAN.md — System-privileged slice: vote_nfts, push_tokens, webhook_events, merch_orders + the permanent findings guard [MIG-02, MIG-03, MIG-04] (wave 4)
- [ ] 07-15-PLAN.md — Migrate Phase 5's `role.repo.ts` + the privileged-access guard test that fails CI on an unjustified `supabaseAdmin` [MIG-02, MIG-03, MIG-04] (wave 5)
- [ ] 07-16-PLAN.md — CHECKPOINT: coverage ledger asserted, full RLS suite live with a non-zero count, phase record [MIG-01..04] (wave 6)

### Phase 8: Municipality Onboarding + Authority Dashboard

**Goal**: A verified municipal authority can onboard, claim its profile behind a human evidence review, invite representatives scoped to that municipality alone, read the aggregate civic activity for its own city, publish versioned official responses residents can tell apart from Taruu's own content, and track commitments and satisfaction across staff turnover.
**Depends on**: Phase 5 (RBAC-01..04 — the role-grant schema, the single server-side authorization helper, the admin review console, and the append-only audit table are this phase's foundation, not a parallel build). Phase 7 is **not** a hard dependency, but shipping authority access on top of service-role-by-default would put an unenforced RLS boundary between two organizations' data — sequence after 7 unless that risk is accepted in writing.
**Source**: GitHub issue #76 (`Taruu-ShowYourselves/taruu-monorepo`), triaged 2026-08-02
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06
**Context**: Nothing for this exists today. There is no `/authority` or `/municipality-admin` route in `apps/web/src/app/[locale]/`, no authority API namespace, and no organization, representative, official-response, commitment, or satisfaction table in any of the migrations. The only adjacent surface is the public `municipality/[slug]` page and `/api/municipalities`, which the issue explicitly requires stay public and independent of whether an authority ever joins. The issue's guardrails map one-to-one onto Phase 5 primitives: "super-admin approval before a verified badge" is RBAC-03's review console, "representatives see only their municipality" is RBAC-02's authorization helper, and "histories remain auditable after staff changes" is RBAC-04's append-only audit rows.
**Success Criteria** (what must be TRUE):
  1. An organization that has not passed evidence review cannot appear anywhere as the official municipality — no badge, no official-response authorship, no dashboard access. Verification is a super-admin decision with recorded evidence, actor, timestamp, and reason; it is never automatic.
  2. A representative authenticated against municipality A can read no data belonging to municipality B, and can read only aggregate or explicitly-public resident data for their own — enforced server-side through the Phase 5 authorization helper, never inferred client-side. Aggregates below the minimum cohort size are withheld rather than rounded.
  3. A resident reading a vote can tell Taruu-generated content from an official authority response at a glance, and official responses are append-only and versioned — every revision retains its author, timestamp, and prior text rather than overwriting it.
  4. Commitment and satisfaction histories survive representative offboarding: revoking a representative's access removes their ability to act but destroys none of the record they created, and the audit trail outlives the role grant.
  5. Response deadlines and escalations exist as workflow states with recorded transitions — they carry no legal claim, and no copy implies one.
  6. Suspending a verified authority or a representative removes access without deleting history, and the municipality's public council page continues to render exactly as it did before the authority joined.
**Out of scope** (from the issue): government-level dashboard, legal filing, resident identity access, automatic authority verification.
**Plans**: 13 plans in 6 waves

Plans:
- [ ] 08-01-PLAN.md — Access schema: authority_organizations / claims / rep invitations, the three Phase 5 CHECK extensions, `is_authority_member()`, RLS, shared contracts (wave 1)
- [ ] 08-02-PLAN.md — Cohort-privacy primitive (MIN_COHORT_SIZE=10, withheld-not-rounded) + the public-council-page regression guard, landed before any authority code (wave 1)
- [ ] 08-03-PLAN.md — Authority repo, `mappers`, rate limiters, and `requireAuthority`/`resolveAuthorityScope` composed from Phase 5's `requireRole`; `ADMIN_TIER_ROLES` widened (wave 2)
- [ ] 08-04-PLAN.md — Content schema: append-only `official_responses`, `authority_commitments`, `authority_satisfaction_snapshots` on Phase 5's `reject_audit_mutation()`, + insert-only repo (wave 2)
- [ ] 08-05-PLAN.md — Claim submission + super-admin evidence review; approval is the only path to a verified organization and an `authority_admin` grant (wave 3)
- [ ] 08-06-PLAN.md — Representative lifecycle: single-use invitation token, accept, suspend/reinstate/offboard on Phase 5's guarded `setGrantStatus` (wave 3)
- [ ] 08-07-PLAN.md — Dashboard aggregates with the cohort floor, vote/result inbox, identity-free CSV export, daily satisfaction snapshots (wave 3)
- [ ] 08-08-PLAN.md — Versioned official responses and tracking targets — every revision a new row, never an update (wave 3)
- [ ] 08-09-PLAN.md — `/[locale]/authority/onboarding` claim form + `/[locale]/admin/authority-claims` evidence-review console (wave 4)
- [ ] 08-10-PLAN.md — `/[locale]/municipality-admin` shell, dashboard home with the withheld-aggregate rendering, representative roster (wave 4)
- [ ] 08-11-PLAN.md — Vote inbox + response composer, target tracker, and the Hebrew copy guard against legal-claim language (wave 5)
- [ ] 08-12-PLAN.md — Public official-response surface on the vote page: distinguishable from Taruu content, public revision history (wave 4)
- [ ] 08-13-PLAN.md — Land on a real database: apply both migrations, the scope guard, the RLS harness extension, live append-only probes, visual evidence (wave 6, checkpoint)

**Wave structure**: W1 = 08-01, 08-02 · W2 = 08-03, 08-04 · W3 = 08-05, 08-06, 08-07, 08-08 · W4 = 08-09, 08-10, 08-12 · W5 = 08-11 · W6 = 08-13 (blocking checkpoint)
