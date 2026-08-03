---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: Completed 05-05-PLAN.md
last_updated: "2026-08-03T10:50:00.000Z"
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 20
  completed_plans: 10
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-28)

**Core value:** A resident pays ₪6 once a month to vote freely on their city's affairs, and trusts that the civic pool funds the decisions that actually execute.
**Current focus:** Phase 05 — space-governance-substrate-and-space-admin-operations-dashboard

## Current Position

Phase: 05 (space-governance-substrate-and-space-admin-operations-dashboard) — EXECUTING
Plan: 7 of 16 (derived from SUMMARY files on disk — waves 2 and 3 run several plans in parallel, so this counter is a count of completed plans, not a position in a sequence)

## ▶ RESUME HERE (after /clear)

**Phase 5 is EXECUTING** (16 plans, 6 waves). **Waves 1 and 2 are complete** — 05-01, 05-02, 05-03, 05-04 and 05-11 have all landed. **Wave 3 is in progress:** 05-05 is done; 05-06, 05-07 and 05-08 were committing into this same worktree alongside it.

- 05-01 (governance substrate — DB tables, two-file `vote_status` split, `types.ts`); see `05-01-SUMMARY.md`.
- 05-02 (capability vocabulary, review transitions, QUOTA_EXCEEDED, rollout flag, full contract surface); see `05-02-SUMMARY.md`.
- 05-03 (public visibility allow-list, six corrected read paths, reconciled status vocabulary); see `05-03-SUMMARY.md`.
- 05-04 (**the authorization core** — branded `SpaceScope`, `resolveMembership`, two space repositories, the first two use-cases and routes, 52 tests); see `05-04-SUMMARY.md`. **Plans 05-05…05-09 must read three sections of it before adding a repository function:** the limit of the guarantee (`SpaceScope.capability` is carried but enforced by no repository), the two-token cost (`SpaceMembership` needs its own entry points), and the `optional()` extraction note under "For downstream plans".
- 05-05 (**the first real writer** — `space-decision.repo.ts`, the six-guard `decideProposal` chain, POST decide + GET detail routes, 29 tests); see `05-05-SUMMARY.md`. **05-10 must read its "Where plan 05-10 inserts the creation-fee charge" section first:** the seam is `decide-proposal.ts:118`, between `resolveDecisionTarget` (116) and `transitionProposal` (123), and moving it after the transition yields publish-then-charge. **05-13** builds Surface 2 against both endpoints; the decision responds with a full `ProposalDetail` carrying the new status.
- 05-11 (np-native shell + eight UI primitives: `SpaceAdminHeader`, `SpaceAdminNav`, `PressTable`, `StatusChip`, `ConfirmDialog`, three panels); see `05-11-SUMMARY.md`. **Surface plans 05-12…05-15 should read that summary's "Component API" section before writing a line** — it gives every prop signature, and `components/space-admin/index.ts` is a CLOSED barrel they must not reopen (import new components by direct path).

**Two things from 05-03 need someone's attention before the phase closes** — both detailed in `05-03-SUMMARY.md` and `deferred-items.md`:

1. **CI is red on `apps/mobile`** — 130 `TS2786` errors from a duplicate `@types/react` (18.3.27 and 19.2.7 both installed). Not caused by 05-03; it appeared mid-wave-2 after an install. Root `pnpm.overrides` pin + reinstall on a quiet tree.
2. **Commit `5979545` has mixed authorship** — it carries 05-04's `apps/web/package.json`/`pnpm-lock.yaml` and seven of 05-11's `space-admin/` files, swept in from a shared git index. No content lost. Later plans in this tree should commit with the path-scoped form `git commit -m "…" -- <path>`, which ignores everything else in the index.

Outstanding from 05-01: the Phase 5 migrations have **never been applied to a live Postgres** (no Docker/psql on the exec machine). `supabase/tests/audit_append_only.sql` is committed but uncaptured. 05-16 owns that verification.

For plans 03–09: import the capability vocabulary from `apps/web/src/server/domain/space/capability.ts`, the review rules from `.../space/review.ts`, and **every** request/response shape from `packages/shared/src/contracts/spaceAdmin.ts`. That contract file is complete for the phase — no later plan should need to edit it, or `apps/web/src/server/http/errors.ts`.

Phase 1 completed:

