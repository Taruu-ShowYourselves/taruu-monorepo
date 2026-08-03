---
phase: 05-space-governance-substrate-and-space-admin-operations-dashboard
plan: 16
subsystem: verification
tags: [playwright, postgrest, supabase, rsc, evidence, screenshots, e2e, security]

# Dependency graph
requires:
  - phase: 05-09
    provides: the notification send, whose preview-and-send equality this plan executes for the first time
  - phase: 05-10
    provides: the creation-fee port whose obligation row this plan observes being written
  - phase: 05-12
    provides: the overview surface (frames 01/02, 15)
  - phase: 05-13
    provides: the proposals surface and its deep link (frames 03/04, 13, 16a, 16b)
  - phase: 05-14
    provides: the members and statistics surfaces (frames 05-08)
  - phase: 05-15
    provides: the dispatch and audit surfaces (frames 09-12, 14)
provides:
  - apps/web/tests/e2e/space-admin.spec.ts — 22 assertion-guarded evidence frames at two widths
  - apps/web/tests/e2e/fixtures/space-admin-seed.sql — the idempotent local fixture the frames need
  - two Playwright viewport projects, 1440x900 and 390x844, scoped so the existing specs run once
  - 05-EVIDENCE.md — the phase's verification record, with an automated/manual/live split per requirement
  - the fix for three defects no unit test could see
