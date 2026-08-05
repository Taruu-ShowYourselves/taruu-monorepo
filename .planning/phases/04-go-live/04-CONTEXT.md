# Phase 4: Go-Live — Context

**Gathered:** 2026-08-03
**Status:** Ready for planning
**Source:** `.planning/ROADMAP.md` Phase 4 (success criteria rewritten 2026-08-03, commit `c5e7ff3`), `.planning/REQUIREMENTS.md` GO-01/GO-02, `.planning/STATE.md` Blockers, and a direct repo audit performed during planning (every file:line below was read, not inferred)

<domain>
## Phase Boundary

**Delivers:** Taruu is live, deliberately. The external gates that have been sitting unfilled are actually closed and recorded; the deploy path is a decided path rather than an accident; production runs with real credentials and a startup env check that passes; one real ₪50 vote-creation charge lands with a correct Israeli receipt; one real free vote is read back out of live Supabase; and the GI settlement record reconciles against the internal ledger to zero open mismatches.

**Shape of the phase:** this is mostly a **checklist and manual-gate phase**, not a coding phase. Four of six plans are verification procedures a human executes against production with recorded evidence. The only real code is: a deploy-pipeline fix, a production-secret preflight that reads names and never values, and a reconciliation engine with a pure tested core and a thin CLI. Everything else is gates, evidence, and honesty.

**Does NOT deliver:**
- **Any token / Bags.fm surface.** COIN-01 (written Israeli legal sign-off on securities status, treasury custody, and permissible claims) is a hard gate that nothing in this repo can clear. The `treasury_ledger` reconciliation leg moved to the token track and is gated on COIN-01 — it is **not** in this phase.
- **Any participation charge.** Participation is free (`cfa5d25`, 2026-07-29). There is no ₪6 membership, no ₪2.10 pool accrual, and no per-vote civic share to test or reconcile. PAY-01..05 are RETIRED, not deferred.
- **The `env.ts` / `validateEnv()` repair.** That is Phase 3 SEC-05. Phase 4 *depends* on it and *verifies* it in production; it must not re-plan it.
- **The ₪50 creation rail itself.** That is Phase 3 PAY-06/07/08. Phase 4 exercises it live.
- **Mobile.** Web-first; mobile is out of scope for go-live.
</domain>

<gates>
## Hard Gates — nothing in this phase runs until these are true

These are not warnings. Each is a blocking precondition with a named artifact that must exist and be filled.

### G0 — Phase 3 is complete
`.planning/phases/` contains no `03-*` directory: **Phase 3 is not even planned yet**, let alone executed. Phase 4 is downstream of all of:
- **SEC-05** — `env.ts` validates the variables actually read at runtime and `validateEnv()` runs at startup. Criterion 1 of this phase ("all production secrets validated at startup, no `validateEnv()` failures") is *unachievable* until SEC-05 lands. See G3 below for exactly why the current code would reject production.
- **PAY-06/07** — the ₪50 creation charge issues a GI receipt and stores the document id with the transaction. Criterion 2 depends on that storage existing.
- **PAY-08** — Paddle gone, copy honest. A go-live that ships stale "₪6 / membership / 70%" copy fails criterion 2's spirit.
- **SEC-02/03/04** — treasury scoping, header-based constant-time webhook secret, deterministic server-side idempotency key.

### G1 — SPIKE-02 (legal/accountant sign-off) actually cleared
`.planning/REQUIREMENTS.md` marks SPIKE-02 `[x]` Complete. **It is not.** `apps/web/docs/GI-LEGAL-CHECKLIST.md` is a template: **0 of 19** `- [ ]` boxes ticked, `**Accountant / lawyer name:** ___________________________`, `**Date:** ___________________________`.

Worse, the checklist describes **the wrong product**. Its Context section and every question in it are written against the retired ₪6-membership model: "the **first vote of a calendar month costs ₪6**", "**₪2.10 routes to a monthly civic pool**", "the ₪6 monthly membership charge … recurring digital subscription", "card-on-file … off-session (MIT)". Handing that document to an accountant today buys sign-off on a product Taruu does not sell. It must be re-scoped to the current model — free participation, ₪50 creation via the GI **hosted form**, civic pool funded by a token that is itself behind COIN-01 — **before** it is sent out.

