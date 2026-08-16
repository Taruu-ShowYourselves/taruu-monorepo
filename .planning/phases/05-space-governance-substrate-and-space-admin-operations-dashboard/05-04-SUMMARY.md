---
phase: 05-space-governance-substrate-and-space-admin-operations-dashboard
plan: 04
subsystem: api
tags: [authorization, typescript, branded-types, neverthrow, supabase, vitest, security]

# Dependency graph
requires:
  - phase: 05-01
    provides: spaces / space_capability_grants / space_audit_log tables, their indexes, and the TypeScript row types
  - phase: 05-02
    provides: the eleven-capability vocabulary, REVIEW_VOTE_STATUSES, isSpaceAdminEnabled(), and the shared contract surface
provides:
  - branded SpaceScope, mintable in exactly one module and required by every space-scoped repository function
  - SpaceMembership, the weaker shell-level token that renders the dashboard without conferring data access
  - authorize() and resolveMembership() — every denial path returns one identical opaque 403
  - space.repo.ts — findActiveGrant, findGrantsForUser, findSpaceSummary, findSpaceSummaryByMembership, listProposals, countProposalsAwaitingDecision
  - space-audit.repo.ts — insertAuditRow and listAuditRows, with no update and no delete export
  - GET /api/space-admin/[spaceId] and GET /api/space-admin/[spaceId]/proposals
  - apps/web/src/__tests__/fixtures/space.ts — shared fixtures for the phase's ten space-admin test files
  - a vitest alias that makes `import 'server-only'` safe in a node test environment
affects: [05-05, 05-06, 05-07, 05-08, 05-09, 05-10, 05-12, 05-16, issue-68, issue-74]

# Tech tracking
tech-stack:
  added:
    - "server-only@0.0.1 (apps/web) — the marker package was previously reachable only transitively via expo-router"
  patterns:
    - "Phantom-typed capability token minted in one module; the data layer takes the token, never a caller-supplied id"
    - "A weaker second token (SpaceMembership) rather than a downcast, when a surface needs less authority than a capability"
    - "Two public entry points funnelling into one module-private query, so a hand-written column list exists once"
    - "FORBIDDEN folded to null at the use-case layer, so an unauthorized widget is absent from the payload rather than failing the page"

key-files:
  created:
    - apps/web/src/server/app/space-admin/authorize.ts
    - apps/web/src/server/app/space-admin/get-space-overview.ts
    - apps/web/src/server/app/space-admin/list-proposals.ts
    - apps/web/src/server/infra/supabase/space.repo.ts
    - apps/web/src/server/infra/supabase/space-audit.repo.ts
    - apps/web/src/app/api/space-admin/[spaceId]/route.ts
    - apps/web/src/app/api/space-admin/[spaceId]/proposals/route.ts
    - apps/web/src/__tests__/fixtures/space.ts
    - apps/web/src/__tests__/stubs/server-only.ts
    - apps/web/src/__tests__/api/space-admin-object-authz.test.ts
    - apps/web/src/__tests__/api/space-admin-capability-matrix.test.ts
    - apps/web/src/__tests__/api/space-admin-suspension.test.ts
  modified:
    - apps/web/vitest.config.ts
    - apps/web/package.json

key-decisions:
  - "Branded SpaceScope confirmed at the go/no-go checkpoint — commit-scope selected over fallback-assert"
  - "SpaceScope.municipalityCode is non-nullable and a grant whose space has none is refused, which removed every cast at every query site"
  - "SpaceMembership is a second token rather than a downcast from SpaceScope, so shell authority cannot reach a capability-gated function"
  - "SpaceScope.capability is carried but read by no repository — the brand stops raw strings, not wrong-capability scopes"
  - "A malformed uuid short-circuits before the database and returns the same body as an unauthorized real space"

patterns-established:
  - "Pattern: when a mandated comment must name a token a mechanical grep counts, phrase the prose without the literal — a count assertion cannot tell prose from code"
  - "Pattern: repository modules that must never mutate express it by exporting no such function, with the enforceable half in the database"

