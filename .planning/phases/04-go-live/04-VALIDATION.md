---
phase: 04
slug: go-live
status: planned
nyquist_compliant: true
wave_0_complete: n/a
created: 2026-08-03
updated: 2026-08-03
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

> **Note:** research was skipped for this phase by planner judgement — it is a checklist-and-gate
> phase over an existing, shipped system, and the repo audit performed during planning (checklist box
> counts, `gh secret list`, the failing `deploy.yml` run log, `env.ts` reader counts by grep, the
> absence of a `transactions` table) supplied every fact a RESEARCH.md would have. This strategy is
> derived from `04-CONTEXT.md` and the existing suite.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 1.6.1 (`apps/web/package.json`) |
| **Config file** | `apps/web/vitest.config.ts` — `environment: 'node'`, `include: ['src/**/*.test.ts', 'src/**/*.spec.ts']` |
| **Quick run command** | `pnpm --filter @sync/web test -- <path>` |
| **Full suite command** | `pnpm --filter @sync/web test` |
| **Static checks** | `pnpm --filter @sync/web typecheck` · `pnpm --filter @sync/web lint` |
| **Shell/YAML checks** | `bash -n apps/web/scripts/preflight-prod.sh` · `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))"` |
| **Estimated runtime** | ~1s quick · ~60s full |

**Four constraints that shaped every choice below (verified 2026-08-03, not assumed):**

1. **This phase is mostly not testable in CI, and that is the point.** Four of six plans are manual
   gates whose subject is a running production system, an unsigned legal opinion, or a commercial
   term in an email. Their automated verify commands therefore assert on the **evidence artifact** —
   headings present, required strings present, verdict recorded, and no secret leaked — not on the
   behaviour. The behaviour is verified by a human and recorded; the automation proves the recording
   happened and is redacted.
2. **There is no component-test setup.** `environment: 'node'`, no jsdom, no `@testing-library/react`,
   and the include glob never collects `.tsx`. Nothing in this phase adds one. The only new code
   under test — the reconciliation core — is a pure `.ts` module by design, which is also what makes
   it importable from a `tsx` CLI.
3. **`tsx` does not resolve the `@/` alias.** `scripts/gi-spike.ts` established the rule. The
   reconciliation CLI therefore imports the core by relative path, and the core imports nothing at
   all — asserted by `grep -c "^import" ... == 0`, which is both a purity check and a
   tsx-compatibility check.
4. **No task verifies against a test file created later in the same plan.** vitest 1.6.1 exits `1`
   with `No test files found`, which `execute-plan.md`'s `verification_failure_gate` reads as a real
   failure. Only `04-03-T1` runs a test file, and it creates that file within the same task
   (RED → GREEN). Every other task gates on `typecheck`, `bash -n`, a YAML parse, a `--help` exit, or
   a positive `grep -q`.

---

## Sampling Rate

- **After every task commit:** run that task's `<automated>` command
- **After every plan:** `pnpm --filter @sync/web test` + `pnpm --filter @sync/web typecheck`
- **After every wave:** full web suite + `pnpm --filter @sync/web lint`
- **Before `/gsd:verify-work`:** all three green
- **Max feedback latency:** 60 seconds