### G2 — SPIKE-03 (GI Prime + real credentials + clearing terms) actually cleared
Also marked `[x]` Complete. Also not. `apps/web/docs/GI-PRIME-CHECKLIST.md`: **0 of 24** boxes ticked, `**GI account rep name:** ___________________________`. Every blank line (`Record: ____%`, `₪____`, `Decision on file: ___`) is still blank. It carries the same stale ₪6/₪2.10 framing and the same "both the ₪6 membership charge receipt and the ₪50 vote-creation receipt" premise.

### G3 — Production is running in front of an unverified gate, right now
`apps/web/wrangler.jsonc:74` sets `"GREENINVOICE_ENV": "production"` while G1 is 0/19 and G2 is 0/24. `apps/web/src/services/greenInvoice/index.ts:36-39` reads that value and points the live base URL at the production GI API. taruu.co.il is serving real traffic against a payment rail whose legal and commercial terms are unsigned. This phase must resolve it in one of exactly two ways, recorded in writing:
- flip `GREENINVOICE_ENV` back to `sandbox` until G1 and G2 close, or
- record a dated, explicit owner acceptance that production GI runs ahead of sign-off, with the residual risk named.

Doing neither is not an option this phase permits.

### G4 — `validateEnv()` would reject production as currently written
`apps/web/src/lib/env.ts` — `validateEnv()` is at **line 146** (STATE.md's `:135` points at a line inside `getClientEnv()`'s error message; corrected here). It has **zero callers** anywhere in `apps/web/src`. If it were wired up today it would fail closed, because its schemas demand six variables with **zero runtime readers** — verified by grep across `apps/web/src`, excluding `env.ts` itself:

| Variable | Required by | `process.env.*` readers outside `env.ts` |
|---|---|---|
| `AUTH0_CLIENT_ID` | server schema `:31` | **0** |
| `AUTH0_CLIENT_SECRET` | server schema `:32` | **0** |
| `NEXT_PUBLIC_AUTH0_DOMAIN` | server `:33` + client `:66` | **0** |
| `NEXT_PUBLIC_AUTH0_CLIENT_ID` | server `:34` + client `:67` | **0** |
| `SUPABASE_URL` | server schema `:13` | **0** |
| `SUPABASE_SERVICE_KEY` | server schema `:14` | **0** |
| `SUPABASE_SERVICE_ROLE_KEY` | **not in server schema** | 5 |
| `NEXT_PUBLIC_SUPABASE_URL` | client schema only `:63` | 7 |

Phase 3 SEC-05 fixes this. **Phase 4 states the dependency and verifies the outcome in production; it does not re-plan the fix.**

### G5 — The CI deploy pipeline is broken and the live site is manual-deploy only
`.github/workflows/deploy.yml:62` passes `CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}`. `gh secret list` returns seven repository secrets and **`CLOUDFLARE_API_TOKEN` is not among them** (`CLOUDFLARE_ACCOUNT_ID` is). Every one of the last 10 `deploy.yml` runs failed. The last run's log is unambiguous:

```
CLOUDFLARE_API_TOKEN:
✘ [ERROR] In a non-interactive environment, it's necessary to set a
  CLOUDFLARE_API_TOKEN environment variable for wrangler to work.
ERROR Wrangler deploy command failed
```

The build step succeeds; only the deploy step fails, and it fails **after** a ~2-minute build. A second, independent defect follows it: the `Notify the linked PR and issue` step exits 1 on `gh: Resource not accessible by integration (HTTP 403)` when commenting on an issue — so even a successful deploy would be reported red.

Go-live must not depend on a pipeline in this state. This phase either fixes it or records deliberately that deploys stay manual — and either way makes the workflow fail *fast and legibly* instead of burning a build first.

### G6 — Production secrets are still empty
Per project memory (`taruu-deploy`, 2026-07-28): the site went live by manual `wrangler deploy` with 24 Worker secrets set, but **UPSTASH, GI-production, and SMS secrets are still empty**. Their names are enumerated in the plans. **No plan in this phase may print, read, echo, cat, log, or copy a secret VALUE.** `wrangler secret list` returns names only and is the sanctioned check.
</gates>

<decisions>
## Implementation Decisions

### Locked — the money model under test

- **Participation is free.** No ₪6 charge, no ₪2.10 pool accrual, no ₪2.10 reconciliation leg, no "membership". Any plan, task, or checklist question that presumes one is wrong.
- **One paid flow only: ₪50 vote creation, through the GI hosted form** (`apps/web/src/services/payments/greenInvoice.ts:213`, amounts at `:345-351`). 100% platform, no civic-pool credit on creation.
- **No token surface goes live.** COIN-01 is unmet and unmeetable from inside this repo. `treasury_transactions` reconciliation is explicitly **not** part of this phase's zero-mismatch criterion.

