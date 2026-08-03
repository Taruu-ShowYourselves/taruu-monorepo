---
phase: 05-space-governance-substrate-and-space-admin-operations-dashboard
plan: 07
subsystem: api
tags: [postgres, security-definer, k-anonymity, privacy, keyset-pagination, neverthrow, supabase, vitest]

# Dependency graph
requires:
  - phase: 05-01
    provides: the spaces table, space_audit_log, and the pre-typed space_admin_metrics signature in types.ts
  - phase: 05-04
    provides: branded SpaceScope, authorize(), and listAuditRows with its keyset predicate and actor embed
provides:
  - space_admin_metrics(UUID) — SECURITY DEFINER, nine fixed scalars, k-anonymity floor applied in SQL
  - fetchSpaceMetrics(scope) — the one call into that function, scope-keyed
  - getSpaceMetrics(session, rawSpaceId) — the metrics use-case 05-14 imports
  - listSpaceAudit(session, rawSpaceId, filter) — the audit use-case 05-15 imports
  - AuditListQuerySchema — the audit surface's query vocabulary (objectType, actor, cursor, limit)
  - GET /api/space-admin/[spaceId]/metrics and GET /api/space-admin/[spaceId]/audit
  - base64url cursor encoding over the repository's (created_at, id) keyset
affects: [05-14, 05-15, 05-16, issue-68]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A ratio is treated as a disclosure channel for its own numerator, so it is withheld when either side is below the k-anonymity floor"
    - "The database owns both halves of a figure — value and status — and the mapping publishes the value only when the status permits it, so the floor holds in two independent places"
    - "An internal keyset is wrapped in base64url at the use-case boundary, so the repository speaks columns and the client holds one opaque URL-safe token"
    - "Cursor validity is checked after authorization, so a malformed cursor can never distinguish an administered space from one that is not"

key-files:
  created:
    - supabase/migrations/20260802000004_space_admin_metrics.sql
    - apps/web/src/server/infra/supabase/space-metrics.repo.ts
    - apps/web/src/server/app/space-admin/get-metrics.ts
    - apps/web/src/server/app/space-admin/list-audit.ts
    - apps/web/src/app/api/space-admin/[spaceId]/metrics/route.ts
    - apps/web/src/app/api/space-admin/[spaceId]/audit/route.ts
    - apps/web/src/__tests__/api/space-admin-metrics.test.ts
    - apps/web/src/__tests__/api/space-admin-audit-read.test.ts
  modified: []

key-decisions:
  - "participation_rate_pct is withheld when the PARTICIPANT count is below the floor, not only when the resident count is — a published rate times a published denominator recovers a suppressed numerator"
  - "A withheld rate is 'unavailable', never 'suppressed' — the UI renders a suppressed figure as the literal `<5`, which on a percentage card would be a different and false claim"
  - "get-metrics.ts reads a figure's value only when its own status says 'available', so a future SQL edit that forgot to null a suppressed bucket leaks nothing through the API"
  - "The audit cursor is base64url of the repository's `${created_at}|${id}` keyset; the codec lives in the use-case, the repository is unchanged"
  - "A cursor that does not decode is a 400, checked AFTER authorize() so an unauthorized space still answers the identical opaque 403"
  - "Actor display names come from 05-04's PostgREST embed — one round trip — rather than the plan's second batched lookup, which would have been a redundant query and an app-layer Supabase client"

patterns-established:
  - "Pattern: a derived figure inherits the suppression of every input it is derived from, not just its denominator"
  - "Pattern: the phase's comment-versus-grep collision now has three more instances (RETURNS TABLE, `total`, the anon/authenticated grant) — all resolved by phrasing prose without the counted literal"

requirements-completed: [SPACE-07, SPACE-04]

# Metrics
duration: 12min
completed: 2026-08-03
---

# Phase 5 Plan 07: Aggregate-only metrics and the audit read Summary

**A `SECURITY DEFINER` function whose nine-scalar return type makes a per-resident row untypable at the database boundary, with the k-anonymity floor of five applied in SQL and extended to the participation rate so a published ratio cannot recover its own suppressed numerator — plus the audit log's cursor-paginated read, opaque token and all.**

## Performance

