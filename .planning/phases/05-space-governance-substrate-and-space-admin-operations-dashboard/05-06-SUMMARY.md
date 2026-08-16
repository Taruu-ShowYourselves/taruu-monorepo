---
phase: 05-space-governance-substrate-and-space-admin-operations-dashboard
plan: 06
subsystem: api
tags: [authorization, privacy, audit, neverthrow, supabase, zod, vitest, security]

# Dependency graph
requires:
  - phase: 05-01
    provides: space_capability_grants, space_member_suspensions, platform_escalations, the four votes moderation columns, users.is_platform_admin
  - phase: 05-02
    provides: the eleven-capability vocabulary and every request/response schema in packages/shared/src/contracts/spaceAdmin.ts
  - phase: 05-04
    provides: branded SpaceScope, authorize(), resolveMembership(), insertAuditRow(), the shared space fixtures
provides:
  - space-member.repo.ts — privacy-allow-listed member reads plus grant, suspension, content and escalation writes, all scope-typed and none of them deletions
  - getSpaceMembers — the authorized member listing the UI imports, named apart from the repository read on purpose
  - grantCapability / revokeCapability / suspendGrantAsPlatformAdmin
  - suspendMember / reinstateMember
  - moderateContent — the four permitted-content transitions
  - raiseEscalation — the SPACE-09 path, un-gated, branch-free, writing only platform_escalations
  - five endpoints under /api/space-admin/[spaceId] (members, grants, members/suspension, proposals/[voteId]/content, escalations)
affects: [05-07, 05-09, 05-12, 05-13, 05-14, 05-16, issue-68]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional write carrying the space predicate and the current-state guard in one statement, so a no-op surfaces as 409 rather than a silent success"
    - "Unique-index collision mapped to CONFLICT at the repository boundary, so idempotency is the database's job and not a read-then-write"
    - "Contract schema re-parsed at the HTTP edge so zod strips anything the allow-list does not name"
    - "Ordered non-atomic pair of writes chosen so the failure direction is closed (access gone, record missing) rather than open"
    - "Opaque endpoint built by construction: one attempt, unwrapOr(null), a nullable FK, and a frozen response literal — no branch exists to leak"

key-files:
  created:
    - apps/web/src/server/infra/supabase/space-member.repo.ts
    - apps/web/src/server/app/space-admin/list-members.ts
    - apps/web/src/server/app/space-admin/manage-grants.ts
    - apps/web/src/server/app/space-admin/manage-membership.ts
    - apps/web/src/server/app/space-admin/moderate-content.ts
    - apps/web/src/server/app/space-admin/raise-escalation.ts
    - apps/web/src/app/api/space-admin/[spaceId]/members/route.ts
    - apps/web/src/app/api/space-admin/[spaceId]/grants/route.ts
    - apps/web/src/app/api/space-admin/[spaceId]/members/suspension/route.ts
    - apps/web/src/app/api/space-admin/[spaceId]/proposals/[voteId]/content/route.ts
    - apps/web/src/app/api/space-admin/[spaceId]/escalations/route.ts
    - apps/web/src/__tests__/api/space-admin-members.test.ts
    - apps/web/src/__tests__/api/space-admin-content.test.ts
  modified:
    - .planning/phases/05-space-governance-substrate-and-space-admin-operations-dashboard/deferred-items.md

key-decisions:
  - "Repository functions renamed away from their use-case twins (insertMemberSuspension / liftMemberSuspension), extending the getSpaceMembers-vs-listSpaceMembers rule the plan set for one pair to all of them"
  - "Reinstatement restores only the grants the suspension itself took, matched on the suspension's own timestamp, so a separately-revoked capability stays revoked"
  - "Member suspension writes the grants first and the record second, so a partial failure leaves access closed rather than open"
  - "The escalation acknowledgement is a frozen constant, not EscalationResponseSchema — a fresh id and timestamp would make two responses distinguishable"
  - "The members response is re-parsed through SpaceMemberListResponseSchema at the route, adding a strip the use-case cannot bypass"
  - "optional() deliberately NOT extracted: this plan has no multi-capability surface and did not copy it; 05-07 is the real first reuse"

patterns-established:
  - "Pattern: a mandated comment that must discuss a token a grep counts gets rephrased without the literal — hit four times now, in three separate places in this plan alone"
  - "Pattern: object type alias rather than interface for any shape written into a Json column, because only the alias gets an implicit index signature"