### Locked — the one manual check inherited from Phase 02.1

Success criterion 3 is the check `02.1-05-SUMMARY.md` ("Next Phase Readiness") named as non-automatable: cast a real free vote on production **as a verified resident**, then read back from live Supabase:
- the `user_votes` row for that `(user_id, vote_id)`,
- the chosen `vote_options` tally incremented by exactly 1,
- `votes.participant_count` incremented by exactly 1,
- and a receipt showing that real `user_votes.id`, status `נרשם`, no `SealCard`, no `BLOCK` row, no `חתום בבלוקצ׳יין`.

Phase 02.1 is complete in code and green in CI. This is the production confirmation, and only a human with a verified-resident account can produce it.

### Locked — evidence, not assertion

Every gate and every live check writes its actual output into a durable file. Two artifacts:
- `.planning/phases/04-go-live/04-GO-NOGO.md` — the gate ledger. One row per gate (G0–G6), each `BLOCKED` / `CLEARED` / `ACCEPTED-WITH-RISK`, with a date, who decided, and the evidence pointer.
- `apps/web/docs/GO-LIVE-EVIDENCE.md` — the live-run record: deploy output, smoke results, the ₪50 charge, the free-vote read-back, and the reconciliation report.

Both are redacted by construction: no keys, no tokens, no service-role strings, no card data, no real resident emails. Each has an automated grep guard proving it.

### Locked — reconciliation shape

The roadmap says "the internal `transactions` table". **There is no `transactions` table.** The internal ledger is `payments` (`supabase/migrations/20240101000000_initial_schema.sql:148-168`): `id`, `user_id`, `type`, `amount` (agorot), `currency`, `status`, `provider`, `provider_id`, `idempotency_key UNIQUE`, `vote_id`, `option_id`, `metadata JSONB`. The GI document id reaches `provider_id` via `markPaymentCompleted(payment.id, event.paymentId)` (`apps/web/src/app/api/payments/webhook/route.ts:108`), where `event.paymentId` is `parseWebhookEvent`'s defensive `payload.id || payload.documentId || payload.paymentId` (`services/payments/greenInvoice.ts:330-334`).

**Decision:** reconciliation is a **pure function plus a thin CLI**, not a live API integration. The GI service (`services/greenInvoice/index.ts`) exposes only `getToken`, `createPaymentForm`, and `chargeToken` — there is no verified documents-search surface, and inventing one behind an unsigned Prime contract is the wrong bet at go-live. So:
- a pure, dependency-free `reconcile(giRows, paymentRows)` under `apps/web/src/services/reconciliation/`, unit-tested with fixtures in CI — no network, no database, no Next.js imports;
- a `tsx`-run CLI that takes a GI settlement export downloaded from the dashboard (CSV or JSON) plus a live `payments` query, and prints matched / GI-only / internal-only / amount-mismatch buckets.

The pure core is the thing CI can prove. The live run is the checkpoint.

### Locked — repo constraints that shape every verify command

- pnpm monorepo. `pnpm --filter @sync/web typecheck` · `pnpm --filter @sync/web test` · `pnpm --filter @sync/web lint`.
- vitest **1.6.1**, `environment: 'node'`, `include: ['src/**/*.test.ts', 'src/**/*.spec.ts']`. **No jsdom. No `@testing-library/react`. The glob does not collect `.tsx`.** Nothing in this phase adds a DOM stack.
- **Never verify a task against a test file created later in the same plan.** vitest exits `1` with `No test files found`, which `execute-plan.md`'s `verification_failure_gate` reads as a real failure. Gate on `typecheck` plus a positive `grep -q` instead. (This exact blocker was caught by the plan-checker in Phase 02.1 — see `STATE.md`.)
- CLI scripts run through `tsx` (`spike:gi` precedent). `tsx` does **not** resolve the `@/` path alias — a script under `apps/web/scripts/` must import shared logic by **relative path**, and that shared module must not import Next.js. This is the documented lesson from the `gi-spike.ts` harness ("plain `console.log` only, no `@/lib/logger` — tsx-clean, no Next.js path-alias deps").
- **Never** add Claude or Anthropic as a git co-author, trailer, or collaborator on any commit in this phase.
- Design tokens only, Hebrew/RTL, strict TypeScript, no `any` (`CLAUDE.md`).

### Claude's Discretion