- 01-01 (LAND-01): Auth0 OIDC swap, Printful POD removal, RLS user_id helper fix — commit 44961e0
- 01-02 (SEC-01): Corrective RLS migration for treasury/issue_coin/phone_verifications per-user policies — commit 31d6860

After Phase 1: Phase 2 = GI sandbox spike (the gate). Start the slow external tracks NOW in parallel — GI Prime plan provisioning + accountant/legal merchant-of-record sign-off — neither is code; both gate go-live.

Open question to resolve before Phase 3 planning: **monthly civic-pool allocation policy** (how the month's ₪2.10×members pool splits across executed decisions).

## Performance Metrics

**Velocity:**

- Total plans completed: 2
- Average duration: ~5 min
- Total execution time: ~13 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-clean-foundation | 2 | ~13 min | ~6.5 min |

**Recent Trend:**

- Last 5 plans: 8 min (P01), 3 min (P02)
- Trend: fast

*Updated after each plan completion*
| Phase 01-clean-foundation P01 | 8 min | 3 tasks | 32 files |
| Phase 01-clean-foundation P02 | 3 min | 2 tasks | 1 file |
| Phase 02-spike-gate P02 | 2 | 2 tasks | 2 files |
| Phase 02-spike-gate P01 | 4 | 3 tasks | 4 files |
| Phase 05-space-governance-substrate-and-space-admin-operations-dashboard P01 | 7 min | 3 tasks | 6 files |
| Phase 05-space-governance-substrate-and-space-admin-operations-dashboard P02 | 12 min | 3 tasks | 10 files |
| Phase 05-space-governance-substrate-and-space-admin-operations-dashboard P03 | 25 min | 3 tasks | 9 files |
| Phase 05-space-governance-substrate-and-space-admin-operations-dashboard P11 | ~50 min active | 3 tasks | 19 files |
| Phase 05-space-governance-substrate-and-space-admin-operations-dashboard P04 | 11 min + checkpoint | 4 tasks | 14 files |
| Phase 05-space-governance-substrate-and-space-admin-operations-dashboard P05 | 14 min | 3 tasks | 6 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Rail swap: Green Invoice card-on-file replaces Paddle for vote payments (2026-06-27)
- Pricing CHANGED to MEMBERSHIP (2026-06-29): first vote of a calendar month = ₪6, rest of month FREE; creation ₪50; GI Prime required. The ₪6 splits ₪2.10 → monthly civic pool / ₪3.90 → platform (net ₪2.47/member/mo). (Supersedes the ₪5/vote model.)
- Treasury: ₪2.10/member/month → monthly POOL allocated to the month's executed decisions (NOT per-vote — free votes can't fund per-vote treasury)
- Growth bet: Target band (₪40k take-home) needs ~8,000 monthly members + 900 creates — ~1.5-2x old engagement
- Uncommitted working-tree change (Auth0 + Printful removal + RLS): verdict = coherent + landable as one commit
- SPIKE-02/03 (legal, Prime plan) are parallel external tracks — gate go-live, not the rails build
- [Phase 01-clean-foundation]: AUTH0_DOMAIN server var removed from env schema — bare var had no readers; NEXT_PUBLIC_AUTH0_DOMAIN and AUTH0_CLIENT_SECRET retained
- [Phase 01-clean-foundation]: POD columns (pod_order_id, tracking_number, tracking_url, carrier) dropped via idempotent migration 20260628000001 — Printful definitively abandoned
- [Phase 01-clean-foundation]: supabase/.temp/ and .mcp.json gitignored — machine-specific scratch files
- [Phase 01-clean-foundation]: auth.uid() replaced with public.user_id() on treasury_transactions, issue_coin_holdings, phone_verifications per-user SELECT policies — built-in helper returns NULL under custom JWT
- [Phase 01-clean-foundation]: USING(true) public-read policies on treasury and issue_coins deliberately left untouched — balances and token info are public by product design
- [Phase 02-spike-gate]: Tourist/foreign-card surcharge (~3.5%) captured as explicit block-or-flag decision gate in GI-PRIME-CHECKLIST.md
- [Phase 02-spike-gate]: Both SPIKE-02/03 checklist docs flagged PENDING/external-human-track — gate Phase 4 go-live only, not Phase 3 build
- [Phase 02-spike-gate]: chargeToken() appended to greenInvoice service — extend, not rebuild; mirrors createPaymentForm auth pattern
- [Phase 02-spike-gate]: type:320 reused in chargeToken() — same GI document-issuance type as createPaymentForm
- [Phase 02-spike-gate]: Spike harness uses plain console.log only (no @/lib/logger) — tsx-clean, no Next.js path-alias deps
- [Phase 05-space-governance]: spaces.id reuses municipalities.council_id — the public council page and the administered space are the same object, no mapping table
- [Phase 05-space-governance]: vote_status extension MUST stay split across two migration files; Postgres rolls back ADD VALUE if the same transaction uses the new label
- [Phase 05-space-governance]: All four new vote_status labels anchor BEFORE 'pending' (a pre-existing label), never chained onto each other
- [Phase 05-space-governance]: space_audit_log is append-only by trigger + REVOKE, not RLS — the service role has BYPASSRLS; ON DELETE RESTRICT on both FKs makes SPACE-09 structurally true
- [Phase 05-space-governance]: Eleven-capability manifest is DB-enforced by CHECK and authoritative; 05-RESEARCH.md's draft vocabulary (space.read, proposal.decide, grant.manage, notification.compose) is SUPERSEDED
- [Phase 05-space-governance]: Audit actions are past tense (proposal.approved), capabilities imperative (proposal.approve) — not interchangeable; only 'proposal.approved' is structurally load-bearing via uq_space_proposal_single_approval
- [Phase 05-space-governance]: platform_escalations.space_id is nullable by design, paired with non-null raw_space_id, so the escalation endpoint cannot be used as a space-existence oracle
- [Phase 05-space-governance]: types.ts writers in phase 5 are 05-01 (wave 1) and 05-08 (wave 3) ONLY; 05-07 must not edit it, which is why space_admin_metrics is pre-typed
- [Phase 05-space-governance]: TS capability vocabulary in server/domain/space/capability.ts matches the DDL CHECK list identifier-for-identifier and in order — verified after both wave-1 plans landed
- [Phase 05-space-governance]: No twelfth `space.read` capability — reaching the dashboard shell is membership (holding ≥1 grant), resolved by resolveMembership() in 05-04, not a capability
- [Phase 05-space-governance]: proposal.reject covers request-changes as well as reject; only proposal.approve publishes. Do not add a separate request-changes capability
- [Phase 05-space-governance]: `pending` keeps its existing meaning ("scheduled, not started") and is NOT a decidable review state — pinned by test in review.test.ts
- [Phase 05-space-governance]: QUOTA_EXCEEDED → 429 with body {error:'Quota exceeded', code:'QUOTA_EXCEEDED'} only — no scope, count or limit leaked; localized text lives in the UI keyed off `code`
- [Phase 05-space-governance]: Notification quota is a CALENDAR MONTH with a reset date (`מכסה חודשית`), not a rolling 24h window
- [Phase 05-space-governance]: Escalations write to platform_escalations only, never to a space audit log — the log is append-only and any authenticated user can escalate, so there is deliberately no `escalation.raised` audit action
- [Phase 05-space-governance]: packages/shared/src/contracts/spaceAdmin.ts is the phase's COMPLETE contract surface — plans 03–09 import from it and must not reopen it or errors.ts
- [Phase 05-space-governance]: SpaceSummary.type stays z.string() rather than an enum so the contract does not fork the DDL's space-type list that #74 will extend
- [Phase 05-space-governance]: SPACE_ADMIN_ENABLED=false is the whole-dashboard kill switch (default on); rollback touches no governance table and no audit history
- [Phase 05-space-governance]: PUBLIC_VOTE_STATUSES is the ONE allow-list governing public vote visibility — both the default filter and the validation set; no second "filterable" list
- [Phase 05-space-governance]: 'failed' is deliberately OFF the public allow-list (a real, intended narrowing — such votes were visible before); 'pending' is deliberately ON it (means "scheduled", not "awaiting approval")
- [Phase 05-space-governance]: getVoteById is the FILTERED name; getVoteByIdUnfiltered is the internal escape hatch, callable only after authorization — so the default reach is the safe one
- [Phase 05-space-governance]: ?status=in_review returns 200 with the ordinary public list, never a 400 — a validation error there would be an existence oracle for the review vocabulary. Normalise before validating
- [Phase 05-space-governance]: shared VoteStatus carries all ten DB labels; 'cancelled' stays out and is documented as a legacy API alias mapped to 'ended'
- [Phase 05-space-governance]: The disabled-state override is authored `:disabled`-qualified — `.x:disabled` (0,2,0) and `.x:disabled:hover` (0,2,1) — because a bare className class is (0,1,0) and silently loses to NewsButton's `.ink:hover` (0,1,1). No dimming: it would drag `--np-paper-2` below its 0.03 AA margin. Canonical copy in ConfirmDialog.module.css, exported as `confirmButtonClass`
- [Phase 05-space-governance]: The `--np-red-dark` hover fix applies to dense `ink` buttons ONLY. `outline` already inverts to ink at 16.66:1, and it is the declared trigger for every destructive row action, so it never takes a red fill
- [Phase 05-space-governance]: CHECKPOINT DECIDED — branded `SpaceScope` is committed to (`commit-scope` over `fallback-assert`). A raw id at the data layer is `error TS2345`; the fallback would trade that compile error for a convention without reducing the measured cost. All of 05-05…05-09 are written against this
- [Phase 05-space-governance]: `SpaceScope` is mintable ONLY in `server/app/space-admin/authorize.ts`; every space-scoped repository function takes it (or a `SpaceMembership`) as parameter one. `findActiveGrant`/`findGrantsForUser` are the only two functions allowed a raw spaceId — they produce the scope
- [Phase 05-space-governance]: LIMIT OF THE GUARANTEE — `SpaceScope.capability` is carried but read by NO repository. The brand stops raw strings, not wrong-capability scopes; a `metrics.read` scope is structurally accepted by `listProposals`. Capability correctness lives in the use-case's `authorize(…, capability)` argument and is proven only by the matrix test. Issue #68 must not inherit a guarantee that is not there
- [Phase 05-space-governance]: `SpaceScope.municipalityCode` is NON-nullable and `authorize()` refuses a grant whose space has none — otherwise every scoped query silently degrades to `.eq(col, null)` when #74's space types arrive. `SpaceMembership.municipalityCode` stays nullable; it only renders the shell
- [Phase 05-space-governance]: `SpaceMembership` is a SECOND token, never a downcast from `SpaceScope`. Each weaker notion of authority needs its own repository entry points (`findSpaceSummaryByMembership` beside `findSpaceSummary`, funnelling into one private query). A third notion repeats this cost
- [Phase 05-space-governance]: Malformed uuid, unknown space, no grant, wrong capability, suspended grant and null municipality_code ALL return the identical `{error:'Forbidden',code:'FORBIDDEN'}` 403. Never `notFound()` on a space-admin path — existence is data
- [Phase 05-space-governance]: CONVENTION (3 plans have hit this) — when a mandated comment must name a token a mechanical grep counts, phrase the prose without the literal, or scope the grep to exclude comment lines. A count assertion cannot tell prose from code. Hit by 05-01 (`AFTER`), 05-02 (`space.read`), 05-04 (the brand-audit string)
- [Phase 05-space-governance]: `apps/web/src/components/space-admin/index.ts` is a CLOSED barrel owned by 05-11, exporting exactly its eight components. Plans 05-12…05-15 import their own components by direct path and must not reopen it
- [Phase 05-space-governance]: PressTable never switches a cell to `display: block` — responsive reduction is a paired `display: none` on `th[data-col]`/`td[data-col]`, with hidden values reachable through exactly one `<tr>` expansion per row at every width
- [Phase 05-space-governance]: The space-admin layout is chrome only and is documented as NOT the authorization boundary — a Next.js layout does not re-render on navigation and does not gate nested segments, so every page re-resolves space identity and capability server-side
- [Phase 05-space-governance]: The proposal decision is ONE conditional UPDATE carrying `.eq('id')`, `.eq('municipality_id')` and `.eq('status','in_review')` together; zero rows folds to `conflict()` INSIDE `space-decision.repo.ts`, so no caller can forget the 409. Advisory transaction locks were rejected — pooled Supabase connections from Workers make session-scoped lock semantics undependable
- [Phase 05-space-governance]: `DECISION_CONFLICT_HE` in `space-decision.repo.ts` is the single definition of the 409 sentence; the repository raises it on a lost race and the use-case on an already-decided row. Do not re-type the literal — a test pins it to the UI-spec string
- [Phase 05-space-governance]: The 05-10 creation-fee seam is `decide-proposal.ts:118`, between `resolveDecisionTarget` (116) and `transitionProposal` (123). A charge placed after the transition is publish-then-charge and contradicts `אף סכום לא נגבה`. Charge failure is `PAYMENT_INVALID` → 402, never a 500
- [Phase 05-space-governance]: The audit write is the last link of the decision's Result chain, before the terminal `.map(` — a failed `insertAuditRow` fails the whole request, because a published-but-unaudited vote breaks SPACE-04
- [Phase 05-space-governance]: A malformed `voteId` is a 403 at the route edge (`parse(ProposalSummarySchema.shape.id, …)` → `forbidden()`), never a 400 and never a Postgres uuid 500 — the same uniform-denial rule 05-04 set for `spaceId`
- [Phase 05-space-governance]: A module-shape assertion (e.g. "the audit repo exports no mutator") must run against `vi.importActual`, not the mocked namespace — `Object.keys` over a mock describes the mock and cannot fail
- [Phase 05-space-governance]: Red text is compliant PER BACKGROUND — `--np-red-ink` on paper, `--np-paper` on ink, `--np-red` only on aria-hidden tick glyphs. The shared `.np-kicker` utility is 4.03:1 and is replaced phase-locally by `kicker.module.css`