requirements-completed: []

# Metrics
duration: 20min
completed: 2026-08-03
---

# Phase 5 Plan 06: People, Content and Escalation Summary

**Nine authority-changing actions, each a conditional scoped write with its audit row appended inside the same chain — plus one endpoint deliberately built with no branch at all, so that a suspended admin, a stranger and someone naming a space that does not exist receive byte-identical answers.**

## Performance

- **Duration:** ~20 min (start 07:38:30Z, first commit 07:44:56Z, last 07:58:01Z)
- **Tasks:** 3 (two TDD)
- **Files:** 14 (13 created, 1 modified)
- **Tests:** 39, in 2 files

## Endpoints shipped, and the capability each requires

| Method | Path | Capability | Use-case |
|---|---|---|---|
| `GET` | `/api/space-admin/{spaceId}/members` | `member.read` | `getSpaceMembers` |
| `POST` | `/api/space-admin/{spaceId}/grants` | `grant.create` | `grantCapability` |
| `POST` | `/api/space-admin/{spaceId}/grants` (body names `grantId`) | **none** — `users.is_platform_admin` only | `suspendGrantAsPlatformAdmin` |
| `DELETE` | `/api/space-admin/{spaceId}/grants` | `grant.revoke` | `revokeCapability` |
| `POST` | `/api/space-admin/{spaceId}/members/suspension` | `member.suspend` | `suspendMember` |
| `DELETE` | `/api/space-admin/{spaceId}/members/suspension` | `member.suspend` | `reinstateMember` |
| `POST` | `/api/space-admin/{spaceId}/proposals/{voteId}/content` | `content.moderate` | `moderateContent` |
| `POST` | `/api/space-admin/{spaceId}/escalations` | **none, by design** | `raiseEscalation` |

**Import the use-case, never the repository.** `space-member.repo.ts` exports `listSpaceMembers`, `insertGrant`, `revokeGrant`, `suspendGrantById`, `insertMemberSuspension`, `liftMemberSuspension`, `setContentModeration` and `insertEscalation`; every one of them will happily run without an authorization call in front of it, because that check lives in the use-case. The eight names in the table above are the whole public surface for the UI plans.

## `/escalations` — the single un-gated endpoint

**Constant acknowledgement body, verbatim:**

```json
{ "accepted": true }
```

**Status:** `202`. Both are exported from `raise-escalation.ts` as `ESCALATION_ACKNOWLEDGEMENT` and `ESCALATION_STATUS`, so a test or a client can assert against the same literal the server returns.

**It writes `platform_escalations` and nothing else.** No row reaches any space's audit log, and there is no `escalation.raised` action in the phase's vocabulary. The reason is not stylistic: the log is append-only by trigger and REVOKE, so a row written there can never be removed — and this endpoint is reachable by *any authenticated user*, at five an hour, naming *any* space id. An audit write here would be a permanent-pollution primitive pointed at an arbitrary space's history.

**The opacity is structural, not procedural.** Four properties hold it up, and removing any one of them breaks it:

1. Membership is attempted exactly once and any failure folds to `null` via `unwrapOr`. The error is never inspected, the space is never looked up separately, and the id's shape is never tested as its own branch. `grep -cE "if \(.*(space|membership).*\)" raise-escalation.ts` returns `0` because the file contains no `if` at all.
2. `platform_escalations.space_id` is nullable against a non-null `raw_space_id`. A NOT NULL FK would fail the insert for an unknown space and leak its absence through the status code.
3. The response is a frozen literal. It deliberately does **not** use `EscalationResponseSchema` (`{ escalationId, createdAt }`), because a fresh uuid and timestamp make two responses unequal — and the test asserts four responses are deep-equal.
4. The rate limiter is keyed by `session.userId`, never by space. A per-space key would leak which spaces are being escalated about through its own reset behaviour.

The opacity test compares each of `SPACE_B`, a well-formed uuid matching nothing, and `not-a-uuid` against a baseline computed in the same case — the answer a fully-capable member of their own space gets — so the four responses are equal by construction rather than against a hard-coded expectation someone could quietly update.

## Where the privacy allow-list is enforced

Three times, deliberately, each one sufficient on its own:

