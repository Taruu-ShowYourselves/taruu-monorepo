---
phase: 05-space-governance-substrate-and-space-admin-operations-dashboard
plan: 01
subsystem: database
tags: [postgres, supabase, migrations, rls, enum, audit-log, typescript, authorization]

# Dependency graph
requires:
  - phase: 04-public-council-profiles
    provides: municipalities.council_id / slug_he and council_role_assignments, which spaces seeds from and reconciles against
provides:
  - spaces table seeded one row per municipality, keyed on the existing council_id
  - space_capability_grants with the eleven-capability CHECK and suspension via a nullable column
  - space_member_suspensions for members holding zero grants
  - space_audit_log, append-only by trigger plus REVOKE, ON DELETE RESTRICT on both FKs
  - platform_escalations with a nullable space_id paired to a non-null raw_space_id
  - users.is_platform_admin bootstrap marker
  - vote_status widened by draft / in_review / changes_requested / rejected across two migration files
  - votes moderation columns hidden_at / hidden_by / flagged_at / flagged_by plus the review-queue index
  - the complete TypeScript row-type surface for all of the above, including the not-yet-written space_admin_metrics RPC
affects: [05-02, 05-03, 05-04, 05-05, 05-06, 05-07, 05-08, 05-16, issue-68, issue-74]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-file enum extension: ALTER TYPE alone in one migration, every use of the new labels in the next"
    - "Append-only table: BEFORE UPDATE/DELETE trigger plus BEFORE TRUNCATE statement trigger plus REVOKE, never RLS"
    - "Partial unique indexes express liveness: uq_active_grant, uq_active_member_suspension, uq_space_proposal_single_approval"
    - "Nullable FK paired with a raw text column to keep an endpoint from becoming an existence oracle"

key-files:
  created:
    - supabase/migrations/20260802000010_space_governance.sql
    - supabase/migrations/20260802000011_vote_status_review_values.sql
    - supabase/migrations/20260802000012_vote_review_gating.sql
    - supabase/tests/audit_append_only.sql
  modified:
    - apps/web/src/lib/supabase/types.ts
    - apps/web/src/__tests__/services/user-profile-mapper.test.ts

key-decisions:
  - "spaces.id reuses municipalities.council_id, so the public council page and the administered space are literally the same object"
  - "All four vote_status labels anchor BEFORE 'pending' rather than chaining, so no statement names a label added earlier in the same transaction"
  - "space_audit_log Update is typed Record<string, never> — there is no legal shape for an update payload"
  - "The eleven-capability manifest in 05-01's CHECK is authoritative; 05-RESEARCH.md's earlier draft vocabulary is superseded"
  - "Escalations are recorded only in platform_escalations and never append to a target space's audit log"

patterns-established:
  - "Pattern: capability strings are typed as exact unions in types.ts, never bare string, so a typo is a compile error"
  - "Pattern: types.ts is hand-maintained and pre-types RPCs whose SQL lands in a later plan, to avoid parallel-wave file contention"

requirements-completed: [SPACE-01, SPACE-04, SPACE-09]

# Metrics
duration: 7min
completed: 2026-08-02
---

# Phase 5 Plan 01: Space governance substrate Summary

**Five governance tables with a trigger-and-REVOKE append-only audit log, a two-file `vote_status` extension that adds four review labels without using them, and the full hand-maintained TypeScript row-type surface for all of it.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-08-02T15:53:07Z
- **Completed:** 2026-08-02T16:00:10Z
- **Tasks:** 3
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments

- Every table the remaining fifteen plans read or write now exists in one owned migration, with no `ON DELETE CASCADE` anywhere and no rewrite of a historical row.
- `spaces` seeds one row per municipality from `municipalities.council_id` and `slug_he`, so the administered space and the public council profile share an identity rather than needing a mapping table.
- `space_audit_log` is append-only by two independent mechanisms (a raising trigger and a REVOKE) and refuses to let a user with audit history be deleted, which is what makes SPACE-09's "suspension never erases history" structurally true instead of a matter of discipline.
- The `vote_status` extension is split across two migration files, which is mandatory rather than stylistic: Postgres rolls back `ADD VALUE` if the same transaction uses the new label, so a consolidated file would appear to succeed while leaving the type unchanged.
- `apps/web/src/lib/supabase/types.ts` compiles against the new schema with exact string unions throughout, and pre-types the `space_admin_metrics` RPC whose SQL does not land until 05-07.

## Task Commits

1. **Task 1: Governance tables migration** — `8b77fb8` (feat)
2. **Task 2: vote_status extension across two migration files** — `e7b5c3e` (feat)
3. **Task 3: Database row types and the manual append-only probe** — `1b59566` (feat)

## Files Created/Modified