- **Duration:** 12 min (first commit 07:39:03Z → last 07:50:42Z)
- **Started:** 2026-08-03T07:38:11Z
- **Completed:** 2026-08-03T07:51:04Z
- **Tasks:** 3 (two of them TDD)
- **Files:** 8 created, 0 modified

## Accomplishments

- **SPACE-07 is structural, not procedural.** The RPC's return type is nine named scalars. There is no `jsonb`, no `SETOF`, no composite — so widening the surface to a resident row is a migration under review, not a one-line change to a `SELECT` list. `grep -c "RETURNS TABLE"` returns `1` and the block contains no composite type.
- **The floor is enforced twice, deliberately.** SQL nulls a bucket of 1–4 before the value leaves Postgres; `get-metrics.ts` then publishes a value only when its own status says `available`. A test proves the second layer by feeding a *hostile* row — a true `3` beside a `suppressed` status, which the shipped SQL never produces — and asserting the API still emits `{ value: null, status: 'suppressed' }`.
- **A leak the plan's SQL had was closed.** See the deviation below: the participation rate as specified would have disclosed a suppressed participant count to anyone who could also read the resident count.
- **A missing row is an answer, not a 500.** Four `unavailable` figures and a 200. A database *error* still fails, because a silently empty figure that actually means "the query broke" is indistinguishable from one that means "nobody has voted here yet".
- **The audit read pages by key with no row count**, and page two's recorded query is asserted to carry the exact `(created_at, id)` keyset predicate rather than an offset — with a no-overlap check across the two pages.
- **30 tests across two files**, all green, plus a `tsc --noEmit` that is clean for every file this plan owns.

## Task Commits

1. **Task 1: Aggregate-only metrics RPC with the suppression floor in SQL** — `42a1812` (feat)
2. **Task 2 RED: failing tests for both surfaces** — `589f5df` (test)
3. **Task 2 GREEN: repository, two use-cases, two routes** — `267ffe4` (feat)
4. **Task 3: contract allow-list, PII guard, keyset assertions** — `efaf85c` (test)

**Plan metadata:** `7ea8fc9` (docs) — this one is not clean, and it is the known shared-index race rather than a mistake: it carries **05-08's ROADMAP checkbox tick** alongside mine, because that sibling edited `.planning/ROADMAP.md` between my read and my commit. No content was lost and both ticks are correct; only the attribution is mixed. It was left rather than amended, because rewriting `HEAD` on a branch three agents are committing to is the hazard STATE.md's blockers section explicitly warns against. 05-16 owns attribution reconciliation.

All four **task** commits were audited with `git show --stat` and contain only this plan's files. Siblings 05-05, 05-06 and 05-08 committed into the same working tree between mine; every commit here used the path-scoped form `git commit -m "…" -- <paths>`.

## Files Created

| File | What it does |
| --- | --- |
| `supabase/migrations/20260802000004_space_admin_metrics.sql` | `space_admin_metrics(UUID)` — `LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''`, nine scalars, floor in SQL, `REVOKE ALL` then one `GRANT EXECUTE … TO service_role` |
| `apps/web/src/server/infra/supabase/space-metrics.repo.ts` | `fetchSpaceMetrics(scope)` → `SpaceMetricsRow \| null`. The space id comes off the scope; the raw route parameter never reaches the RPC |
| `apps/web/src/server/app/space-admin/get-metrics.ts` | `getSpaceMetrics(session, rawSpaceId)` — `metrics.read`, then the flat row folded into four `SpaceMetric` objects |
| `apps/web/src/server/app/space-admin/list-audit.ts` | `listSpaceAudit(session, rawSpaceId, filter)` and `AuditListQuerySchema`, plus the base64url cursor codec and the row mapping |
| `apps/web/src/app/api/space-admin/[spaceId]/metrics/route.ts` | Thin GET shell. No query vocabulary at all — a filter or a breakdown would be step one of a drill-down |
| `apps/web/src/app/api/space-admin/[spaceId]/audit/route.ts` | Thin GET shell, query parsed through `AuditListQuerySchema` |
| `apps/web/src/__tests__/api/space-admin-metrics.test.ts` | 14 cases |
| `apps/web/src/__tests__/api/space-admin-audit-read.test.ts` | 16 cases, against the **real** repository with only `supabaseAdmin` stubbed |