1. **The repository** selects seven hand-written columns from `users` and joins nothing. `grep -icE "identity_documents|id_number|date_of_birth|document_expiry|did_encrypted|access_token_encrypted|\.phone|'email'"` over the file returns `0`.
2. **The use-case** narrows further than it read: `first_name`/`last_name` become one `displayName`, and `identity_verified_at` becomes `identityVerified: Boolean(...)`. A verification *timestamp* is more than administration needs and points directly at the document that produced it.
3. **The route** re-parses the payload through `SpaceMemberListResponseSchema`. Zod strips keys the schema does not name, so a future edit that leaks a column past the first two layers still cannot get it onto the wire. A parse failure is a 500, not a 200 with the field removed silently — a response our own contract rejects is a server fault.

The test guards it with a regex over the whole serialized body rather than field-by-field assertions, because the leak that matters is the shape nobody thought to name a field for.

## Two corrections to the plan's literal instructions

**1. The repository's suspension functions were renamed.** The plan named the repository functions `suspendMember` and `reinstateMember` *and* gave the use-cases the same two names. That is precisely the collision the plan itself calls out for `getSpaceMembers` vs `listSpaceMembers` — "two exports with one name across the app and infra layers is how a Server Component ends up importing the repository and reaching the database without an `authorize()` call." The use-cases keep the mandated names; the repository functions are `insertMemberSuspension` and `liftMemberSuspension`.

**2. Reinstatement does not restore every suspended grant.** The plan says reinstate should "clear `suspended_at`/`suspended_by` on that user's grants in this space". Taken literally, that resurrects a capability an admin had individually revoked *before* the suspension — and the confirmation copy promises `אותן הרשאות שהיו לפני ההשעיה`, the permissions held before the suspension, which a revoked one was not.

The fix is a matching timestamp. `insertMemberSuspension` stamps the suspension record and the grants it takes with the same `now`, and `liftMemberSuspension` restores only the grants carrying that exact value. The degraded case — a partial failure where the two timestamps diverge — leaves a grant suspended rather than wrongly active, which is the safe direction.

## The non-atomicity, stated plainly

`insertMemberSuspension` and `liftMemberSuspension` each perform two writes, and PostgREST offers no transaction. The order is the mitigation:

- **Suspend:** grants first, record second. A failure between them leaves access already gone with no record — closed, not open.
- **Reinstate:** record first, grants second. A failure between them leaves the member un-suspended on paper but still without capabilities — closed again.

In both directions a partial failure is recoverable by retrying, and in neither does a member end up with authority the admin did not intend. This is worth knowing before anyone "simplifies" the ordering.

## Task Commits

1. **Task 1: member repository** — `c9b570c` (feat)
2. **Task 2 RED: endpoint behaviour tests** — `4b25efb` (test)
3. **Task 2 GREEN: five use-cases, five routes** — `1ea4b3f` (feat)
4. **Task 3: serialization guard, suspension history, escalation opacity** — `430f8b0` (test)
5. **Deferred items** — `f1a72e4` (docs)

All five audited with `git show --stat`; every one contains only this plan's files. 05-05, 05-07 and 05-08 committed into the same working tree between mine — `1ea4b3f` and `430f8b0` are three seconds apart from sibling commits — and every commit used the path-scoped `git commit -m "…" -- <paths>` form.

## Decisions Made

- **The two POST bodies on `/grants` are distinguished by shape, not by a mode flag.** `SuspendGrantRequestSchema` names `grantId`; `GrantCapabilityRequestSchema` names `userId` and `capability`; neither validates as the other. A flag would let the caller choose which authorization check runs.
- **`suspendGrantAsPlatformAdmin` resolves no scope at all.** A platform admin holds no grant in the target space, so there is nothing to mint from — and minting one anyway would manufacture the cross-space wildcard the CONTEXT decision rejected: a token that opens every scoped repository in the codebase, handed to a bearer whose authority is exactly one action wide. It validates the space id, checks `is_platform_admin`, and writes. Denial is the same reason-free `forbidden()` as everywhere else.
- **The audit row for that action still lands in the target space's log,** with the platform admin as actor. A space's own admins must be able to see that their authority was changed and by whom.
- **`prior_state`/`new_state` on content carry the whole moderation state,** not the field that moved. A row reading `{ hidden: true }` alone cannot answer "was it also flagged at the time?", which is the question a reviewer opens the log to answer. The prior state is derived by inverting the field the conditional update is known to have flipped — no second read, so no window in which another admin's change is recorded as this one's starting point.
- **`ModerationState` is a type alias rather than an interface.** TypeScript grants an implicit index signature to object type aliases but not to interfaces, and `prior_state`/`new_state` are typed `Json`. As an interface the audit write is `error TS2322`. Worth knowing for every future shape written into a Json column.
- **`countSpaceMembers` counts in SQL** rather than from the fetched page, so the `{n} חברים במרחב` total stays honest under pagination.
- **`optional()` was not extracted, and not copied.** Every surface here is gated on a single capability — `GET /members` without `member.read` must be refused, not served empty — so there is no multi-widget fold to share. 05-04 asked that it not be copied a third time; it was not. 05-07 is the genuine first reuse.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reinstatement would have resurrected individually-revoked grants**