affects: [issue-75, issue-68, PAY-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A PostgREST embed names its foreign key whenever the target table has more than one into the same relation"
    - "Values a Server Component reads live in a module with no 'use client' directive; only types may cross that line"
    - "An evidence frame asserts the state it depicts before it captures it"
    - "A seed fixture states which of its numbers are load-bearing, because the frames break silently when they change"

key-files:
  created:
    - apps/web/tests/e2e/space-admin.spec.ts
    - apps/web/tests/e2e/fixtures/space-admin-seed.sql
    - apps/web/src/app/[locale]/space-admin/[spaceId]/proposals/filters.ts
    - apps/web/src/app/[locale]/space-admin/[spaceId]/audit/filters.ts
    - .planning/phases/05-space-governance-substrate-and-space-admin-operations-dashboard/05-EVIDENCE.md
    - apps/web/tests/e2e/__screenshots__/space-admin/ (22 PNGs)
  modified:
    - apps/web/src/server/infra/supabase/space.repo.ts
    - apps/web/src/server/infra/supabase/space-decision.repo.ts
    - apps/web/src/app/[locale]/space-admin/[spaceId]/proposals/page.tsx
    - apps/web/src/app/[locale]/space-admin/[spaceId]/proposals/ProposalsClient.tsx
    - apps/web/src/app/[locale]/space-admin/[spaceId]/audit/page.tsx
    - apps/web/src/app/[locale]/space-admin/[spaceId]/audit/AuditClient.tsx
    - apps/web/playwright.config.ts

key-decisions:
  - "Both proposal reads name votes_creator_id_fkey — this phase's own moderation migration gave votes three FKs into users and made the unqualified embed a PGRST201"
  - "The two surfaces' filter vocabularies moved into directive-free modules; a Server Component reading a client module gets a reference, not the value"
  - "Screenshots are full-page and unmodified, at the cost of 26 MB, because three frames must show content below the fold at 900px"
  - "The third token-hygiene grep is reported as NOT literally met rather than satisfied by rewording four completed plans' comments"
  - "No milestone lifecycle step was run, and REQUIREMENTS.md is untouched — the blocking checkpoint has no verdict"

patterns-established:
  - "Pattern: a phase that adds PostgREST queries or Server Components needs one live pass before it can claim to work; vitest with environment 'node' and mocked Supabase structurally cannot see either failure class"

requirements-completed: []

# Metrics
duration: 190min
completed: 2026-08-03
---

# Phase 5 Plan 16: Evidence and verification Summary

**The first time anything in this phase met a browser or a real query — which
found that the proposal queue, the proposal detail panel and the audit surface
were all broken in production shapes that `tsc` and 987 green tests could not
see, and then produced the 22 frames, the four transcripts and the requirement
map that issue #75 asks for.**

> **STATUS: TASKS 1 AND 2 COMPLETE. TASK 3 IS A BLOCKING CHECKPOINT WITH NO
> VERDICT.** Nothing in this document or in `05-EVIDENCE.md` is a sign-off. The
> plan is not finished, `REQUIREMENTS.md` is untouched, no requirement was
> ticked, and no milestone lifecycle step was run. What a human is being asked
> to look at is in `05-EVIDENCE.md` §8 and repeated at the end of this summary.

## Performance

- **Duration:** ~190 min wall clock, including one stall and a restart
- **Tasks:** 2 of 3 complete; task 3 is the blocking human-verify checkpoint
- **Files:** 6 created, 7 modified, 22 screenshots
- **Commits:** 5, all path-scoped, all audited with `git show --stat`

## Task Commits

1. **PostgREST embed fix** — `f28b8b1` (fix)
2. **Server/client module boundary fix** — `5591507` (fix)
3. **Task 1: the spec, the fixture, the two viewport projects** — `5081fa1` (test)
4. **The 22 frames as captured** — `d2f638b` (docs)
5. **Task 2: `05-EVIDENCE.md`** — `fb5359e` (docs)

Each was audited; none carries a file belonging to another plan. The two fixes
are deliberately separate commits from the harness, because the diagnosis in
their messages is the most reusable thing this plan produced.

## The three defects

This is the part worth reading. All three were invisible to `tsc` and to the
987-test suite, and two of them broke whole surfaces.

### 1. The proposal queue and detail panel answered 500

`space.repo.ts:listProposals` and `space-decision.repo.ts:findProposalInScope`
embedded the submitter as `users(first_name, last_name)`. That was correct when
05-04 and 05-05 wrote it. **This phase's own `20260802000003` broke it** by
adding `hidden_by` and `flagged_by`, giving `votes` three foreign keys into
`users`, and PostgREST refuses to guess:

```
{"code":"PGRST201","message":"Could not embed because more than one relationship
 was found for 'votes' and 'users'"}
```

Fixed by naming the constraint, which keeps the response key `users` so both
mappers are unchanged. Swept rather than patched once: only `votes`,
`space_capability_grants` and `space_member_suspensions` have more than one FK
into `users`, and the latter two are never embedded. `space-audit.repo.ts`'s
actor embed resolves through a single FK and is correct as written.

### 2. The proposals and audit surfaces were broken in every state but one

Both Server Component pages imported non-component values from a `'use client'`
module, so React handed them client references rather than values.

The audit page **threw** (`Attempted to call isAuditFilter() from the server`)
and rendered nothing. The proposals page **failed quietly**, which is worse:
`isFilter()` threw on any explicit `?status=`, and with no query string
`DEFAULT_PROPOSAL_FILTER` arrived as a reference, became a malformed predicate,
and rendered the generic `ErrorPanel` on the surface's own default view. Only
`?proposal={id}` worked, because it is the one branch that uses only literals.

Fixed with a `filters.ts` beside each surface carrying no directive. Types stayed
where they were — they are erased before either side runs.

### 3. Neither is catchable by this repo's tests, and that is the finding

`apps/web/vitest.config.ts` sets `environment: 'node'`, every space-admin test
mocks `@/lib/supabase/server`, and there is no React harness at all. A query's
PostgREST shape is never evaluated and no test renders a Server Component. Both
defects therefore compile, typecheck and pass 987 tests while being completely
broken in a browser.

Every earlier plan said plainly that its queries were reviewed rather than
executed, and six of them left an explicit checklist for this one. They were
right to. The conclusion to carry forward is in `05-EVIDENCE.md` §2.3: a phase
that adds PostgREST queries or Server Components needs one live pass before it
can claim to work, and the committed spec plus fixture is now that pass.

## What was proven, live

Full transcripts in `05-EVIDENCE.md` §3 and §4. In brief:

- **SPACE-03.** 45 probes — every space-admin endpoint × unauthorized /
  nonexistent / malformed — produce exactly **one distinct response line**,
  `403 {"error":"Forbidden","code":"FORBIDDEN"}`, 40 bytes, SHA-256 identical
  across the three cases. The control against the administered space is 200.
- **SPACE-08, executed for the first time.** Preview → 4 approved / 0 opted-out /
  2 no-channel; send → 4 delivered; the database then shows `audience_size 4`,
  four `in_app`/`delivered` rows, four inbox rows, and
  `delivered_equals_previewed = t` computed in SQL. Quota moved 1→2 of 8 and is
  counted from campaign rows. A second send of the same campaign lost with
  `409 ההתראה כבר נשלחה.`
- **The zero-row conditional UPDATE, which 05-06 and 05-09 both flagged as first
  priority.** Every 409 on the dashboard rests on it. Approve twice, suspend
  twice, reinstate twice — each second attempt is a real 409 with the
  repository's own Hebrew sentence, not a silent 200.
- **SPACE-05's determinism.** An approval published `in_review → active`, wrote
  exactly one `proposal.approved` row carrying prior state, new state, the
  payment id and the reason, and recorded a `pending` ₪50 obligation against the
  **submitter** with SEC-04's key ordering. Self-review was refused server-side.
- **SPACE-04's immutability, extended past 05-DB-EVIDENCE's superuser run** to
  the roles the application actually uses: `service_role` is refused UPDATE and
  DELETE at the grant layer with `42501`; `anon` and `authenticated` match zero
  rows because RLS is enabled with no policies; the trigger refuses regardless.
  Three independent layers.
- **The disabled confirm, measured in four states.** Disabled and
  disabled-hovered are byte-identical paper-2 on ink-faint; enabled is ink;
  enabled-hovered is red-dark. D17, D27 and D23 all landed, with no `opacity`.

## Criteria not met, stated plainly

**The third token-hygiene grep does not return nothing.** It returns four hits,
all of them prose inside `.tsx` comments — `19.2px`, `768px` twice, `13.3px` —
and none of them mine; all four were written by 05-11 and 05-15 to explain the
very rules the grep enforces. This is the phase's comment-versus-grep collision
for the seventh time.

The property the criterion protects does hold, and `05-EVIDENCE.md` §5.1 carries
the declaration-scoped scan that measures it: **zero** pixel literals in any
declaration across the phase's stylesheets, and all seventeen `px` occurrences in
CSS are media-query breakpoints, the single permitted case.

I chose not to reword the four comments. It would mean editing four completed
plans' files for a cosmetic reason, and an accurate "not literally met, and here
is why it does not matter" is worth more to whoever reads this next than a
satisfied grep.

**One further item the plan asked for and did not get:** the human verdict. See
below.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — Bug, and Rule 3 — Blocking] The ambiguous PostgREST embeds**

