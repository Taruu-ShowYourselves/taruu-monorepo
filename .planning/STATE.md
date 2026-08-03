---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: "05-16 tasks 1-2 complete — evidence captured, three defects found and fixed. BLOCKED on the plan's human-verify checkpoint; no verdict recorded, no requirement ticked."
last_updated: "2026-08-03T12:15:00.000Z"
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 20
  completed_plans: 19
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-28)

**Core value:** A resident pays ₪6 once a month to vote freely on their city's affairs, and trusts that the civic pool funds the decisions that actually execute.
**Current focus:** Phase 05 — space-governance-substrate-and-space-admin-operations-dashboard

## Current Position

Phase: 05 (space-governance-substrate-and-space-admin-operations-dashboard) — EXECUTING
Plan: 15 of 16 (derived from SUMMARY files on disk — waves 2 and 3 run several plans in parallel, so this counter is a count of completed plans, not a position in a sequence)

## ▶ RESUME HERE (after /clear)

**Phase 5 is EXECUTING** (16 plans, 6 waves). **Waves 1 and 2 are complete** — 05-01, 05-02, 05-03, 05-04 and 05-11 have all landed. **Wave 3 is complete** — 05-05, 05-06, 05-07 and 05-08 have all landed. **Wave 4 is complete** — 05-09, 05-10, 05-12, 05-13 and 05-14 have all landed. **Wave 5 (05-15) is complete — all six surfaces now exist.**

### ⛔ 05-16 IS BLOCKED ON A HUMAN VERDICT — READ THIS FIRST

**Tasks 1 and 2 are done; task 3 is a blocking human-verify checkpoint and has no verdict.** Nothing has been ticked: `REQUIREMENTS.md` is untouched, `05-16-PLAN.md` is still `[ ]` on the roadmap, and **no milestone lifecycle step has been run** (phases 3 and 4 are unbuilt, so auditing or completing the milestone would archive it with them incomplete).

- **What exists:** `05-EVIDENCE.md` (the requirement map with an automated/manual/live split, four live transcripts, the limitations section), 22 assertion-guarded frames under `apps/web/tests/e2e/__screenshots__/space-admin/`, `tests/e2e/space-admin.spec.ts` and its seed fixture. See `05-16-SUMMARY.md`.
- **What is needed:** a person to walk the **nine** steps in `05-EVIDENCE.md` §8 and record a verdict at the end of that file, which currently reads `Status: awaiting review.` **Step 4 is the only one nothing automated covers** — whether the disabled confirm *reads* as disabled and *feels* inert on hover. Its computed colours are measured in four states and pass (§6.1); the judgement is what remains.
- **The former step 6 is now automated.** The composer's "staleness fires on change, not on blur" rule — which 05-15 shipped as argued-from-the-code and never observed — is asserted at both widths with a blur counter on the field, one keystroke through the keyboard, and a negative control proving the test fails when the edit is removed (§6.2). The spec is 24 tests: 22 frames plus this one per viewport.

**05-16 found and fixed three defects that `tsc` and 987 green tests could not see** (`05-EVIDENCE.md` §2, commits `f28b8b1` and `5591507`):

1. **`PGRST201` on both proposal reads.** This phase's own `20260802000003` gave `votes` a third foreign key into `users` (`hidden_by`, `flagged_by`), so the unqualified `users(first_name, last_name)` embed became ambiguous and the queue and detail panel answered **500**. Fixed by naming `votes_creator_id_fkey`. **Standing rule: a PostgREST embed must name its foreign key whenever the target table has more than one into the same relation.**
2. **Server Components reading `'use client'` modules.** The audit page threw outright; the proposals page rendered `ErrorPanel` on its own default view. Fixed with a directive-free `filters.ts` beside each surface. **Standing rule: a value a Server Component reads must not live in a client module — only types may cross that line.**
3. Neither class is catchable here: `apps/web` runs vitest with `environment: 'node'`, mocks Supabase everywhere, and has no React harness. **A phase that adds PostgREST queries or Server Components needs one live pass before it can claim to work.** The committed spec plus fixture is that pass.