Checkpoint plans (04-04, 04-05, 04-06) add a fourth sample: their evidence artifact must pass its
secret-leak grep **before** the checkpoint resumes. A leaked value is a blocking failure, not a
cleanup task.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-T1 | 01 | 1 | GO-01 | doc assertion (grep, positive + negative + box count) | `grep`-chain over `apps/web/docs/GI-LEGAL-CHECKLIST.md` | ✅ rewritten in place | ⬜ pending |
| 04-01-T2 | 01 | 1 | GO-01 | doc assertion (grep + secret-leak guard) | `grep`-chain over `apps/web/docs/GI-PRIME-CHECKLIST.md` | ✅ rewritten in place | ⬜ pending |
| 04-01-T3 | 01 | 1 | GO-01 | doc assertion (all 7 gate ids + BLOCKED count) | `grep`-chain over `.planning/phases/04-go-live/04-GO-NOGO.md` | ❌ new | ⬜ pending |
| 04-02-T1 | 02 | 1 | GO-01 | YAML parse + step-order assertion | `python3 -c "import yaml; …"` over `.github/workflows/deploy.yml` | ✅ | ⬜ pending |
| 04-02-T2 | 02 | 1 | GO-01 | `bash -n` + `--names-only` exit 0 + forbidden-construct grep | `bash -n scripts/preflight-prod.sh && ./scripts/preflight-prod.sh --names-only` | ❌ new | ⬜ pending |
| 04-02-T3 | 02 | 1 | GO-01 | doc assertion (positive + negative grep) | `grep`-chain over `apps/web/docs/INTEGRATIONS.md` | ✅ | ⬜ pending |
| 04-03-T1 | 03 | 1 | GO-02 | **unit (vitest)** — RED → GREEN, test created in this task | `pnpm --filter @sync/web test -- src/__tests__/services/reconciliation.test.ts` | ❌ new | ⬜ pending |
| 04-03-T2 | 03 | 1 | GO-02 | typecheck + `--help` exit 0 + relative-import grep (self-contained) | `pnpm --filter @sync/web typecheck && tsx scripts/reconcile-gi.ts --help` | ✅ n/a | ⬜ pending |
| 04-03-T3 | 03 | 1 | GO-02 | doc assertion (all six bucket names) | `grep`-chain over `apps/web/docs/RECONCILIATION.md` | ❌ new | ⬜ pending |
| 04-04-T1 | 04 | 2 | GO-01 | **checkpoint** — evidence assertion + ACCEPTED-WITH-RISK scope guard + secret-leak guard | `grep`-chain over `04-GO-NOGO.md` and both checklists | ✅ | ⬜ pending |
| 04-04-T2 | 04 | 2 | GO-01 | **checkpoint** — decision recorded; sandbox flag asserted if `go-restricted` | `grep`-chain over `04-GO-NOGO.md` + `wrangler.jsonc` | ✅ | ⬜ pending |
| 04-05-T1 | 05 | 3 | GO-01 | **checkpoint** — six evidence headings + deployment id + secret-leak guard | `grep`-chain over `apps/web/docs/GO-LIVE-EVIDENCE.md` | ❌ new | ⬜ pending |
| 04-05-T2 | 05 | 3 | GO-01 | **checkpoint** — smoke section + three routes + no-env-failure statement + identity guard | `grep`-chain over `apps/web/docs/GO-LIVE-EVIDENCE.md` | ✅ | ⬜ pending |
| 04-06-T1 | 06 | 4 | GO-02 | **checkpoint** — payment read-back (agorot 5000, non-null `provider_id`) or explicit DEFERRED | `grep`-chain with a branch on `Criterion 2 DEFERRED` | ✅ | ⬜ pending |
| 04-06-T2 | 06 | 4 | GO-01, GO-02 | **checkpoint** — before/after read-back + receipt-honesty strings + identity guard | `grep`-chain over `apps/web/docs/GO-LIVE-EVIDENCE.md` | ✅ | ⬜ pending |
| 04-06-T3 | 06 | 4 | GO-01, GO-02 | **checkpoint** — reconciliation verdict + per-criterion outcome + full suite green + sign-off | `pnpm --filter @sync/web test` + `grep`-chain over three files | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Requirement coverage:** GO-01 → plans 01, 02, 04, 05, 06 · GO-02 → plans 03, 06.
Both requirements in `ROADMAP.md` Phase 4 appear in at least one plan; no plan has an empty
`requirements` field.

**Sampling continuity:** every task has an automated command that is green-on-success at the moment
it runs. No three consecutive tasks lack an automated verify.

**No task verifies against a test file that does not exist yet.** The only vitest invocation in the
phase is `04-03-T1`, which creates `reconciliation.test.ts` within that same task under the
RED → GREEN protocol. `04-03-T2` and `04-03-T3` deliberately gate on `typecheck` plus a `--help` exit
plus positive greps rather than on a later test file — the exact blocker the plan-checker caught in
Phase 02.1.