requirements-completed: []

# Metrics
duration: 11min
completed: 2026-08-03
---

# Phase 5 Plan 04: Object-level authorization and the first two use-cases Summary

**A phantom-typed `SpaceScope` minted in exactly one module and required as parameter one of every space-scoped query, so a caller-supplied `spaceId` is `error TS2345` at the data layer rather than a code-review item — proven on two shipped endpoints and 52 tests before the rest of the phase commits to it.**

## Performance

- **Duration:** 11 min (first commit 09:38:43Z → last 09:49:15Z), plus the checkpoint wait
- **Tasks:** 4 (one TDD pair, one blocking checkpoint)
- **Files:** 14 (12 created, 2 modified)

## Accomplishments

- **SPACE-03 is structural.** `listProposals('raw-space-id', {})` does not compile. The exact compiler text is recorded below; it is the phase's evidence that cross-space isolation is a type property and not a convention, which matters because RLS secures none of this surface — every server query runs as the Supabase service role, which has `BYPASSRLS`.
- **Every denial is byte-identical.** Malformed uuid, unknown space, no grant, wrong capability, suspended grant and a space with a null `municipality_code` all return `{ error: 'Forbidden', code: 'FORBIDDEN' }` with status 403. One test asserts the two responses match with `toBe` on the raw body text, not just on shape.
- **Suspension bites on the next request and erases nothing.** The suspension test flips `suspended_at` with the same session, the same cookie and no refresh, and shows 200 → 403 plus the suspended admin's audit history still readable in the same test.
- **Default deny is table-driven.** 22 rows over all eleven capabilities against both shipped endpoints; only `proposal.read` opens the queue. A grant stamped `granted_via_role: 'space_admin'` that actually carries `metrics.read` is still 403.
- **Two use-cases exist to make the ergonomics question answerable**, which was the point of stopping here rather than after one.

## Task Commits

1. **Task 1: SpaceScope brand, resolver, two repositories** — `e6fbf1b` (feat)
2. **Task 2 RED: object-authz tests + shared fixtures** — `bf732e3` (test)
3. **Task 2 GREEN: two use-cases, two routes** — `14bc5a9` (feat)
4. **Task 3: capability-matrix and suspension tests** — `c2077ba` (test)
5. **Grep-audit comment fix** — `78c0c0e` (docs)

All five commits were audited with `git show --stat` and contain only this plan's files. Plans 05-03 and 05-11 committed into the same working tree between mine; commits from here on used path-scoped `git commit -m "…" -- <paths>`.

## The ergonomics verdict — `commit-scope`

**Decision: keep the branded `SpaceScope`.** Selected by the user at the Task 4 checkpoint.

**Rationale as recorded at the checkpoint:** Evidence 4 below is the deciding argument. A raw id at the data layer is `error TS2345` today, and `fallback-assert` would trade that compile error for a convention while not reducing the cost actually measured — the multi-capability overview needs the same per-widget checks under either option. SPACE-03 is the phase's headline criterion and six plans are about to be written against this, so structure beats discipline.

### Evidence 4 — the compiler error

Scratch file calling `listProposals('raw-space-id', {})`, typechecked and then deleted:

```
src/server/app/space-admin/__scratch-raw-id.ts(5,44): error TS2345:
Argument of type 'string' is not assignable to parameter of type 'SpaceScope'.
```

### What the two use-cases actually cost

`listSpaceProposals` — **one line** of authorization ceremony for a single-capability endpoint:

```ts
export function listSpaceProposals(
  session: Session, rawSpaceId: string, filter: ProposalFilter
): ResultAsync<ProposalListResponse, AppError> {
  return authorize(session, rawSpaceId, 'proposal.read').andThen((scope) =>
    listProposals(scope, filter).map((rows) => ({
      proposals: rows.map((row) => toProposalSummary(row, scope.userId)),
    }))
  );
}
```

`getSpaceOverview` is the counter-example: a surface mixing capabilities needed a second token *and* a five-line `optional()` fold, roughly 15 lines of scaffolding before the first widget.