- **Found during:** Task 1
- **Issue:** the plan's literal instruction clears `suspended_at` on all of the member's grants, which restores capabilities revoked before the suspension.
- **Fix:** both writes in a suspension share one timestamp; reinstatement matches on it exactly.
- **Files modified:** `space-member.repo.ts`
- **Commit:** `c9b570c`

**2. [Rule 1 - Bug] `ModerationState` as an interface did not compile against the `Json` column type**

- **Found during:** Task 2 GREEN
- **Issue:** `error TS2322: Type 'ModerationState' is not assignable to type 'Json | undefined'` on both `prior_state` and `new_state`. Interfaces get no implicit index signature.
- **Fix:** declared it a type alias, with a comment saying why so nobody "tidies" it back.
- **Commit:** `1ea4b3f`

**3. [Rule 3 - Blocking] The limiter-construction assertion was erased by `clearAllMocks`**

- **Found during:** Task 2 GREEN
- **Issue:** `createRateLimiter` runs when the route module loads, and `vi.clearAllMocks()` in `beforeEach` wipes that call before any test can read it. The assertion failed with "Number of calls: 0".
- **Fix:** snapshot `mock.calls` at import time and assert against the snapshot.
- **Commit:** `1ea4b3f`

**4. [Documented] Three comment-versus-grep collisions, all in this plan**

- **Found during:** Tasks 1 and 2
- **Issue:** the plan mandates comments that name tokens its own greps require to be absent — `identity_documents` and `select('*')` in the repository docblocks, `space_audit_log` in the escalation module's Rule 1, and `authorize()` in the note explaining that the platform-admin path does not call it.
- **Fix:** all four rephrased to keep their meaning without the literal ("the identity-document table", "a star select", "the target space's audit log", "resolves no scope"). This is the convention 05-04 recorded after 05-01 and 05-02 hit it; it has now been hit in five plans, and it is cheaper to write the prose around the literal than to discover it at verification.

### Deliberate departures

- **Repository suspension functions renamed** — see "Two corrections" above.
- **`EscalationResponseSchema` is unused by this plan.** Its `{ escalationId, createdAt }` shape cannot be returned without breaking the constant-body requirement. It remains a reasonable shape for a future platform-admin triage surface, which is not an opaque endpoint.
- **The members route carries six lines more than a "thin shell".** The extra lines are the allow-list re-parse, which is load-bearing privacy enforcement rather than logic.
- **`MemberListQuerySchema` is declared in `list-members.ts`**, following 05-04's `ProposalListQuerySchema` precedent — no list-filter schema exists in the contract file and 05-02 established that it must not be reopened. Its bound is a local constant rather than the repository's `MEMBER_PAGE_MAX`, so the schema keeps its bounds when a test replaces that module wholesale.
- **The escalation limiter is constructed in the route file, not in `lib/rate-limit.ts`.** That file is nobody's declared territory this phase, and a Next route file may not export arbitrary constants, so the limiter is a module-level const there.

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking), 1 documented pattern, 5 deliberate departures.
**Impact:** none on the authorization design. Deviations 1 and the two renames are corrections the plan's own stated reasoning required.

## Verification Results