- 05-01 (governance substrate — DB tables, two-file `vote_status` split, `types.ts`); see `05-01-SUMMARY.md`.
- 05-02 (capability vocabulary, review transitions, QUOTA_EXCEEDED, rollout flag, full contract surface); see `05-02-SUMMARY.md`.
- 05-03 (public visibility allow-list, six corrected read paths, reconciled status vocabulary); see `05-03-SUMMARY.md`.
- 05-04 (**the authorization core** — branded `SpaceScope`, `resolveMembership`, two space repositories, the first two use-cases and routes, 52 tests); see `05-04-SUMMARY.md`. **Plans 05-05…05-09 must read three sections of it before adding a repository function:** the limit of the guarantee (`SpaceScope.capability` is carried but enforced by no repository), the two-token cost (`SpaceMembership` needs its own entry points), and the `optional()` extraction note under "For downstream plans".
- 05-05 (**the first real writer** — `space-decision.repo.ts`, the six-guard `decideProposal` chain, POST decide + GET detail routes, 29 tests); see `05-05-SUMMARY.md`. **05-10 must read its "Where plan 05-10 inserts the creation-fee charge" section first:** the seam is `decide-proposal.ts:118`, between `resolveDecisionTarget` (116) and `transitionProposal` (123), and moving it after the transition yields publish-then-charge. **05-13** builds Surface 2 against both endpoints; the decision responds with a full `ProposalDetail` carrying the new status.
- 05-08 (**the notification substrate and the audience preview** — three tables, the one `resolveAudience`, both fingerprints, a calendar-month DB quota, `POST …/notifications/preview`, 29 tests); see `05-08-SUMMARY.md`. **05-09 must read its "For plan 05-09" section before writing the send:** it pins the sha256 join strings for `audience_hash` and `content_hash`, records that `previewToken` **is** `content_hash` rather than something derived from it, and lists the repository surface including `currentMonthStartIso`/`nextMonthStartIso`, which exist so the send and the quota block cannot compute two disagreeing month boundaries.
- 05-09 (**the send** — dual-fingerprint verification, the DB-counted quota enforced at-or-over the limit, a conditional claim, the in-app rows and the delivery log before any push, `POST …/notifications/send` + `GET …/notifications`, 33 tests); see `05-09-SUMMARY.md`. **05-15 must read its "Error taxonomy the composer must map" table before writing the composer's state machine:** it maps every status code to a composer state and a sentence. Two traps it names — the 429 body carries **no** numbers (the exhausted block reads `{used}/{limit}` and `resetsAt` from `GET …/notifications`), and the two 409s share one code and differ only in their Hebrew string, so the client branches on the string. Note `resolveAudience` now also returns `optedOutUserIds`; the addition is additive and 05-08's 29 tests are unchanged.
- 05-07 (**the two read-only reporting surfaces** — `space_admin_metrics` RPC with the k-anonymity floor in SQL, `getSpaceMetrics`, `listSpaceAudit`, two GET routes, 30 tests); see `05-07-SUMMARY.md`. **05-14 and 05-15 must read its "For 05-14 and 05-15" section before writing a line:** it names the two use-cases to import (never the repositories), gives the base64url cursor encoding so audit links round-trip, and gives the `available`/`suppressed`/`unavailable` render table. Note `participationRate` can be `unavailable` while its neighbours are `available` — that is the deliberate ratio-suppression fix, not a bug.
- 05-06 (**people, content and escalation** — `space-member.repo.ts`, five use-cases, five endpoints, 39 tests); see `05-06-SUMMARY.md`. **05-12…05-15 must read its endpoint table:** it names the eight use-cases to import and states plainly that the repository will run without an authorization call in front of it. **05-09 must read its audit-action list** — the nine actions this plan writes, and the standing rule that there is no escalation action and must not be one. The `/escalations` endpoint is the phase's one un-gated route; its constant `{ "accepted": true }` / 202 answer is what makes it not an existence oracle, and four separate properties hold that up.
- 05-13 (**Surface 2** — the review queue, three decisions behind a required reason, self-submitted rows locked by absence, and `ProposalDetailPanel`, the expanding `<tr>` where the permitted-content controls live); see `05-13-SUMMARY.md`. **05-15 and 05-16 should read its "Two Hebrew sentences this surface does not contain" and "The status labels" sections.** The 409 and 402 copy is rendered from the server's response body rather than re-typed, so a grep for those strings in the client returns nothing by design; and `apps/web/src/components/space-admin/proposalStatusLabels.ts` is the new client-safe status label map — repoint `[locale]/votes/create/page.tsx` at it, then collapse it and `REVIEW_STATUS_LABELS_HE` into one shared definition.
- 05-11 (np-native shell + eight UI primitives: `SpaceAdminHeader`, `SpaceAdminNav`, `PressTable`, `StatusChip`, `ConfirmDialog`, three panels); see `05-11-SUMMARY.md`. **Surface plans 05-12…05-15 should read that summary's "Component API" section before writing a line** — it gives every prop signature, and `components/space-admin/index.ts` is a CLOSED barrel they must not reopen (import new components by direct path).
- 05-12 (**Surface 1** — the overview, `CapabilityManifest`, `EscalationDialog`, the shell-boot spinner, and the four overview figures finally wired); see `05-12-SUMMARY.md`. **05-15 should import `components/space-admin/EscalationDialog.tsx` by direct path** rather than inline a third copy of the escalation dialog — it takes `trigger="cta"` or `trigger="no-permission"` and renders `NoPermissionPanel` itself in the second shape. Deferred items 9 and 11 are its dedupe list.
- 05-15 (**Surfaces 5 and 6** — the notification composer with its eight-state gate, the audit history, and the dedupe backlog four plans had been logging); see `05-15-SUMMARY.md`. **05-16 must read three sections of it.** Its "Files edited outside this plan's `files_modified`" table lists the fifteen files the dedupe pass touched. Its "Criteria met differently than written" section records six, of which two matter for the evidence document: all three send 409s take one branch and render the server's sentence rather than client literals, and the send button takes `disabledButtonClass` rather than `confirmButtonClass` (the latter would give a `red`/`lg` button D23's `ink`-only hover fill). And **nothing on these two surfaces has been rendered, only compiled** — there is no React test harness in `apps/web`, so the plan's manual staleness check is argued from the code and belongs on the screenshot pass. New deferred items 13–17; items 8, 9 and 11 are closed.