- Exact section headings inside `04-GO-NOGO.md` and `GO-LIVE-EVIDENCE.md`, provided each gate and each live check is individually addressable and grep-verifiable.
- Whether the reconciliation CLI ingests CSV, JSON, or both — as long as the pure core is format-agnostic and the CLI guards before any credentialed call.
- Whether the CI fix is a fail-fast preflight step, a `workflow_dispatch`-only guard, or both; and whether the notify step becomes `continue-on-error`.
- Hebrew wording for anything user-facing, within the constraint that it claims nothing untrue.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The gates
- `apps/web/docs/GI-LEGAL-CHECKLIST.md` — SPIKE-02. 0/19 ticked, unsigned, written against the retired ₪6 membership model
- `apps/web/docs/GI-PRIME-CHECKLIST.md` — SPIKE-03. 0/24 ticked, unsigned, same stale framing
- `apps/web/docs/SPIKE-RESULT.md` — SPIKE-01. Part A is seven `_(pending live run)_` rows; Part B is a genuine code-derived trace and is sound. SPIKE-01 gates Phase 6, not this phase — recorded here only so nobody re-litigates it at go-live
- `apps/web/wrangler.jsonc:67-76` — the live cron list and `vars` block, including `GREENINVOICE_ENV: production`
- `.github/workflows/deploy.yml:59-78` — the deploy step with the unset token, and the notify step that 403s

### Deploy and secrets
- `apps/web/docs/INTEGRATIONS.md` — the secrets runbook and the 5-step deploy sequence. **Stale:** its GI row still describes "₪3 participation / ₪50 creation, matching `VOTE_COST` / `CREATE_VOTE_COST`" — `VOTE_COST` was retired in Phase 02.1
- `apps/web/scripts/sync-secrets.sh` — pushes non-empty `.dev.vars` lines to the Worker; `SKIP="GREENINVOICE_ENV QUBIK_NETWORK"`; `--dry-run` prints **names only**
- `apps/web/.dev.vars.example` — the full 37-name manifest of what the Worker may need
- `apps/web/package.json` scripts — `cf:build`, `deploy` (`NEXT_PUBLIC_APP_URL=https://taruu.co.il opennextjs-cloudflare build && opennextjs-cloudflare deploy`), `spike:gi`

### The money path being exercised
- `apps/web/src/app/api/payments/create/route.ts` — hosted-form creation; `:77` is the `Date.now()` idempotency key SEC-04 replaces; `:95-98` picks the amount
- `apps/web/src/app/api/payments/webhook/route.ts` — `:108` `markPaymentCompleted(payment.id, event.paymentId)` is where the GI document id lands in `payments.provider_id`; `:52-58` the replay/`webhook_events` guard
- `apps/web/src/services/payments/greenInvoice.ts` — `:213` hosted form, `:328-341` `parseWebhookEvent`, `:345-351` `getPaymentAmounts` (its `// ₪3` comment is a stale leftover of the retired participation fee)
- `apps/web/src/services/greenInvoice/index.ts:35-39` — `resolveBaseUrl()`, the single place `GREENINVOICE_ENV` decides sandbox vs production
- `supabase/migrations/20240101000000_initial_schema.sql:148-168` — the real `payments` table

### The free-vote path being confirmed
- `.planning/phases/02.1-participation-persistence/02.1-05-SUMMARY.md` — "Next Phase Readiness" names this exact manual check
- `apps/web/src/app/api/votes/[id]/participate/route.ts` — the free contract shipped in plan 02.1-04
- `apps/web/src/app/[locale]/votes/[id]/flow/ParticipationFlow.tsx` — receipt shows `ballot.id` / `נרשם`, no seal
- `supabase/migrations/20240101000000_initial_schema.sql:231-245` — `user_votes`, nullable `payment_id`, `UNIQUE(user_id, vote_id)`

### Plan-shape precedents to mirror
- `.planning/phases/02-spike-gate/02-02-PLAN.md` — external-track checklist plan: grep-verifiable section headings, `- [ ]` count assertions, PENDING status markers
- `.planning/phases/05-rbac-admin-review/05-09-PLAN.md` — manual-gate plan: `checkpoint:human-action` + `checkpoint:human-verify`, numbered `## N ...` evidence sections, a secret-leak grep guard in `<automated>`, and a `<resume-signal>`
- `.planning/phases/02.1-participation-persistence/02.1-VALIDATION.md` — the validation contract this phase's `04-VALIDATION.md` mirrors