**Repository signatures cost nothing.** `(scope: SpaceScope, filter: X)` has the same arity as `(spaceId: string, filter: X)`, and the caller had to obtain the scope anyway. The dozen further scope-taking functions in 05-05 through 05-09 add no per-function tax. The measured cost lands in the use-case layer, and it is a consequence of widget-level capability (Interaction Contract 1 Rule A), not of the brand.

**No escape hatch leaked.** Outside `__tests__` the brand-audit grep matches exactly one line, the `mintScope` cast inside `authorize.ts`:

```
$ grep -rn "as unknown as SpaceScope" apps/web/src --include=*.ts
apps/web/src/server/app/space-admin/authorize.ts:88:}): SpaceScope => fields as unknown as SpaceScope;
apps/web/src/__tests__/fixtures/space.ts:71:  } as unknown as SpaceScope;
```

**A Server Component composes with no second mechanism.** A scratch RSC calling `getSessionFromCookies()` → `getSpaceOverview(session, spaceId)` → `result.isErr()` typechecks against the same use-case the route uses. The only difference from the route is the session accessor.

## The limit of the guarantee — read this before reusing the substrate

**`SpaceScope` carries a `capability` field, but no repository reads it.**

The brand makes a caller-supplied `spaceId` string untypable at the data layer. It does **not** make a scope minted for `metrics.read` unusable by a repository that ought to require `proposal.approve` — such a call is structurally accepted and compiles cleanly. Capability correctness lives entirely in each use-case's `authorize(…, capability)` argument, and is proven by the capability-matrix test, not by the type system.

This is harmless in this plan because both use-cases pass the right capability and the matrix covers every endpoint. It stops being harmless the moment a surface has more repositories than matrix rows. **Issue #68 must not inherit a guarantee that is not there:** if it needs wrong-capability scopes to be a compile error too, that is a per-capability brand (`SpaceScope<'proposal.approve'>`), which is a different and larger design than the one shipped here.

## The two-token cost, and where it lands

The design needed a second token before the second use-case was finished.

`SpaceMembership` exists because reaching the dashboard shell is *membership* — holding at least one grant — and 05-02 deliberately refused a twelfth `space.read` capability. The alternatives were both worse: a twelfth capability contradicts the eleven-row UI manifest, and casting a membership to a `SpaceScope` would let shell-level authority reach a function that is supposed to require a capability, which is exactly what the brand exists to prevent.

The concrete cost is visible in `space.repo.ts`:

```ts
const selectSpaceRow = (spaceId: string) => /* the one hand-written column list */;   // private
export const findSpaceSummary = (scope: SpaceScope) => selectSpaceRow(scope.spaceId);
export const findSpaceSummaryByMembership = (m: SpaceMembership) => selectSpaceRow(m.spaceId);
```

Two public entry points, one query, one column list. **Each weaker notion of authority needs its own repository entry points.** A third notion — a platform-admin token for #68, say — repeats this shape. That is the honest scaling cost of the design, and it is worth knowing before adding one.

`selectSpaceRow` is module-private on purpose. Its `spaceId: string` parameter is not a hole: nothing outside the module can reach it, so a caller-supplied string still cannot arrive at the data layer.

## For downstream plans

**Extract `optional()` on first reuse — do not copy it a third time.** `getSpaceOverview` defines a five-line helper that folds a `FORBIDDEN` into `null` so an unauthorized widget is absent from the payload rather than failing the page:

```ts
const optional = <T>(result: ResultAsync<T, AppError>): ResultAsync<T | null, AppError> =>
  result.orElse((error) =>
    error.kind === 'FORBIDDEN' ? okAsync<T | null, AppError>(null) : errAsync(error)
  );
```

