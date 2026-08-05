# Phase 5 — live database evidence

**Run:** 2026-08-03, by the phase coordinator, before plan 05-16.
**Target:** throwaway local Supabase stack, project `dbverify`, ports shifted +100
(db 54422, api 54421) so it could not touch the running `discovery` stack.
**Not** the production project. No production DDL was executed at any point.

This file exists because five plans (05-01, 05-06, 05-07, 05-09, 05-14) each
recorded a load-bearing database behaviour they could not execute, and all five
were converging on the same unverified-SQL problem. Every one of them is
resolved below except where noted.

## 1. Migrations apply

All 32 migrations applied cleanly from an empty database, including the five
from this phase:

| Migration | Result |
|---|---|
| `20260802000010_space_governance` | applied |
| `20260802000011_vote_status_review_values` | applied |
| `20260802000012_vote_review_gating` | applied |
| `20260802000013_space_admin_metrics` | applied |
| `20260802000014_space_notifications` | applied |

The two-file enum split works as designed — `ALTER TYPE ... ADD VALUE` in
`_0002` and first use in `_0003` — with no "unsafe use of new value" error and
no silent rollback of the enum addition.

## 2. Append-only audit log — 7 PASS, 0 FAIL

`supabase/tests/audit_append_only.sql`, written in 05-01 and never executed
until now. Full transcript:

```
PASS: valid audit row appended (da5042ec-7911-411c-b4aa-e0cef37c358a)
PASS: UPDATE refused with SQLSTATE 42501 (space_audit_log is append-only (attempted UPDATE))
PASS: DELETE refused with SQLSTATE 42501 (space_audit_log is append-only (attempted DELETE))
PASS: TRUNCATE refused with SQLSTATE 42501 (space_audit_log is append-only (attempted TRUNCATE))
PASS: blank reason refused with SQLSTATE 23514
PASS: actor deletion refused with SQLSTATE 23503 (audit history preserved)
PASS: baseline audit row survived every mutation attempt
```

**Stronger than the criterion asked for.** This ran as the `postgres`
superuser. A superuser bypasses RLS and table-level REVOKEs, so if immutability
had been grant-enforced, cases 2–4 would have succeeded and reported FAIL. They
refused, which means enforcement is by trigger and holds against every role
including superuser. SPACE-04's immutability claim is structural, not a matter
of which credential the application happens to use.

Case 6 is the SPACE-09 evidence: an actor holding audit rows cannot be deleted
(`23503`), so suspension can never cascade into erased history.

## 3. `vote_status` enum ordering

All four review labels sort ahead of `pending`, as the review gate requires:

```
draft              0
in_review          0.5
changes_requested  0.75
rejected           0.875
pending            1
active             2
ended              3
resolving          4
resolved           5
failed             6
```

## 4. Conditional UPDATE returning zero rows — the top-priority risk

Flagged independently by 05-06 and 05-09 as the assumption that, if wrong,
turns *every* 409 in the phase into a silent 200. Verified at both layers.

SQL level — first suspend matches, second is a no-op:

```
-- first suspend:  RETURNING capability -> proposal.read   (1 row)
-- second suspend: RETURNING capability -> (0 rows)
```

PostgREST level, which is what the repository code actually talks to
(`PATCH ... Prefer: return=representation`):

```
PATCH matching zero rows -> []                    HTTP 200
PATCH matching one row   -> [{...grant row...}]   HTTP 200
```

**Confirmed.** A zero-length array with HTTP 200 is what the repositories read
as "already in that state", and that is exactly what PostgREST returns. The
409 detection in `space-member.repo.ts` is sound.

## 5. `space_admin_metrics` never fabricates a zero

The `WHERE EXISTS (SELECT 1 FROM s)` guard, previously unexecuted:

```
rpc space_admin_metrics(space_uuid = <random uuid>)        -> []  HTTP 200
rpc space_admin_metrics(space_uuid = <real space, no       -> []  HTTP 200
                        municipality_code>)
```

Both return no row rather than `registered_residents: 0, status: 'available'`,
matching the migration's own comment. The application calls it with the correct
parameter name — `space-metrics.repo.ts:36` uses `{ space_uuid: scope.spaceId }`
against a function whose parameter is `space_uuid`.

## 6. Pre-existing defect found, NOT from this phase

`supabase db reset` / `supabase start` fails at the seeding step:

```
insert or update on table "users" violates foreign key constraint
"users_municipality_fk" (SQLSTATE 23503)
```

`supabase/seed.sql` inserts users carrying `municipality_id` values absent from
`municipalities`. The constraint comes from `20260728000001_municipalities.sql`,
which predates this phase; no phase-5 migration references it. So local
developer bootstrap has been broken since that migration landed, independent of
issue #75.

Not fixed here — it is outside this phase's scope and belongs in its own
change. Recorded so it is not rediscovered as a phase-5 regression. The
evidence run above proceeded with seeding disabled.

## What this run does NOT establish

- No RLS policy was exercised under a real end-user JWT; the probes ran as
  `postgres` and as `service_role`. Note that every server read and write in
  this codebase goes through `supabaseAdmin` (service role, BYPASSRLS), so RLS
  is defence in depth here rather than the enforcing boundary — authorization
  is the `authorize()` / `SpaceScope` path in the application.
- Local `service_role` lacked table privileges until granted by hand during
  this run. That is an artifact of the local bootstrap, **not** a finding:
  pre-existing tables `users` and `votes`, which work in production, showed the
  identical grant profile.
- Nothing here exercises the Expo push endpoint, and no browser rendered any
  page. Those remain 05-16's work.