### Project rules
- `CLAUDE.md` — design tokens, RTL Hebrew, strict TS, no `any`
- `.planning/STATE.md` — Blockers/Concerns; the source of G3/G4/G5
</canonical_refs>

<specifics>
## Specific Ideas

- **The two checklists are the cheapest thing to fix and the most expensive thing to get wrong.** They are the documents that go to a lawyer and to a GI rep. Sending the ₪6-membership version wastes a real-world round trip measured in weeks. Re-scoping them is a wave-1 autonomous task and should be the very first thing this phase does.
- **The CI failure is two defects wearing one coat.** The missing `CLOUDFLARE_API_TOKEN` is the real one. The notify step's `403 Resource not accessible by integration` is separate and would still paint a *successful* deploy red. Fixing only the first still leaves a pipeline nobody trusts.
- **Fail fast, not after the build.** Today the workflow spends ~2 minutes on `pnpm cf:build` and *then* discovers the token is empty. A three-line guard at the top of the job turns a 2-minute red into a 5-second red with an actionable message.
- **`sync-secrets.sh --dry-run` is already the safe preflight primitive.** It prints `would push: KEY` — names only, values never — and skips empty lines by design. A preflight script can lean on it and on `wrangler secret list` (also names-only) without ever touching a value.
- **`payments.idempotency_key` is `UNIQUE NOT NULL`,** which means the reconciliation's internal side already has a natural dedupe key independent of GI. Matching on `provider_id` with `idempotency_key` as the tiebreaker gives a stronger report than either alone.
- **`webhook_events` is a second, independent ledger** (`event_id`, `payload_hash`, `idempotency_key`, `status`). A GI-only row that *does* appear in `webhook_events` but not in `payments` is a different failure (fulfilment broke) from one that appears in neither (notify never arrived). The reconciler should be able to say which.
- **The treasury accrual is deliberately non-fatal** (`payments/webhook/route.ts`: "Non-fatal: reconciliation can replay from payments + webhook_events"). That comment is a promise this phase's tool is the first thing to actually keep — but only for the `payments` leg. The `treasury_transactions` leg stays behind COIN-01.
- **Phase 5 is already executing out of roadmap order.** `05-01-SUMMARY.md` and `05-02-SUMMARY.md` are dated 2026-08-03, `SUPABASE_JWT_SECRET` is already in `env.ts:25-28`, and `role_grants` / `role_grant_events` / `community_manager_applications` migrations exist — while the roadmap sequences Phase 5 *after* Phase 4. Go-live's env and migration state must be read from the repo, not from the roadmap's ordering.
</specifics>

<deferred>
## Deferred Ideas

- **Any token / Bags.fm go-live** — gated on COIN-01, a written Israeli legal sign-off on securities status, treasury custody, and permissible claims. Stricter than SPIKE-02 and not a reuse of it. Nothing in this repo can clear it.
- **`treasury_transactions` reconciliation** — moves to the token track with COIN-01. Explicitly out of this phase's zero-mismatch criterion.
- **A live GI documents-search integration** — the service has no such surface today and building one behind an unsigned Prime contract is the wrong sequencing. Revisit once G2 closes.
- **Orphaned-charge recovery cron** (charged-but-uncommitted / committed-but-uncharged) — v2 HARD-01. This phase produces the report; automating the sweep is later.
- **Refund / chargeback reversal entries** — v2 HARD-02, and dependent on the זיכוי mechanics G1 is meant to establish.
- **The Cloudflare account-level cron gate** (`wrangler.jsonc:58-64`: only `0 */6 * * *` is live; the other four crons were rejected at deploy) — a Phase 6 blocker for the renewal scheduler. Note it at go-live if the missing crons matter for launch traffic; do not attempt to resolve it here.
- **Auth0 callback CSRF / PKCE** — v2 HARD-03.
- **Mobile go-live** — web-first.
- **Retiring the orphaned `AUTH0_*` and `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` entries from `env.ts`** — Phase 3 SEC-05. This phase only verifies the result.
- **Backfilling votes lost between 2026-07-29 and the 02.1 fix** — a data question, already flagged in `02.1-CONTEXT.md` and unchanged here.

</deferred>

---

*Phase: 04-go-live*
*Context gathered: 2026-08-03 — every gate above was verified against the repo during planning (checklist box counts, `gh secret list`, the failing `deploy.yml` run log, `env.ts` reader counts by grep, and the absence of a `transactions` table). Where the roadmap or STATE.md disagreed with the repo, the repo won and the discrepancy is recorded.*