- **Found during:** Task 1, on the first request to a seeded surface.
- **Issue:** `PGRST201` on both proposal reads; `GET /api/space-admin/{id}` and
  `…/proposals` answered 500, which blocked every frame.
- **Fix:** named `votes_creator_id_fkey` on both embeds, with the diagnosis in a
  comment at each site. Swept the whole class before committing.
- **Verification:** both endpoints 200 with real rows; root `pnpm typecheck`
  green; 987 tests unchanged — checked that no test asserted the old select
  string (three `users(first_name` matches remain, all correct or unrelated).
- **Committed in:** `f28b8b1`

**2. [Rule 1 — Bug, and Rule 3 — Blocking] Server Components reading client modules**

- **Found during:** Task 1, on the proposals and audit frames.
- **Issue:** the audit surface threw; the proposals surface rendered `ErrorPanel`
  on its default view. Details above.
- **Fix:** `filters.ts` beside each surface, with no directive.
- **Verification:** `/proposals`, `/proposals?status=…`, `/audit` and
  `/audit?objectType=…` all render tables; root typecheck green; 987 tests
  unchanged. Checked that only four files referenced the moved symbols and that
  no test does.
- **Committed in:** `5591507`

### Corrections to the plan's own assertions

- **The plan's frame-13 assertion named the wrong control.** It says to assert on
  `אישור ופרסום`; that is the *row trigger*. The dialog's confirm carries the
  action verb `אשרו ופרסמו`, per the copy deck's own rule that a confirm is never
  a noun phrase and never a bare `אישור`. The spec asserts the real label.
- **The plan asks for "sixteen screenshots at both widths".** The UI-SPEC numbers
  the six surfaces as desktop/mobile pairs (1-2, 3-4, …) and the five states as
  singles, so "sixteen frames at two widths" resolves to **22 files**: twelve
  paired plus five states × two viewports. All 22 are on disk and all 22 tests
  pass.

### Deliberate departures

- **`webServer` is skipped when `PLAYWRIGHT_BASE_URL` is set.** The evidence run
  points at a seeded instance on its own port, and the existing config would
  otherwise start or adopt a `pnpm dev` on 3000 — which on this machine is a
  different repository's dev server.
- **The default `chromium` project ignores this spec** and the two viewport
  projects match only it, so the four existing e2e specs still run exactly once.