- `supabase/migrations/20260802000010_space_governance.sql` — the five governance tables, the `users.is_platform_admin` marker, the `council_role_assignments` reconciliation comment, append-only enforcement, and RLS-with-no-policies on all five tables.
- `supabase/migrations/20260802000011_vote_status_review_values.sql` — four `ALTER TYPE` statements and a header comment, nothing else.
- `supabase/migrations/20260802000012_vote_review_gating.sql` — the review-queue partial index, the four votes moderation columns, and the moderated-rows index.
- `supabase/tests/audit_append_only.sql` — six-case manual psql probe (valid append, UPDATE, DELETE, TRUNCATE, blank reason, actor deletion) plus a survival assertion.
- `apps/web/src/lib/supabase/types.ts` — five new table entries, widened `vote_status` at all four sites, `users.is_platform_admin`, the four votes moderation columns, the `space_admin_metrics` function signature, and five exported aliases.
- `apps/web/src/__tests__/services/user-profile-mapper.test.ts` — fixture updated for the new required `User` field.

## Reference: the vocabularies later plans must not re-invent

### Capability identifiers (eleven, DB-enforced by CHECK)

`proposal.read`, `proposal.approve`, `proposal.reject`, `member.read`, `member.suspend`, `grant.create`, `grant.revoke`, `content.moderate`, `metrics.read`, `notification.send`, `audit.read`

These are enforced by the CHECK constraint on `space_capability_grants.capability`, so a grant using any other string is rejected by the database. Verified identical to the manifest plan 05-02 landed in `apps/web/src/server/domain/space/capability.ts`, in the same order.

**Warning for later plans:** `05-RESEARCH.md` (lines 191–197 and 601–603) carries an *earlier draft* vocabulary containing `space.read`, `space.update`, `proposal.decide`, `member.manage`, `grant.manage`, and `notification.compose`. None of those exist in the CHECK constraint. Read the migration or `capability.ts`, not RESEARCH, for the authoritative list.

### Audit `action` vocabulary

`space_audit_log.action` is free `TEXT` with no CHECK, deliberately — a CHECK would force a migration every time a new audited action ships. Exactly one value is enforced structurally: `uq_space_proposal_single_approval` is a partial unique index on `object_id WHERE object_type = 'vote' AND action = 'proposal.approved'`, so that literal is load-bearing and must be spelled exactly.

The convention is `<object>.<past-tense-verb>`. The vocabulary later plans should use:

| `object_type` | `action` values |
| --- | --- |
| `vote` | `proposal.approved`, `proposal.rejected`, `proposal.changes_requested` |
| `grant` | `grant.created`, `grant.revoked`, `grant.suspended` |
| `member` | `member.suspended`, `member.reinstated` |
| `content` | `content.hidden`, `content.unhidden`, `content.flagged` |
| `notification_campaign` | `notification.sent` |
| `space` | `space.updated` |
| `escalation` | *(none — see below)* |

`escalation` exists in the `object_type` CHECK for symmetry and for a possible future platform-side log, but plan 05-06 must not write an escalation row into any space's `space_audit_log`. The log is append-only, so letting any authenticated user append to an arbitrary space's log would be permanent, uncleanable pollution. Escalations live only in `platform_escalations`.

Note the tense split: capabilities are imperative (`proposal.approve`) because they name a power; audit actions are past tense (`proposal.approved`) because they name a thing that happened. They are not interchangeable strings.

### `types.ts` ownership map

This plan is **not** the only writer of `apps/web/src/lib/supabase/types.ts` in the phase. Two plans list it in `files_modified`: this one (wave 1) and **05-08** (wave 3), which appends the three notification tables. That is safe and deliberate — 05-08 depends on 05-01, so the writes are ordered, and 05-08 is the only wave-3 plan touching the file. **05-07 runs in the same wave as 05-08 and must not edit it**, which is why the `space_admin_metrics` signature is pre-typed here.

## Decisions Made

- **`spaces.id = municipalities.council_id`.** Seeding the space's primary key from the existing public identifier means no join table and no second public URL namespace; the council page and the space are one object.
- **All four enum labels anchor `BEFORE 'pending'`, not chained.** RESEARCH's probe only established that statements referencing *pre-existing* labels are safe in the ADD VALUE transaction. Chaining (`AFTER 'draft'`) would make three of the four statements name a label added moments earlier. A catalog neighbour lookup is very likely not a "use", but nothing in this phase applies the migration, so the failure would first surface at 05-16's manual step. Anchoring on `pending` costs nothing and removes the question — the resulting order is still `draft < in_review < changes_requested < rejected < pending`, and nothing in the phase sorts by status ordinal.
- **`space_audit_log`'s `Update` type is `Record<string, never>`.** Matching the precedent already set by `identity_document_events`, this makes the append-only rule visible to the type checker rather than only to the database.
- **Inline string unions rather than named type aliases in `types.ts`.** A local `SpaceCapabilityName` alias would have been less repetitive, but it would collide conceptually with 05-02's `capability.ts` export of the same idea. `types.ts` describes the database; the domain layer owns the named type.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `is_platform_admin` to the user-profile-mapper test fixture**