**Two things from 05-03 need someone's attention before the phase closes** — both detailed in `05-03-SUMMARY.md` and `deferred-items.md`:

1. ~~**CI is red on `apps/mobile`** — 130 `TS2786` errors from a duplicate `@types/react`.~~ **RESOLVED.** Root `pnpm typecheck` is green across all eight workspace packages, `apps/mobile` included, verified repeatedly during 05-16. No pin was needed; the duplicate resolved on its own once the tree settled. `apps/mobile` was typechecked, not exercised — no mobile screen has been rendered.
2. **Commit `5979545` has mixed authorship** — it carries 05-04's `apps/web/package.json`/`pnpm-lock.yaml` and seven of 05-11's `space-admin/` files, swept in from a shared git index. No content lost. Later plans in this tree should commit with the path-scoped form `git commit -m "…" -- <path>`, which ignores everything else in the index.

~~Outstanding from 05-01: the Phase 5 migrations have never been applied to a live Postgres.~~ **RESOLVED.** All 32 migrations apply cleanly from empty (`05-DB-EVIDENCE.md` §1), `audit_append_only.sql` ran 7 PASS / 0 FAIL against the superuser (§2), and 05-16 extended that to the roles the application actually uses (`05-EVIDENCE.md` §4.2). Every phase-5 endpoint has now been executed against a real database — which is how the three defects above were found.