**Negative greps are load-bearing here.** Several tasks assert that something is **gone**
(`₪6`/`membership`/`card-on-file` in the checklists, `VOTE_COST`/`₪3 participation` in
`INTEGRATIONS.md`, `@/` aliases in the tsx CLI, `any` in the reconciliation core, `secret get` in the
preflight). Each is written as `! grep -qE …` inside the `<automated>` chain, so a regression fails
the gate rather than passing silently.

---

## Test Files Created or Rewritten

| File | Plan/Task | New or rewritten | Covers |
|------|-----------|------------------|--------|
| `apps/web/src/__tests__/services/reconciliation.test.ts` | 03 / T1 | new | exact match, GI-only, internal-only (both reasons), amount mismatch, pending-with-null-document, refunded, duplicates on both sides, `toAgorot` normalization incl. `₪` and thousands separators, empty input, optional `webhookEventIds` |

Framework install: **none needed**. No jsdom, no `@testing-library`, no new dev dependency, and no new
runtime dependency (the CSV parsing in the CLI is a local splitter by design).

---

## Manual-Only Verifications

This is the bulk of the phase. Each row is a checkpoint task with a named evidence artifact.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Accountant/legal sign-off on the ₪50 charge (SPIKE-02 / gate G1) | GO-01 | A written opinion from an Israeli accountant or lawyer. No code can produce it, and the current artifact is a 0/19 unsigned template asking about a retired ₪6 membership | Send the re-scoped `GI-LEGAL-CHECKLIST.md`; tick each box with a written answer; fill name and date; confirm in writing the engagement excludes the Bags.fm token (COIN-01). Record in `04-GO-NOGO.md` G1 |
| GI Prime rate + clearing terms + production credentials (SPIKE-03 / gate G2) | GO-01 | Commercial terms only the GI account rep can confirm; credentials exist only in the GI dashboard | Work `GI-PRIME-CHECKLIST.md` with the rep; fill every blank incl. the foreign-card block-or-flag decision; `wrangler secret put` each GI production secret. Record in `04-GO-NOGO.md` G2 — names only |
| Production Worker secrets set (gate G6) | GO-01 | Requires an authenticated wrangler session; UPSTASH / GI-prod / SMS have been empty since 2026-07-28 | `cd apps/web && ./scripts/preflight-prod.sh; echo "exit=$?"` — must exit 0. Paste the names-only output and the exit code into `04-GO-NOGO.md` G6 |
| Deploy path decided (gate G5) | GO-01 | `CLOUDFLARE_API_TOKEN` must be added in GitHub, or manual-only must be deliberately accepted | Either add the secret and dispatch `deploy.yml` (paste the run URL and conclusion) or record `ACCEPTED-WITH-RISK` with a name, a date, and the residual risk |
| `GREENINVOICE_ENV` reconciled with the gate state (gate G3) | GO-01 | A judgement call about running real card traffic ahead of legal sign-off | Either set `wrangler.jsonc:74` to `"sandbox"`, or record `ACCEPTED-WITH-RISK` naming who accepted it. Paste the resulting line |
| Worker deploys and serves live traffic | GO-01 | A claim about a running system | `pnpm deploy`; record the deployment id; curl all three custom domains for non-5xx; confirm Hebrew/RTL, real votes rendering, and `/api/municipalities` returning JSON |
| No `validateEnv()` failure at startup | GO-01 | Only observable in the live Worker log — and only meaningful once Phase 3 SEC-05 has wired a call site | `wrangler tail --format pretty` under your own traffic; confirm no `Environment validation failed`. If `validateEnv()` has no call site, record `Criterion 1 partially NOT MET`, owner Phase 3 SEC-05 |
| Real ₪50 charge settles with a correct חשבונית | GO-02 | Requires a real card and the GI dashboard. Not reproducible in sandbox or with mocks | Create a vote, pay ₪50; read `payments` back (`amount = 5000`, `status = completed`, non-null `provider_id`); open the document in GI and check type, VAT, and Israeli private-payer fields against the accountant's signed answers |
| Document id stored with the transaction | GO-02 | A live database read-back | `SELECT provider_id FROM payments WHERE …` and confirm it equals the GI document id exactly |
| Webhook replay produces exactly one row | GO-02 | Genuine provider retry behaviour against the real `.eq('status','pending')` claim guard | `SELECT idempotency_key, COUNT(*) … HAVING COUNT(*) > 1` returns zero rows; exactly one vote created |
| **A real resident's free vote persists** | GO-01 | The check `02.1-05-SUMMARY.md` names as non-automatable: needs a real session, a verified-resident profile, and a live row read-back | Capture before/after for `vote_options.votes`, `votes.participant_count`, and `COUNT(*) FROM user_votes`; cast; confirm each moved by exactly 1, no other option moved, and exactly one `user_votes` row with `payment_id` NULL |
| The receipt claims nothing untrue | GO-01 | Visual Hebrew/RTL copy check on production | Confirm `מספר רישום` equals the database `user_votes.id`, cost `חינם`, status `נרשם`; no `SealCard`, no `BLOCK` row, no `✓ חתום בבלוקצ׳יין` |
| Double-submit is idempotent on live traffic | GO-01 | Real concurrency against the real `UNIQUE(user_id, vote_id)` constraint | Vote twice; confirm the already-voted receipt, no second row, and no further tally movement |
| GI settlement reconciles to zero open mismatches | GO-02 | Needs a settlement export downloaded from the GI dashboard; there is no verified GI documents-search API to automate against (gate G2) | `pnpm reconcile:gi -- --gi <export> --since <date>`; paste the report and exit code; target the verbatim `RECONCILED: 0 open mismatches` |