- **Found during:** Task 3 (database row types)
- **Issue:** `users.Row` gained a required `is_platform_admin: boolean`, so the full `User` object literal at `apps/web/src/__tests__/services/user-profile-mapper.test.ts:32` no longer satisfied the type and `tsc --noEmit` failed with TS2741. This is precisely the ripple the plan wanted the widened types to surface.
- **Fix:** Added `is_platform_admin: false` to the fixture. No assertion or behaviour changed.
- **Files modified:** `apps/web/src/__tests__/services/user-profile-mapper.test.ts`
- **Verification:** `pnpm --filter @sync/web typecheck` exits 0; the file is claimed by no other plan in the phase (checked before editing, since 05-02 was executing against the same working tree).
- **Committed in:** `1b59566` (Task 3 commit)

**2. [Rule 1 - Bug] Rephrased one line of the enum migration's header comment**

- **Found during:** Task 2 (vote_status extension)
- **Issue:** The plan is self-contradictory here. It supplied a header comment containing the literal token `AFTER` (in the prose "Chaining (AFTER 'draft') would…"), and then set the acceptance criterion `grep -c "AFTER"` returns `0`. Both could not hold.
- **Fix:** Rewrote the clause as "Chaining each label onto the one before it would…", preserving the explanation verbatim in meaning while removing the token. The criterion's intent — that no `ALTER TYPE` statement uses `AFTER` as an anchor — is what actually matters, and is now unambiguous to a grep.
- **Files modified:** `supabase/migrations/20260802000011_vote_status_review_values.sql`
- **Verification:** `grep -c "AFTER"` returns `0`; `grep -c "BEFORE 'pending'"` returns `4`.
- **Committed in:** `e7b5c3e` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 plan-internal contradiction)
**Impact on plan:** Both are mechanical. No scope change, no schema change, no behaviour change.

## Issues Encountered

**The manual append-only probe could not be executed here.** `supabase/tests/audit_append_only.sql` is committed and complete, but this machine has neither Docker nor `psql`, so there is no scratch database to apply the migrations to and **no transcript was captured**. This is not a workaround or a partial result — the plan explicitly classifies the probe as manual evidence rather than CI coverage (`apps/web/vitest.config.ts` is `environment: 'node'` with Supabase mocked, so no live-DB harness exists in this repo at all). The evidence remains outstanding and is due at 05-16's manual verification step.

Concretely, this means **the migrations in this plan have never been applied to a real Postgres**. Their SQL is reviewed, not executed. Three specific things stay unproven until someone runs them: that the two-file enum split behaves as RESEARCH's probe predicts, that the seed `INSERT` finds a `council_id` and `slug_he` for every municipality row, and that the append-only trigger raises SQLSTATE 42501 as intended.

## User Setup Required

None — no external service configuration required.

To capture the outstanding evidence on a machine with Docker:

```bash
supabase db reset
psql "$SCRATCH_DATABASE_URL" -f supabase/tests/audit_append_only.sql
```

A clean run prints six `PASS` lines and no `FAIL` lines.

## Next Phase Readiness

**Ready.** Every table, column, index, and TypeScript row type the remaining plans depend on is in place, and `pnpm --filter @sync/web typecheck` is green across the web app.

Wave-1 sibling 05-02 executed against the same working tree concurrently and landed its own commits (`db4bb36`, `5da516e`) between Task 2 and Task 3 here; there was no file overlap, and its `capability.ts` manifest was cross-checked against this plan's CHECK constraint and matches exactly.

Carried forward:

- Migrations are unapplied and unproven against a live database (above). 05-16 owns this.
- `space_admin_metrics` is typed but has no SQL until 05-07 writes `20260802000013_space_admin_metrics.sql`. Any call before then fails at runtime, not at compile time.
- 05-08 is the only other plan permitted to edit `types.ts`; 05-07 must not.

## Self-Check: PASSED

All four created files and both modified files exist on disk. All three task commits (`8b77fb8`, `e7b5c3e`, `1b59566`) resolve in `git log`. `ls supabase/migrations/20260802*.sql` lists exactly three files. `pnpm --filter @sync/web typecheck` exits 0 and the two targeted vitest files pass (23 tests).

The one claim deliberately **not** verified is the migrations' behaviour against a live Postgres — see Issues Encountered. Nothing in this summary asserts they were applied.
