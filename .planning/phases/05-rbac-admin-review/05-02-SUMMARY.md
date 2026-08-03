# 05-02 — role grants, applications, audit — SUMMARY

**Completed:** 2026-08-03
**Commit:** `3dedcf0` on branch `feat/rls-transport`
**Requirements:** RBAC-01, RBAC-04, RLS-05

## Migration

`supabase/migrations/20260802000002_role_grants_and_applications.sql` — **NOT
applied to any database.** Application is plan 05-09 Task 1.

### `role_grants`

`id`, `user_id` → `users(id)` CASCADE, `role` (`super_admin` | `space_admin` |
`community_manager`), `space_id` → `municipalities(code)` NULLable,
`status` (`active` | `suspended` | `revoked`, default `active`),
`source` (`manual` | `application`, default `manual`), `source_id`,
`granted_by` → `users(id)` SET NULL, `granted_at`, `ended_at`, `created_at`,
`updated_at`.

Constraint `role_grants_scope_ck`: `super_admin` ⇒ `space_id IS NULL`; every
other role ⇒ `space_id IS NOT NULL`.

Indexes: `uq_role_grants_live` (unique on `user_id, role, COALESCE(space_id,'*')`
where status in active/suspended), `idx_role_grants_user_live`,
`idx_role_grants_space_role`. Trigger `update_role_grants_updated_at`.

### `community_manager_applications`

`id`, `user_id` → `users(id)` CASCADE, `space_id` → `municipalities(code)` NOT
NULL, `motivation` (CHECK 40–2000 chars), `contact_phone`, `evidence_urls`
JSONB default `[]`, `status` (`submitted` | `approved` | `rejected` |
`withdrawn`, default `submitted`), `reviewed_by` → `users(id)` SET NULL,
`reviewed_at`, `review_reason`, `created_at`, `updated_at`.

Indexes: `uq_cm_applications_open` (unique on `user_id, space_id` where status =
submitted), `idx_cm_applications_queue`. Trigger
`update_cm_applications_updated_at`.

### `role_grant_events`

`id`, `subject_type` (`role_grant` | `community_manager_application`),
`subject_id`, `event` (`submitted` | `approved` | `rejected` | `granted` |
`suspended` | `reinstated` | `revoked`), `subject_user_id`, `actor_user_id`,
`role`, `space_id`, `reason`, `detail` JSONB, `created_at`.

**No foreign keys and no `updated_at`, by design** — the log outlives its
subject. Trigger `role_grant_events_append_only` (BEFORE UPDATE OR DELETE) calls
`public.reject_audit_mutation()`, which raises. Enforced in the database rather
than by RLS because the service role bypasses RLS and is the app's write path.

## Helper signatures

```sql
public.is_platform_admin() RETURNS BOOLEAN
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public

public.can_admin_space(p_space TEXT) RETURNS BOOLEAN
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
```

Both MUST stay `SECURITY DEFINER` with the pinned `search_path`. This is the
anti-recursion break for 42P17, not a style choice.

## Policy names (plan 05-04's harness asserts against these verbatim)

1. `role_grants_select_own`
2. `role_grants_select_admin`
3. `cm_applications_select_own`
4. `cm_applications_select_admin`
5. `role_grant_events_select_own`
6. `role_grant_events_select_admin`

All six are `FOR SELECT TO authenticated`. There are **no** INSERT/UPDATE/DELETE
policies — service-role remains the only write path.

## TypeScript surface

`apps/web/src/lib/supabase/types.ts` gained the three `Tables` entries
(`role_grant_events.Update` is `Record<string, never>`), three `Functions`
entries (`user_id`, `is_platform_admin`, `can_admin_space`), and the aliases
`RoleGrant`, `CommunityManagerApplication`, `RoleGrantEvent`.

`packages/shared/src/contracts/role.ts` exports 21 schemas (plan required ≥16),
re-exported from the barrel.

## Gates

- `pnpm --filter @sync/web typecheck` — clean
- `pnpm --filter @sync/shared typecheck` — clean
- `pnpm --filter @sync/web test` — 827 passed
- `pnpm --filter @sync/web lint` — 2 pre-existing warnings, unchanged
- Migration greps: 3 tables, 3 `ENABLE ROW LEVEL SECURITY`, 6 `CREATE POLICY`,
  6 `FOR SELECT TO authenticated`, 2 `SECURITY DEFINER` declarations each
  followed by `SET search_path = public`, 2 `REFERENCES municipalities(code)`,
  0 `auth.uid()`, 0 `CREATE TYPE`, audit table FK-free

## Deviation from the plan

The plan's verify block asserts `grep -c 'SECURITY DEFINER' == 2`, but its own
prescribed comment text contains the phrase six more times (the header's
deviation-4 paragraph, the anti-recursion note, and both `COMMENT ON FUNCTION`
bodies). Same class of error as 05-01 Task 3's `auth.uid()` assertion. Verified
the real invariant instead: exactly 2 declaration lines (`^SECURITY DEFINER$`),
each immediately followed by `SET search_path = public`.

## Unchanged blockers

Everything in `05-01-SUMMARY.md` still holds — `SUPABASE_JWT_SECRET` is unset,
the HS256 assumption is unverified against the live project, and nothing has run
against a real database. This plan adds a third: **the two migrations must be
applied in order** (`…000001_rls_transport` before
`…000002_role_grants_and_applications`), because every policy here calls the
`public.user_id()` the first one redefines.