**Still true, and worth carrying:** `supabase/seed.sql` is broken — it inserts users whose `municipality_id` values are absent from `municipalities`, violating `users_municipality_fk` from `20260728000001`. Local developer bootstrap has been broken since that migration, independent of issue #75. Bring a local stack up with seeding disabled and apply `apps/web/tests/e2e/fixtures/space-admin-seed.sql` instead. Fixing it belongs in its own change.

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
| Phase 05-space-governance-substrate-and-space-admin-operations-dashboard P07 | 12 min | 3 tasks | 8 files |
| Phase 05-space-governance-substrate-and-space-admin-operations-dashboard P08 | 15 min | 3 tasks | 8 files |
| Phase 05-space-governance-substrate-and-space-admin-operations-dashboard P06 | 20 min | 3 tasks | 14 files |
| Phase 05-space-governance-substrate-and-space-admin-operations-dashboard P09 | 22 min | 3 tasks | 7 files |
| Phase 05-space-governance-substrate-and-space-admin-operations-dashboard P15 | 38 min | 3 tasks + dedupe | 31 files |

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
- [Phase 05-space-governance]: The composer's state is DERIVED from data in one expression over eight names, never assigned in a handler — a stored state is how a send control outlives the preview that justified it
- [Phase 05-space-governance]: Whether an error body may be shown to an admin is decided by its CODE, not by the status alone — only conflict() and paymentInvalid() require a reason, so only CONFLICT and PAYMENT_REQUIRED guarantee a Hebrew sentence; an unreasoned FORBIDDEN answers the English literal
- [Phase 05-space-governance]: The disabled-state contract (D17/D27) is SPLIT from the dense-ink hover fix (D23) — a red lg or outline control takes the appearance without the red hover fill, which would lower its already-compliant 16.66:1 inversion
- [Phase 05-space-governance]: spaces.type labels and the nav-visibility map live in components/space-admin/chrome.ts; an unmapped type falls back to the Hebrew generic, never to the stored machine value
- [Phase 05-space-governance]: The audit surface's keyset trail rides in the URL (?cursor=&trail=), so paging backwards is a navigation the surface can see and a deep page stays linkable
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
- [Phase 05-space-governance]: A RATIO DISCLOSES ITS NUMERATOR. `participation_rate_pct` is withheld when EITHER side is below the k-anonymity floor, not only the denominator — with residents published, rate × residents / 100 recovers a suppressed participant count almost exactly. Any future derived figure inherits the suppression of every input it is derived from
- [Phase 05-space-governance]: A withheld RATE is `unavailable`, never `suppressed`. The UI renders a suppressed figure as the literal `<5`, which on a percentage card asserts "under five percent" — a different and possibly false claim. `suppressed` is for headcounts only
- [Phase 05-space-governance]: `get-metrics.ts` publishes a figure's value only when that figure's own status is `available`, so the k-anonymity floor holds in two independent places — a future SQL edit that nulls the status but forgets the value leaks nothing through the API. A test proves this layer with a row the shipped SQL cannot produce
- [Phase 05-space-governance]: The audit cursor on the wire is base64url of the repository's `${created_at}|${id}` keyset; the codec lives in `list-audit.ts`, and `space-audit.repo.ts` is unchanged. A cursor that does not decode is a 400 checked AFTER `authorize()`, so an unauthorized space still answers the identical opaque 403 whatever the cursor looks like
- [Phase 05-space-governance]: `space_admin_metrics` returns NO ROW for a nonexistent or non-municipal space (`WHERE EXISTS (SELECT 1 FROM s)`), because its `raw` CTE has no FROM and would otherwise always yield one row of zeroes presented as measurements. The caller maps no-row to four `unavailable` figures and a 200 — a DB *error* still 500s
- [Phase 05-space-governance]: CONVENTION UPDATE — the comment-versus-grep collision has now hit six plans; 05-07 added three more instances (`RETURNS TABLE`, the word `total`, and the anon/authenticated grant line). Treat it as the default hazard when writing any criterion that counts a literal. 05-08 added three more (the built-in session helper in the migration, `createRateLimiter` in the "this is not the quota" comment, and the device-token table name)
- [Phase 05-space-governance]: NULL `notification_settings` MEANS OPTED IN. The column is nullable JSONB the existing fan-out ignores entirely, so absence is "never asked", not "declined". Only an explicit `spaceAnnouncements: false` excludes. Reading absence as refusal would silently mute every existing resident the first time an admin sent anything. Opt-in would be a migration backfilling the key, not a flipped comparison
- [Phase 05-space-governance]: `previewToken` **IS** `content_hash` — the same string from one variable, not a token derived from a hash. Both are sha256Hex of `[title.trim(), body.trim(), audienceFilter.trim()].join('\n')`; `audience_hash` is sha256Hex of the SORTED recipient ids joined by `,`. 05-09 must re-derive both identically or correct sends fail
- [Phase 05-space-governance]: The notification preview returns 200 on an exhausted quota, deliberately — composer state 0 needs the true `{used}/{limit}` and a reset date to render the block that explains why the send control is absent. The 429 belongs to the send. Do not "fix" the preview into a 429
- [Phase 05-space-governance]: The month boundary is computed in TypeScript (`currentMonthStartIso`/`nextMonthStartIso` in `space-notify.repo.ts`), because PostgREST filter values are literals and cannot be `date_trunc('month', now())`. Both are exported so the send and the quota block cannot derive two boundaries that disagree
- [Phase 05-space-governance]: `push.repo.ts` now carries TWO projections of one batched query — `activeTokensForUsers` (deduped tokens, for fan-out) and `usersWithActiveChannel` (a Set of user ids, for counting people with no channel). The token form structurally cannot answer the second question; adding a sibling projection beside it beat opening a second access path