## For 05-14 and 05-15 — the names and the cursor

**Import the use-cases, never the repositories.**

| Use-case (import this) | Module | Repository it wraps (do not import) |
| --- | --- | --- |
| `getSpaceMetrics(session, rawSpaceId)` | `@/server/app/space-admin/get-metrics` | `fetchSpaceMetrics` in `@/server/infra/supabase/space-metrics.repo` |
| `listSpaceAudit(session, rawSpaceId, filter)` | `@/server/app/space-admin/list-audit` | `listAuditRows` in `@/server/infra/supabase/space-audit.repo` (05-04's) |

`AuditListQuerySchema` is exported from the same module and is the audit surface's whole query vocabulary:

```
?objectType=vote|grant|space|member|notification_campaign|content|escalation
?actor={uuid}
?cursor={base64url}
?limit=1..500        // served at most 100; over 100 sets truncated: true
```

**Cursor encoding — build the same links.** The repository pages on the keyset `${created_at}|${id}`. `list-audit.ts` wraps that in **base64url** (`Buffer.from(keyset,'utf8').toString('base64url')`) before it leaves the server and unwraps an incoming one the same way. So `nextCursor` matches `/^[A-Za-z0-9_-]+$/` and is safe to drop straight into a query string; still `encodeURIComponent` it, as the UI spec's linkable-filter rule requires the whole query to round-trip. Do **not** construct a cursor client-side — a value that does not decode back to something containing `|` is a 400.

The four UI filter chips (`הכול` · `הצעות` · `הרשאות` · `התראות`) map to no `objectType`, `vote`, `grant`, and `notification_campaign` respectively.

**Metrics status semantics, so the cards render honestly:**

| status | value | render |
| --- | --- | --- |
| `available` | a number, possibly `0` | the number — `0` means measured zero |
| `suppressed` | always `null` | `<5` + `מוסתר — קבוצה קטנה מדי` |
| `unavailable` | always `null` | `—` + `הנתון לא זמין` |

`participationRate` is the one figure that can be `unavailable` while its neighbours are `available`. That is not a bug — see the deviation below.

## Decisions Made

- **A ratio discloses its numerator.** With `registeredResidents` published and `participationRate` published, `rate × residents / 100` recovers the participant count to within rounding. For residents = 100 and participants = 3 the rate is literally `3`. So the rate is withheld whenever *either* side is below five, not only the denominator. This is the substantive change to the plan and it is a privacy fix, detailed under Deviations.
- **A withheld rate is `unavailable`, not `suppressed`.** The UI renders a suppressed figure as the literal `<5`. On a headcount card that is exactly right; on a percentage card it asserts "under five percent", which is a different and possibly false claim. The plan had already made this choice for the `residents < 5` branch; extending it keeps one rule, not two.
- **The mapping is the floor's second layer.** `figure(value, status)` publishes the value only when `status === 'available'`. Cheap, and it means a future migration that nulls the status but forgets the value leaks nothing through this API. The suppression test proves this layer specifically, by handing it a row the current SQL cannot produce.
- **A cursor is validated after authorization.** Ordering matters: `authorize()` first means an unauthorized space answers the identical opaque 403 whatever the cursor looks like, and only a caller who has already earned the scope can see a 400. A test pins both halves.
- **The audit `objectType` vocabulary is declared locally and annotated `satisfies readonly SpaceAuditRow['object_type'][]`.** The contract types the field a plain string, so nothing exports a runtime list. The annotation makes drift from the column's own CHECK union a compile error rather than a filter that silently matches nothing. Same reasoning 05-04 used for `AuditFilter.objectType`.
- **No public database role gets execute on the RPC.** Unlike `public_council_metrics`, this is an administrative surface reached only through the service role behind a capability check.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] The participation rate disclosed a suppressed participant count**