- **The spec pre-sets `taruu.municipality`.** The site-wide `GeoGate` modal is
  rendered by `[locale]/layout.tsx`, sits over the console, and would intercept
  every click and appear in every frame. Storing a locality is the ordinary state
  of a returning reader, so this reproduces a normal condition rather than
  suppressing a component. Recorded in `05-EVIDENCE.md` §6.2 along with why the
  session cookie alone does not close it.
- **Screenshots are full-page and unmodified**, at 26 MB. A lossless
  recompression pass was measured and made them *larger*; quantizing would alter
  evidence whose colour is part of what it proves. Full-page rather than clipped
  because three frames must show content below the fold at 900px. The repo-weight
  question is flagged in the commit message for whoever owns it.

## Issues encountered

- **A stall mid-plan.** The Playwright config and spec were being written when the
  session stalled; work resumed from the on-disk state with nothing lost.
- **The frames were captured three times.** Once before the two fixes (8 failures,
  which is how both defects surfaced), once after (4 failures, from two of my own
  assertion mistakes), and once after the live mutation probes so the committed
  frames correspond to the database a reviewer will find. All 22 reproduce.
- **A local grant-profile question, logged not fixed.** `anon` and
  `authenticated` currently hold `DELETE,INSERT,SELECT,UPDATE` on
  `space_audit_log` in this stack, although `20260802000001` revokes exactly
  those — most likely the local bootstrap re-applying default privileges after
  the migrations. It changes nothing here (RLS hides every row from them, and the
  trigger refuses regardless), but **the same profile should be checked on the
  hosted project**, because the migration's second mechanism is not currently in
  effect locally. Patching it from inside this plan would risk hiding a real
  production question behind a local fix.
- **`supabase/seed.sql` is broken and was not touched.** It violates
  `users_municipality_fk` from `20260728000001`, so local bootstrap has been
  broken since that migration, independent of issue #75. Recorded in
  `05-EVIDENCE.md` §2.4; it belongs in its own change.

## User Setup Required

To reproduce the evidence run: a local Supabase with the migrations applied and
seeding disabled, `apps/web/tests/e2e/fixtures/space-admin-seed.sql` applied,
`apps/web/.env.local` pointed at it, and `next dev`. Then

```bash
SPACE_ADMIN_E2E_JWT_SECRET=<the app's JWT_SECRET> \
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3999 \
pnpm --filter @sync/web exec playwright test tests/e2e/space-admin.spec.ts
```

Without the secret or a seeded space the spec skips with a message, so
`pnpm --filter @sync/web test:e2e` stays green on a machine with no Supabase.

## What the phase still needs — the blocking checkpoint

**A human has to walk the surface.** `05-EVIDENCE.md` §8 has the URLs, both
accounts and the ten numbered steps. Two of them are the reason this checkpoint
exists, because nothing automated in this run covers them:

- **Step 4 — the disabled confirm.** Its colours are measured and pass (§6.1).
  What a person still has to judge is whether it *reads* as disabled, and whether
  hovering it feels inert.
- **Step 6 — staleness on change, not on blur.** Compute an audience, then change
  one character in the body: the send must disable **before** you click away, and
  the stale banner must appear. 05-15 argued this from the code and said plainly
  that it was argued, not observed. The frames capture the fresh state, not the
  transition. **This is the single least-verified behaviour in the phase.**

The verdict goes at the end of `05-EVIDENCE.md`, which currently reads
`Status: awaiting review.`

## Self-Check: PASSED

All six created files and all seven modified files verified present on disk; 22
PNGs present under `apps/web/tests/e2e/__screenshots__/space-admin/`. All five
commits (`f28b8b1`, `5591507`, `5081fa1`, `d2f638b`, `fb5359e`) resolve in
`git log`, and `git show --stat` on each shows only this plan's files.

Every number quoted above was read from a command's output in this run, not
recalled: 987/74 web tests, 125/10 api-client tests, 8/8 typecheck tasks, 0 lint
errors with 2 pre-existing warnings, 22/22 Playwright tests, 45 denial probes
with one distinct response line, 105 audit rows, 4 delivered of 4 previewed.

Claims deliberately **not** made: that the plan is complete, that any requirement
is satisfied, that a human has verified anything, or that any of this ran against
production. The checkpoint is open.

---
*Phase: 05-space-governance-substrate-and-space-admin-operations-dashboard*
*Tasks 1–2 completed: 2026-08-03 · Task 3 awaiting a human verdict*