- [Phase 05-space-governance]: The `/escalations` endpoint is the phase's ONE un-gated route. Its opacity rests on four properties and breaks if any is removed: membership attempted once and folded to null with `unwrapOr` (no error inspection, no separate lookup, no uuid-shape branch); `platform_escalations.space_id` nullable against a non-null `raw_space_id`; a FROZEN constant response body `{ accepted: true }` at 202, deliberately NOT `EscalationResponseSchema` whose fresh id and timestamp would make two answers unequal; and a limiter keyed by user, never by space
- [Phase 05-space-governance]: Repository functions are renamed away from their use-case twins throughout 05-06 — `insertMemberSuspension`/`liftMemberSuspension` beside the `suspendMember`/`reinstateMember` use-cases, as `listSpaceMembers` sits beside `getSpaceMembers`. One name across the app and infra layers is how a Server Component reaches the database with no authorization call in front of it
- [Phase 05-space-governance]: Reinstatement restores ONLY the grants the suspension itself took, matched on the suspension's own timestamp. Clearing every suspended grant would resurrect a capability revoked individually BEFORE the suspension, contradicting the confirmation copy `אותן הרשאות שהיו לפני ההשעיה`
- [Phase 05-space-governance]: Member suspension and reinstatement are each two writes with no transaction available through PostgREST, and the ORDER is the mitigation — suspend writes grants first and the record second, reinstate writes the record first and grants second, so a partial failure always leaves access closed rather than open. Do not "simplify" the ordering
- [Phase 05-space-governance]: The members response is re-parsed through `SpaceMemberListResponseSchema` at the route. Zod strips keys the schema does not name, so the privacy allow-list is enforced three times — repository column list, use-case narrowing, contract strip at the edge — and a leak past the first two still cannot reach the wire
- [Phase 05-space-governance]: A shape written into a `Json` column must be an object TYPE ALIAS, not an interface — TypeScript grants the implicit index signature only to the alias, so an interface makes the audit write `error TS2322`
- [Phase 05-space-governance]: `optional()` is STILL not extracted after 05-06, deliberately and without a copy: every 05-06 surface is gated on a single capability, so a missing capability is a 403 for the whole endpoint rather than an absent widget. 05-07 is the genuine first reuse