**05-06** (members) and **05-07** (metrics) both render multi-widget surfaces under Rule A and will want exactly this. Whichever of them lands first should move it to a shared module — `server/app/space-admin/widget.ts` is the obvious home — and update `get-space-overview.ts` to import it. It was left inline here deliberately: extracting a helper for callers that do not yet exist is speculative, and this plan had no mandate to create a shared module. Note the fold is `FORBIDDEN`-only on purpose; a DB failure must still fail the page, because a silently empty figure is indistinguishable from a measured zero.

**Import, do not re-derive:** the eleven capabilities from `server/domain/space/capability.ts`, the review statuses from `server/domain/space/review.ts`, every request/response shape from `packages/shared/src/contracts/spaceAdmin.ts`, and the space fixtures from `src/__tests__/fixtures/space.ts`.

**The proposals filter vocabulary** is `PROPOSAL_FILTER_STATUSES` in `list-proposals.ts` — the four review states plus `active`, derived from `REVIEW_VOTE_STATUSES` so a new review state cannot become filterable without being reviewable.

## Convention: mandated comments versus mechanical greps

**Three plans in this phase have now hit the same collision, so it is a pattern and not an incident:** 05-01 with `AFTER`, 05-02 with `space.read`, and this plan with the brand-audit string. In each case a plan required both a comment explaining why some token is absent *and* a grep asserting that token's count is zero or one. Both cannot hold, because **a count assertion cannot distinguish prose from code.**

For plans 05-05 onward, when a mandated comment must discuss a token a mechanical grep counts, do one of:

1. **Phrase the prose so it does not contain the literal.** What this plan did — "a grep for that cast" instead of quoting the cast. Cheapest, and keeps the criterion a one-liner.
2. **Scope the grep to exclude comment lines**, e.g. `grep -vE '^\s*(\*|//)'` before counting.

Prefer (1) when the comment can carry its meaning without the token, and (2) when naming the token is genuinely load-bearing. Either way, decide it while writing the plan rather than discovering it at verification.

## Decisions Made

- **`SpaceScope.municipalityCode` is `string`, not `string | null`, and `authorize()` refuses a grant whose space has none.** Issue #74's non-municipal space types are already legal in the `spaces.type` CHECK, so a null code is reachable rather than theoretical, and every scoped query in the phase filters `.eq('municipality_id', scope.municipalityCode)`. A nullable field would turn each of those into `.eq(col, null)` — matching nothing, silently, with no error. Refusing at the door removed every cast at every query site: `grep -rn "municipalityCode as string"` returns 0. `SpaceMembership.municipalityCode` stays nullable, because a membership never keys a query and a non-municipal space must still render its shell and escalation path.
- **`SpaceMembership` is a second token, not a downcast.** See "The two-token cost" above.
- **Two public entry points over one private `selectSpaceRow`**, so the hand-written column list exists exactly once. No `select('*')` anywhere in the three new data modules.
- **`space-audit.repo.ts` exports no `update*` and no `delete*`.** That absence is the CI-checkable half of append-only; the enforceable half is 05-01's trigger plus REVOKE plus `ON DELETE RESTRICT`, still unproven against a live Postgres.
- **The overview folds a missing capability to `null`, never `0`.** A fabricated zero is indistinguishable from a measured one, which is the same reasoning `SpaceMetricSchema` already encodes with its `available | suppressed | unavailable` status.
- **The kill switch denies rather than 404s.** `isSpaceAdminEnabled() === false` returns `forbidden()` for the same non-disclosure reason as every other path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `server-only` was not resolvable from `apps/web`**