---

## Known Gaps Recorded, Not Closed Here

- **Phase 3 is not planned.** `.planning/phases/` has no `03-*` directory. Gate G0 is red at planning
  time, which makes criterion 1's `validateEnv()` clause unachievable and makes NO-GO the honest
  default outcome of plan 04-04. Recorded rather than worked around.
- **`validateEnv()` repair is Phase 3 SEC-05.** Plan 04-05 explicitly forbids wiring it up — as
  written it would fail closed on six variables with zero runtime readers and take production down.
- **Three cron routes have no trigger.** `wrangler.jsonc:58-68` records that the schedules API
  rejected the full list behind an account-level gate; only `0 */6 * * *` is live.
  `/api/cron/resolve-votes`, `/api/cron/verification-notifications`, and `/api/cron/mint-nfts` do not
  fire. Vote resolution not running is product-visible; plans 04-05 and 04-06 require it to be
  recorded at launch rather than discovered by a resident.
- **`treasury_transactions` reconciliation is out of scope.** It moved to the token track behind
  COIN-01. No plan queries it.
- **No token surface goes live.** COIN-01 is unmet and unmeetable from inside this repo.
- **SPIKE-01's `SPIKE-RESULT.md` Part A remains seven `(pending live run)` rows.** It gates Phase 6's
  off-session token charge, not this phase's hosted-form flow. Recorded so nobody re-litigates it at
  go-live.
- **The reconciliation tool is a point-in-time export comparison, not a live integration.** Documented
  in `RECONCILIATION.md`'s Limits section. Orphaned-charge recovery is v2 HARD-01.
- **`deploy.yml`'s notify step 403s** on `gh api … issues/N/comments`. Plan 04-02 makes it
  non-fatal rather than fixing the token permission — the underlying `Resource not accessible by
  integration` is left as a separate, smaller defect.
- **Phase 5 is executing out of roadmap order.** `05-01-SUMMARY.md` and `05-02-SUMMARY.md` are dated
  2026-08-03 and `SUPABASE_JWT_SECRET` is already in `env.ts`, while the roadmap sequences Phase 5
  after Phase 4. Go-live's env and migration state must be read from the repo, not from the roadmap.

---

## Validation Sign-Off

- [ ] All tasks have an `<automated>` verify command
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] No missing test framework — nothing to install
- [ ] No new runtime or dev dependency added
- [ ] No watch-mode flags (`vitest run` via `pnpm test`, never `--watch`)
- [ ] No task verifies against a test file created later in the same plan
- [ ] Every evidence artifact carries a secret-leak grep guard in its `<automated>` command
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