- **Found during:** Task 1
- **Issue:** The plan's SQL suppresses `active_participants_30d` when it falls in 1–4, but computes `participation_rate_pct` from the *true* participant count whenever `residents >= 5`. Since `registered_residents` is itself published at that point, the two together recover the suppressed value: residents = 100, participants = 3 gives a rate of `3`; residents = 8, participants = 2 gives `25`. For every small bucket the rounding band is narrow enough to pin the exact number. That defeats the plan's own stated truth — "A bucket of one to four residents is suppressed in SQL, so the true small number never reaches the client."
- **Fix:** Both the value and the status branch on `raw.residents < 5 OR raw.participants BETWEEN 1 AND 4`. The rate is `NULL` / `unavailable` when either side is below the floor. Six lines of comment in the migration explain why a ratio is a disclosure channel and why the status is `unavailable` rather than `suppressed`.
- **Files modified:** `supabase/migrations/20260802000004_space_admin_metrics.sql`
- **Verification:** `grep -c "BETWEEN 1 AND 4"` returns `6` (the criterion asks for at least `4`); the migration's `COMMENT ON FUNCTION` states the new behaviour; `pnpm --filter @sync/web typecheck` clean.
- **Committed in:** `42a1812` (Task 1 commit)

**2. [Documented] Three more comment-versus-grep collisions**

- **Found during:** Tasks 1 and 2
- **Issue:** The convention 05-04 generalised bit three more times. The plan's own migration header contains the phrase `RETURNS TABLE` in prose while the verification block asserts `grep -c "RETURNS TABLE"` returns `1`. The plan's instruction not to grant execute to public roles, written as a comment, would have tripped `! grep -qE "GRANT EXECUTE.*TO (anon|authenticated)"`. And the mandated comment explaining that the audit page carries no row count would have tripped `grep -c "total"` returning `0`.
- **Fix:** All three phrased without the counted literal — "a fixed return type of scalars", "no public-facing database role is given execute privilege here" on a line that does not contain the grant keywords, and "counting an append-only log … is expensive and stale" with the word itself never written. Meaning preserved in every case.
- **Verification:** `RETURNS TABLE` count `1`; the anon/authenticated grep finds nothing; `grep -c "total" list-audit.ts` returns `0`.
- **Committed in:** `42a1812` and `267ffe4`

### Deliberate departures

**`.in('id'` in `list-audit.ts` — not done, on purpose.** Task 2's criterion reads *"Actor display names are resolved with one batched query — `grep -q "\.in('id'" …/list-audit.ts` succeeds"*, and its action text says "resolving `actorDisplayName` with one batched user lookup over the page's distinct actor ids (never per row)".

The plan was written against the `listAuditRows` signature quoted in its own `<interfaces>` block, which returns bare `SpaceAuditRow[]`. **05-04 shipped something different:** its `listAuditRows` embeds `users(first_name, last_name)` through the `actor_user_id` foreign key and returns `AuditRowWithActor`, with the names already resolved. Satisfying the grep literally would mean:

1. a **second** round trip fetching names already in hand, and
2. the app layer opening its own Supabase client — `@/server/app/**` imports repositories, never `supabaseAdmin`, and neither `get-space-overview.ts` nor `list-proposals.ts` breaks that.

One query beats two, and the criterion's stated intent — *never per row* — is met more strongly by the embed than by the batch. `toAuditRow` carries a comment saying where the names come from so the absence is not read as an oversight. **If a later plan removes the embed, it must add the batched lookup in the repository, not here.**

The embed is one of the four PostgREST relationships 05-04 flagged as reviewed-but-never-executed; it is already on 05-16's checklist and this plan does not change that risk either way.

**`AUDIT_REQUEST_MAX = 500` on the query schema.** Above the repository's `AUDIT_PAGE_MAX = 100` deliberately, because the behaviour bullet requires `?limit=150` to be *served the cap and told it was capped* (`truncated: true`), not rejected. A schema ceiling of 100 would have turned that into a 400.

---

**Total deviations:** 1 auto-fixed (Rule 2, privacy), 1 documented pattern, 2 deliberate departures.
**Impact:** The privacy fix strengthens the plan's own headline guarantee and changes no interface. Nothing else moves scope.

## Issues Encountered