- **Found during:** Task 1, before writing any code
- **Issue:** The plan mandates `import 'server-only';` as the first line of three modules, with an automated verify. The package existed in the pnpm store only as a transitive dependency of `expo-router`, was absent from `apps/web/node_modules`, and `require.resolve` from `apps/web` failed. Both `tsc` and the Next build would have failed on the import.
- **Fix:** Added `"server-only": "0.0.1"` to `apps/web/package.json` and ran `pnpm install --prefer-offline --filter @sync/web`.
- **Correction to a claim made mid-execution:** it was suggested that this was a pre-existing repo bug because `apps/web/src/services/auth/index.ts` already imported `server-only`. **It does not.** That file contains only a comment mentioning the phrase (`// … session functions use cookies() which is server-only`), and `grep -rn "^import 'server-only'" apps/web/src` returned no real imports anywhere before this plan. This plan is the first consumer; the missing dependency was latent, not active. Recorded because the inaccurate version would send someone hunting a bug that is not there.
- **Attribution note:** `apps/web/package.json` and `pnpm-lock.yaml` are in **05-11's** `files_modified`, not this plan's. 05-11 concurrently added `@radix-ui/react-alert-dialog` to the same file; both entries are present and both resolve. The two files were swept into **05-03's commit `5979545`** by the shared-index problem. Content is correct; the attribution is not this plan's to fix.

**2. [Rule 3 - Blocking] `server-only` aborts every test that loads a server module**

- **Found during:** Task 1
- **Issue:** The package's default entry is a bare `throw` — that is its whole purpose. Next swaps it for an empty module through the `react-server` export condition; Vitest runs plain Node and does not apply that condition, so all 52 tests would have died on import.
- **Fix:** `apps/web/src/__tests__/stubs/server-only.ts` plus a `resolve.alias` entry in `apps/web/vitest.config.ts`. Vite's alias matcher is exact-or-prefix-with-slash, so the key cannot capture an unrelated package.
- **Contention check:** `vitest.config.ts` appears in no plan's `files_modified` in this phase, so the edit was uncontended. It benefits every downstream space-admin test file, which is why it was fixed centrally rather than with a `vi.mock` in each.

**3. [Rule 2 - Missing functionality] `listProposals` embeds the submitter's name**

- **Found during:** Task 2
- **Issue:** The plan's select list omits any join to `users`, but `ProposalSummarySchema` requires `submitterDisplayName` and Surface 2 has a `מגיש/ה` column. Shipping the plan's literal list would have meant an empty column.
- **Fix:** Added `users(first_name, last_name)` to the embed and a `displayName` helper with the Hebrew fallback `תושב/ת`. The FK `votes.creator_id → users(id)` exists in the initial schema, so the embed resolves unambiguously.

**4. [Rule 1 - Bug] `AuditFilter.objectType` typed `string` did not compile**

- **Found during:** Task 1
- **Issue:** The plan specifies `objectType?: string`, but `space_audit_log.object_type` is a seven-member union in `types.ts`, so `.eq('object_type', filter.objectType)` failed with TS2345.
- **Fix:** Typed it `SpaceAuditRow['object_type']`. Strictly better than the plan: the DB CHECK rejects anything else, so a typo is now a compile error rather than a query that silently matches nothing.

**5. [Rule 1 - Bug] The shared query-builder stub returned a non-promise from `then`**

- **Found during:** Task 2 GREEN
- **Issue:** The stub was lifted from `treasury-transaction-scoping.test.ts`, where the code under test does `await builder`. The space repositories instead call `.then(mapper)` and hand the return value to `ResultAsync.fromPromise`, which needs a thenable — so both SQL-predicate tests failed with `promise.then is not a function`.
- **Fix:** `builder.then` now returns `Promise.resolve(result).then(resolve, reject)`, which satisfies both call styles.

**6. [Documented] Three comment-versus-grep collisions**

- **Found during:** Tasks 1 and 4
- **Issue:** `grep -c "notFound("` and the star-select grep each matched my own explanatory comments, and the brand-audit grep matched the `mintScope` doc comment that quoted the cast — two hits outside `__tests__` where the criterion demands one.
- **Fix:** Rephrased all three so the prose keeps its meaning without the literal. The brand-audit fix is commit `78c0c0e`. Generalised into the convention section above.

### Deliberate departures