- `pnpm --filter @sync/web typecheck` — exit 0, **repo-wide clean** (re-run after 05-05, 05-07 and 05-08 landed)
- `pnpm --filter @sync/web exec vitest run src/__tests__/api/space-admin-members.test.ts src/__tests__/api/space-admin-content.test.ts` — **39 tests, 2 files, all passing** (plan floor: 18)
- `grep -icE "identity_documents|id_number|date_of_birth|document_expiry|did_encrypted|access_token_encrypted|\.phone|'email'" space-member.repo.ts` → `0`
- `grep -c "select('\*')" space-member.repo.ts` → `0`; `grep -c "\.delete()"` → `0`
- `grep -c "select('id, first_name" space-member.repo.ts` → `1` (the allow-list is one greppable line)
- `grep -c "insertAuditRow"` → manage-grants `4`, manage-membership `3`, moderate-content `2`
- `grep -c "insertAuditRow\|space_audit_log" raise-escalation.ts` → `0`
- `grep -cE "if \(.*(space|membership).*\)" raise-escalation.ts` → `0`
- `grep -A20 "suspendGrantAsPlatformAdmin" manage-grants.ts | grep -c "authorize("` → `0`
- `grep -c "export function getSpaceMembers" list-members.ts` → `1`; `grep -c "export.*listSpaceMembers"` → `0`
- `grep -c "Boolean(.*identity_verified_at" list-members.ts` → `1`; `grep -cE "first_name:|last_name:"` → `0`
- All five route files: `await params` present, one or more `@sync/shared/contracts` imports, zero `@/lib/supabase` imports
- `grep -rn "identity_documents" server/app/space-admin/ server/infra/supabase/space*.ts` → nothing
- `grep -rn "\.delete()" server/infra/supabase/space*.ts` → nothing

Deliberately **not** run: the full suite, `next build`, `prettier --check`. 05-05, 05-07 and 05-08 shared wave 3 and this working tree; the phase's one full-suite run is 05-16's, alone in wave 6.

## Issues Encountered

- **Nothing here has touched a live database.** Every predicate in `space-member.repo.ts` is reviewed, not executed — the phase's migrations have still never reached a real Postgres. Four things in this plan fail at runtime rather than compile time if the schema does not behave as read, and belong on 05-16's checklist:
  1. the `.or('first_name.ilike.*term*,last_name.ilike.*term*')` search filter — PostgREST `or=` syntax and the `*` wildcard form;
  2. the `23505` unique-violation code surfacing on the supabase-js error object for `uq_active_grant` and `uq_active_member_suspension`;
  3. `.select()` on an `UPDATE` returning the affected rows, which every conflict detection in this module depends on — a zero-length array is how "already in that state" is recognised;
  4. the exact-timestamp match in `liftMemberSuspension`, which assumes Postgres stores and returns the ISO string it was given without re-rendering it differently.
- **Item 3 above is the one worth testing first.** If `.select()` after an update returns something other than the affected rows, every 409 in this plan silently becomes a 200.
- **The overview's `membersInSpace` figure is still `null`** and `get-space-overview.ts` still says `// wired in 05-06`. This plan ships the count it needs but does not own that file; logged as deferred item 6 with the exact three-line change.
- **Wave-3 concurrency was live throughout.** Three siblings committed between mine, twice within seconds. All five commits audited clean.

## User Setup Required

None. No new dependency, no new environment variable. `SPACE_ADMIN_ENABLED` already gates the whole dashboard including these endpoints, through `authorize()` and `resolveMembership()`.

## Next Phase Readiness

**Ready.** Surfaces 3 and the proposal detail panel have their whole server side.

For **05-12…05-15**: import the eight use-cases named in the endpoint table, never the repository. The members payload is `{ members, total }` where each member is exactly `SpaceMemberSchema` — the response is parsed through that schema at the edge, so anything not in the schema will not arrive no matter what the server does.

For **05-09** (audit surface): the nine audit actions this plan writes are `grant.created`, `grant.revoked`, `grant.suspended`, `member.suspended`, `member.reinstated`, `content.hidden`, `content.unhidden`, `content.flagged`, `content.unflagged`. Their `object_type` values are `grant`, `member` and `content` respectively. There is no escalation action and there must not be one.

For **issue #68**: `suspendGrantAsPlatformAdmin` is the phase's only platform-authority path and it deliberately mints no token. If #68 needs a platform admin to *read* space data, that is a third authority notion and it pays 05-04's two-token cost again — its own repository entry points, not a cast.

## Self-Check: PASSED

All 13 created files verified present on disk; the one modified file verified present. All five commits (`c9b570c`, `4b25efb`, `1ea4b3f`, `430f8b0`, `f1a72e4`) resolve in `git log`. `git status --short` shows no stray files from this plan.

The claims deliberately **not** verified are the four runtime-only behaviours listed under Issues Encountered. Nothing in this summary asserts they were executed against a database.