### Roadmap Evolution

- Phase 5 added: Space governance substrate and space-admin operations dashboard (issue #75) — out-of-milestone scope from the Grand Release Crunchtime board, appended rather than opened as a new milestone so the incomplete v1.0 payments phases are not archived

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 2 gate: SPIKE-01 (GI sandbox spike) must clear before Phase 3 coding begins
- Phase 4 external gate: SPIKE-02 (legal/accountant sign-off) + SPIKE-03 (GI Prime + real creds) must resolve before go-live
- CONCERNS.md flags: tourist/foreign-card surcharge (~3.5%) erodes the ₪6 charge — block or flag at charge time
- CONCERNS.md flags: Auth0 callback has no server-side state/CSRF validation — deferred to v2 HARD-03
- Phase 5 migrations (20260802000001-3) are unapplied and unproven — no Docker/psql on the exec machine; supabase/tests/audit_append_only.sql is committed but no transcript captured. 05-16 owns applying them to a scratch DB.
- **CI BLOCKER (found by 05-03):** `pnpm --filter @sync/mobile typecheck` fails with 130 `TS2786` errors from a duplicate `@types/react` (18.3.27 + 19.2.7 both installed). Root `pnpm typecheck` runs `@sync/mobile` on every PR to main, so this reddens CI. Not caused by 05-03 — mobile was green at its Task 1 gate with its change applied. Fix: pin one `@types/react` via root `pnpm.overrides`, reinstall on a quiet tree. See `deferred-items.md` item 5.
- Commit `5979545` mixes three plans' files (05-03's db.ts, 05-04's package.json/lockfile, 05-11's space-admin components) — a shared-git-index race, no content lost. Reconciling plan-to-commit attribution is 05-16's.
- **Shared-worktree hazard, sharper than the index race:** a sibling executor ran `git reset HEAD~1` on the shared branch during wave 2 and orphaned an empty marker commit (visible at `git reflog` HEAD@{10}–{11}). No non-empty commit was lost, but a stray reset in this tree can drop other agents' work. Wave-3+ executors: never reset the shared branch, and prefer `git add <paths> && git commit -m "…" -- <paths>`.
- **05-04's PostgREST embeds are unexecuted.** `spaces!inner(municipality_code)` in the grant resolver, `users(first_name,last_name)` on votes, the actor embed on `space_audit_log`, and the keyset `.or()` predicate in `listAuditRows` are all reviewed but never run — the migrations have never reached a live Postgres. Each fails at runtime, not compile time, if a relationship does not resolve. Add these four to 05-16's checklist.
- 05-11 did NOT perform its plan's one manual step — rendering the shell at `/he/space-admin/{uuid}`. No page exists under `[spaceId]` yet and starting `next dev` in a tree with live executors risks clobbering `.next`. 05-12 is the first plan able to load the route and should confirm the masthead/nav/colophon compose with no top offset.

## Session Continuity

Last session: 2026-08-03T10:50:00.000Z
Stopped at: Completed 05-05-PLAN.md
Resume file: None