- **`capabilities` appears twice in the overview payload** — inside `space` and at the top level. The plan's literal response shape puts it at the top level and its acceptance criterion requires it there, while `SpaceSummarySchema` puts it inside the shell object. Emitting both makes `space` a valid `SpaceSummary` and satisfies the criterion. It is the same array reference assigned once, so the two cannot drift.
- **`apps/web/src/__tests__/fixtures/space.ts` breaks the repo's inline-fixture convention**, as the plan directed, and the file heads with that justification. It gained `membershipFor`, `spaceRow`, `proposalRow` and `auditRow` beyond the plan's list, all needed by the three test files.
- **The proposals route builds its query schema locally** from `REVIEW_VOTE_STATUSES` rather than importing one from `@sync/shared/contracts`, because no list-filter schema exists there and 05-02 established that the contract file must not be reopened. It is still a zod schema parsed through `parse()`, not a hand-rolled type guard.

---

**Total deviations:** 5 auto-fixed (3 blocking, 2 bugs), 1 documented pattern, 3 deliberate departures.
**Impact:** No change to the authorization design. Deviations 1 and 2 are environment; 3–5 are corrections the plan's own acceptance criteria required.

## Verification Results

- `pnpm --filter @sync/web typecheck` — exit 0
- `pnpm --filter @sync/web exec vitest run src/__tests__/api/space-admin-object-authz.test.ts src/__tests__/api/space-admin-capability-matrix.test.ts src/__tests__/api/space-admin-suspension.test.ts` — **52 tests, 3 files, all passing**
- `grep -rn "as unknown as SpaceScope" apps/web/src --include=*.ts | grep -vc __tests__` → `1`
- `grep -rln "SpaceScopeBrand" apps/web/src | wc -l` → `1`
- `grep -c "notFound(" authorize.ts` → `0`; `grep -c "forbidden('" authorize.ts` → `0`
- `grep -c "select('\*')"` → `0` in all three new data modules
- `grep -rn "municipalityCode as string" apps/web/src` → nothing
- `grep -rn "spaceId" space.repo.ts` → only `findActiveGrant`, `findGrantsForUser`, and the private `selectSpaceRow`
- Both route files: `await params` present, zero `@/lib/supabase` imports
- `space-audit.repo.ts` exports no `update*` or `delete*`

Deliberately **not** run: the full suite, `next build`, and `prettier --check`. 05-03 and 05-11 executed in this same working tree; the phase's one full-suite run is 05-16's, alone in wave 6.

## Issues Encountered

- **Nothing here has touched a live database.** These repositories are written against 05-01's migrations, which have still never been applied to a real Postgres. The PostgREST embeds in particular are reviewed, not executed: `spaces!inner(municipality_code)` in the grant resolver, `users(first_name, last_name)` on votes, and the actor embed on `space_audit_log` will each fail at runtime rather than at compile time if a relationship does not resolve as expected. The keyset `.or()` predicate in `listAuditRows` is unverified for the same reason. 05-16 owns applying the migrations; these three embeds are worth adding to its checklist.
- **`space_admin_metrics` remains typed but unimplemented** until 05-07, as 05-01 recorded. Nothing in this plan calls it.
- **Wave-2 concurrency was live throughout.** 05-03 and 05-11 both committed between my commits, and 05-11 edited `apps/web/package.json` inside the window between my read and my install. All five of my commits were audited for foreign files and are clean.

## User Setup Required

None. `server-only` installs from the existing pnpm store with no network access and no configuration.

## Next Phase Readiness

**Ready.** The design six plans were waiting on is settled and green.

Plans 05-05 through 05-09 can now add scope-taking repository functions freely — the signature costs nothing. Before writing one, read three things in this document: the limit of the guarantee (the `capability` field is not enforced), the two-token cost (a weaker authority needs its own entry points), and the `optional()` extraction note.

## Self-Check: PASSED

All 12 created files and both modified files verified present on disk. All five commits (`e6fbf1b`, `bf732e3`, `14bc5a9`, `c2077ba`, `78c0c0e`) resolve in `git log`. The two scratch files used for checkpoint evidence were deleted and confirmed absent; `git status` shows no stray files from this plan.

The claims deliberately **not** verified are the PostgREST embeds and the keyset predicate against a live Postgres — see Issues Encountered. Nothing in this summary asserts they were executed.