- [Phase 05-space-governance]: The send verifies THREE things against the campaign row, not two: recomputed `contentHash` (catches an edited message), the echoed `previewToken` (catches a replayed token against an unedited message), and the re-resolved `audience_hash` (catches a membership change). Dropping the token comparison as "redundant with the recomputation" removes the only check on replay
- [Phase 05-space-governance]: `resolveAudience` returns `optedOutUserIds` as well as the count, because `space_notification_deliveries.user_id` is NOT NULL and the send writes one suppressed row per opt-out. The list is deliberately NOT part of `audience_hash` — an opt-out by someone who was never a recipient must not invalidate a correct preview
- [Phase 05-space-governance]: The campaign is CLAIMED (conditional UPDATE on `status = 'previewed'`) before the first recipient row is written, so a concurrent second send loses before it can duplicate an inbox row. The consequence is a structural window: a failure between the claim and the audit row leaves a `sent` campaign with no recipients and one unit of quota spent. PostgREST offers no cross-statement transaction; 05-16 decides whether that needs an RPC
- [Phase 05-space-governance]: `GET …/notifications` returns `{ campaigns, quota }` with a TOP-LEVEL quota block, not a per-campaign `quotaRemaining`. Composer state 0 renders before any campaign exists and needs `{used}/{limit}` plus `resetsAt` from `nextMonthStartIso()`. The 429 body carries no numbers, so the exhausted block must read them from here
- [Phase 05-space-governance]: The two send 409s differ only in their Hebrew sentence — both are `CONFLICT`. 05-15 must branch on the string, not the code: `הקהל השתנה…` is a re-preview, `ההודעה שונתה…` is a re-cost, and `ההתראה כבר נשלחה.` should render the sent receipt rather than the failure copy
- [Phase 05-space-governance]: Push-channel delivery rows record PEOPLE, not devices. Expo dedups to tokens and returns tickets that cannot be attributed back to a user, so a `push`/`delivered` row means the fan-out was accepted for someone who had a channel — never that a device buzzed. `in_app` remains the delivery of record
- [Phase 05-space-governance]: CONVENTION UPDATE — the comment-versus-grep collision hit 05-09 twice more, and both were dictated by the plan itself: it asked for a comment naming `createRateLimiter` while its own verification forbade the literal, and the same for `await fanOutCampaignPush`. Nine plans now. When a plan asks for a comment containing a string another criterion counts, the comment loses the literal and keeps the meaning

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
- **`space_admin_metrics` (05-07) is unapplied like the rest.** Three probes belong on 05-16's checklist: call it for a real space; for a random uuid (must return **zero rows**, not a row of zeroes); and for a space with a NULL `municipality_code` (must return zero rows). The `WHERE EXISTS` guard is the only thing standing between a nonexistent space and a fabricated `registered_residents: 0, status: 'available'`, and it has never executed.
- **05-06's repository predicates are unexecuted, and one of them is load-bearing for every 409 in the plan.** Four items for 05-16's checklist: the `or=(first_name.ilike.*t*,last_name.ilike.*t*)` member search; the `23505` code surfacing on the supabase-js error for `uq_active_grant` and `uq_active_member_suspension`; the exact-timestamp match in `liftMemberSuspension` (assumes Postgres returns the ISO string it was given); and — **first priority** — `.select()` after an `UPDATE` returning the affected rows. Every conflict detection in `space-member.repo.ts` reads a zero-length array as "already in that state"; if that returns something else, all of the plan's 409s silently become 200s.
- **05-09's writes are unexecuted, and one of them shares 05-06's first-priority risk.** Four items for 05-16's checklist: `claimCampaignForSend`'s `.select()` after a conditional `UPDATE` (zero rows *is* the "already sent" 409 — if a conditional update returns something else, every send either always 409s or never detects a double send); `insertDeliveries`' `ignoreDuplicates` against `uq_delivery_once`, whose whole purpose is retry idempotency; the bulk insert into `user_notifications` with its two nullable FKs; and the history query's `.order('sent_at').limit()` against the partial quota index. **Plus a design question 05-16 should rule on:** a failure between the claim and the audit row leaves a `sent` campaign with zero recipients and one unit of quota spent — acceptable, or does the send need an RPC?
- **A layout that narrows its own route param fails Next's generated validator (found and fixed by 05-14).** `space-admin/[spaceId]/layout.tsx` declared `params: Promise<{ locale: Locale; … }>`; `LayoutConfig` types a layout's params from the route segments as plain strings, so `tsc --noEmit` failed with `TS2344` as soon as `.next/types` regenerated — and `next build` would too. Fixed in `1bd7134` by narrowing in the body, the pattern `[locale]/layout.tsx` already uses. **Pages are exempt** (`AppPageConfig` intersects with `any`), which is why the six surfaces can declare `Locale` directly. Worth knowing before anyone "tidies" a layout signature.
- **05-14 shipped two surfaces that have never been rendered.** Members and statistics typecheck and lint; neither has been loaded in a browser, and none of their five fetches has reached a route. The RTL layout, the 768px column reduction, the row flash and the LTR isolation of the suppressed `<5` figure are reviewed, not seen. Screenshots 5–8 are 05-16's, and #7–8 need a fixture space small enough to produce a suppressed bucket, which needs the metrics migration applied first.
- **"Show all" on the proposals surface is two reads, not one (found by 05-13).** `listProposals` with no status filters to the four REVIEW statuses; the published status is not among them. Since audit-log deep links point at *decided* proposals — most often approved ones — a single unfiltered read would silently omit exactly the rows `?proposal={id}` exists to reach. Surface 2 issues two authorized reads and merges them. Anyone adding a "show everything" view elsewhere in this phase has the same trap.
- **`PressTable` gained two optional props in 05-13** — `renderExpansionRow` (the caller returns the whole expansion `<tr>`, so it owns the `<td colSpan>` and the id its trigger's `aria-controls` names) and `rowClassName` (the post-decision row flash, unreachable otherwise because the table paints cell backgrounds). Both are additive; 05-14 already consumes `rowClassName`.
- **05-13 shipped a third surface that has never been rendered.** Proposals typecheck and lint; no browser, no fetch executed, and the plan's manual deep-link check is undone — it needs a space, a grant and a proposal, and the migrations are still unapplied. Screenshots 3–4 and 16a/16b are 05-16's, and 16b needs a fixture proposal that is hidden **and** flagged at once.
- **The shell has now been rendered (05-12), and four overview states with it.** `next dev` on port 3999 against a throwaway PostgREST stub in the scratchpad, with a minted session cookie: masthead/nav/colophon compose with no top offset; a `metrics.read`-only admin gets two nav links, zero figure cards and a 1-✓/10-✕ manifest; an eleven-capability admin gets four figures, the queue and six links; a suspended admin gets the banner, no figures and the escalation CTA; a member holding nothing gets `NoPermissionPanel` with **no** space name. **This proves the render path, not the SQL** — the rows came from a fake PostgREST, and no query in this phase has still ever run against a real Postgres. 05-16's seeded run is unchanged in scope.

## Session Continuity

Last session: 2026-08-03T10:15:00.000Z
Stopped at: Completed 05-15-PLAN.md — the notification composer whose send control is derived rather than stored, the read-only keyset-paged audit log, and the deduplication backlog four plans had been logging (wave 5 complete; 05-16 is the last plan)
Resume file: None