- **`pnpm --filter @sync/web typecheck` is red in this working tree, and none of it is this plan's.** Seven `TS2307` errors, all in `space-admin-content.test.ts` and `space-admin-members.test.ts` — sibling plans 05-05 and 05-06 landed their RED test files before their implementations, which is what a TDD red step looks like from outside. Filtering the compiler output to this plan's eight files returns nothing. This is transient wave-3 state, not a defect, and is deliberately **not** logged to `deferred-items.md`.
- **The migration has never touched a live Postgres.** Same standing condition as 05-01 through 05-04: no Docker, no `psql`. The SQL is reviewed, not executed. Three things in this file are consequently unproven — that the `WHERE EXISTS (SELECT 1 FROM s)` guard behaves as reasoned when the space is absent, that `SET search_path = ''` leaves nothing unqualified (every table reference is `public.`-prefixed and every function used is in `pg_catalog`), and that the `RETURNS TABLE` column list matches `types.ts` at runtime as well as it does on inspection. **Add `space_admin_metrics` to 05-16's apply-and-probe checklist**, specifically: call it for a real space, for a random uuid (expect zero rows), and for a space with a NULL `municipality_code` (expect zero rows).
- **`types.ts` was read and not written**, as 05-01 and this plan both require. Its `space_admin_metrics` entry matches the SQL's nine columns field for field and in order; `grep -q "space_admin_metrics" apps/web/src/lib/supabase/types.ts` succeeds. No `git diff` assertion was made against that file — 05-08 shares this wave and legitimately edits it.

## User Setup Required

None — no external service configuration required.

The migration ships unapplied, like every other Phase 5 migration. On a machine with Docker:

```bash
supabase db reset
psql "$SCRATCH_DATABASE_URL" -c "SELECT * FROM public.space_admin_metrics('00000000-0000-0000-0000-000000000000');"
```

A random uuid must return **zero rows**, not a row of zeroes. That single check is the whole point of the `WHERE EXISTS` guard.

## Verification Results

- `pnpm --filter @sync/web typecheck` — no error mentions any file this plan owns (see Issues Encountered for the sibling failures)
- `pnpm --filter @sync/web exec vitest run src/__tests__/api/space-admin-metrics.test.ts src/__tests__/api/space-admin-audit-read.test.ts` — **30 tests, 2 files, all passing**
- `grep -c "RETURNS TABLE"` → `1`; no `jsonb`, no `SETOF`, no composite in the block
- `grep -c "BETWEEN 1 AND 4"` → `6`
- `grep -q "WHERE EXISTS (SELECT 1 FROM s)"` → present
- `grep -q "SECURITY DEFINER"`, `grep -q "SET search_path = ''"` → both present
- `grep -qE "GRANT EXECUTE.*TO (anon|authenticated)"` → no match
- `grep -q "space_uuid: scope.spaceId"` in `space-metrics.repo.ts` → present
- `grep -q "export function getSpaceMetrics"` / `"export function listSpaceAudit"` → both present
- `grep -c "value: 0"` in `get-metrics.ts` → `0`
- `grep -c "total"` in `list-audit.ts` → `0`
- `grep -c "select('\*')"` in `space-metrics.repo.ts` → `0`
- Both routes `await params`; neither imports from `@/lib/supabase`

Deliberately **not** run: the full suite, `next build`, `prettier --check`. Three siblings are live in this tree; the phase's one full-suite run is 05-16's, alone in wave 6.

## Next Phase Readiness

**Ready for 05-14 and 05-15.** Both use-cases exist under the exact names those plans import, both return contract-shaped payloads validated strictly inside the tests, and the cursor encoding is documented above so the UI builds links the server will accept.

Carried forward:

- The migration is unapplied. 05-16 owns it; the three specific probes are listed under Issues Encountered.
- The actor embed remains 05-04's unexecuted PostgREST relationship. This plan depends on it and adds no second path to the same data.
- `deferred-items.md` gained nothing from this plan.

## Self-Check: PASSED

All eight created files verified present on disk. All four commits (`42a1812`, `589f5df`, `267ffe4`, `efaf85c`) resolve in `git log`. No file from another plan appears in any of them. `git status --short` shows no untracked file belonging to this plan.

The claims deliberately **not** verified are the migration's behaviour against a live Postgres and the actor embed's resolution — both stated as unproven above, and neither asserted anywhere in this document as executed.

---
*Phase: 05-space-governance-substrate-and-space-admin-operations-dashboard*
*Completed: 2026-08-03*
