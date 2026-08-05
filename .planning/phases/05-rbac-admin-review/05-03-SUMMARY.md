# 05-03 — authorization core — SUMMARY

**Completed:** 2026-08-03
**Commit:** `5f41f7c` on branch `feat/rls-transport`
**Requirements:** RBAC-01, RBAC-02

Plans 05-05 and 05-06 build against the signatures below verbatim.

## `apps/web/src/server/app/authz/require-role.ts`

```ts
export function toGrantFacts(row: RoleGrant): GrantFacts;

export function requireRole(
  userId: string,
  role: RoleName,
  spaceId: string | null
): ResultAsync<GrantFacts, AppError>;

export interface ReviewerAuthority {
  actorUserId: string;
  actorRole: 'super_admin' | 'space_admin';
  grant: GrantFacts;
}

export function requireReviewAuthority(
  userId: string,
  target: { spaceId: string; targetRole: RoleName | null; action: ReviewAction }
): ResultAsync<ReviewerAuthority, AppError>;

export type AdminScope =
  | { kind: 'platform' }
  | { kind: 'spaces'; spaceIds: string[] };

export function requireAdminScope(userId: string): ResultAsync<AdminScope, AppError>;
```

Denial reasons emitted: `no_grant`, `grant_suspended`, `grant_revoked`,
`billing_inactive` (all from the policy), plus `insufficient_scope` and
`no_admin_grant` from this module.

## `apps/web/src/server/domain/authz/policy.ts`

```ts
export interface GrantFacts { id: string; role: RoleName; spaceId: string | null; status: RoleGrantStatus }
export interface AuthzFacts { grant: GrantFacts | null; billingActive: boolean }
export type DenyReason = 'no_grant' | 'grant_suspended' | 'grant_revoked' | 'billing_inactive';
export type AuthzDecision = { allowed: true; grant: GrantFacts } | { allowed: false; reason: DenyReason };
export type ReviewAction = 'approve' | 'reject' | 'suspend' | 'reinstate' | 'revoke';
export interface ReviewerFacts { actorGrants: GrantFacts[]; targetSpaceId: string; targetRole: RoleName | null }

export const AUTHZ_REQUIREMENTS: readonly Requirement[];   // length 4
export function evaluateAuthorization(facts: AuthzFacts): AuthzDecision;
export function canReview(facts: ReviewerFacts, _action: ReviewAction): boolean;
```

## `apps/web/src/server/infra/supabase/role.repo.ts`

```ts
export function findLiveGrant(userId, role: RoleName, spaceId: string | null): ResultAsync<RoleGrant | null, AppError>;
export function listActiveGrants(userId: string): ResultAsync<RoleGrant[], AppError>;
export function findGrantById(grantId: string): ResultAsync<RoleGrant | null, AppError>;
export function insertGrant(row: InsertTables<'role_grants'>): ResultAsync<RoleGrant, AppError>;
export function setGrantStatus(grantId, expected: RoleGrantStatus, next: RoleGrantStatus, endedAt: string | null): ResultAsync<RoleGrant | null, AppError>;

export function insertApplication(row: InsertTables<'community_manager_applications'>): ResultAsync<CommunityManagerApplication, AppError>;
export function findApplicationById(id: string): ResultAsync<CommunityManagerApplication | null, AppError>;
export function findLatestApplicationForUser(userId: string): ResultAsync<CommunityManagerApplication | null, AppError>;
export interface SubmittedApplicationRow extends CommunityManagerApplication {
  users: { id: string; first_name: string | null; last_name: string | null; email: string; municipality_id: string | null } | null;
}
export function listSubmittedApplications(spaceIds: string[] | null): ResultAsync<SubmittedApplicationRow[], AppError>;
export function decideApplication(id: string, next: 'approved' | 'rejected', reviewerId: string, reason: string): ResultAsync<CommunityManagerApplication | null, AppError>;

export function insertAuditEvent(row: InsertTables<'role_grant_events'>): ResultAsync<RoleGrantEvent, AppError>;
export function listAuditEvents(subjectType: AuditSubjectType, subjectId: string): ResultAsync<RoleGrantEvent[], AppError>;
```

**Null is not an error on the two guarded writes.** `setGrantStatus` and
`decideApplication` pin the expected current status in the WHERE clause; a null
result means someone else already applied the transition. Callers map that to
CONFLICT or a no-op, never to a 500.

One implementation note not in the plan: `findLiveGrant` uses `.is('space_id',
null)` rather than `.eq('space_id', null)` for platform-wide grants — PostgREST
`eq` does not match NULL, so an `eq` here would silently deny every super_admin.

## `apps/web/src/server/app/authz/mappers.ts`

```ts
export function toManagerApplication(row: CommunityManagerApplication): ManagerApplication;
export function toGrantSummary(row: RoleGrant): RoleGrantSummary;
```

Defined once, in wave 2, so the applicant view (05-05) and the admin view
(05-06) of the same row cannot drift.

## Open Question 1 — RESOLVED

**`space_admin` may approve, reject AND suspend inside its own space.** An admin
who can approve but cannot undo their own decision is operationally
indefensible. **Acting on an admin-tier grant (`super_admin` or `space_admin`)
is `super_admin`-only**, so space admins cannot neutralize each other. Encoded
in `ADMIN_TIER_ROLES` in `policy.ts` and tested in both authz test files.

## Gates

- `npx vitest run src/server/domain/authz src/server/app/authz` — 27 passed
  (15 policy, 12 require-role)
- `pnpm --filter @sync/web test` — 854 passed (69 files)
- `pnpm --filter @sync/web typecheck` — clean
- `pnpm --filter @sync/web lint` — 2 pre-existing warnings, unchanged
- Centralization: `grep -rln "role_grants" apps/web/src` lists only
  `types.ts`, `role.repo.ts`, and `require-role.{ts,test.ts}` — the latter two
  only in a comment and a `dbError()` op label, not a query. No route, no
  component.
- Purity: 0 `supabaseAdmin|neverthrow|next/` in `policy.ts` and `mappers.ts`;
  0 payment/subscription terms in `require-role.ts` **code** (see deviation).

## Deviation from the plan

Third instance of the same defect class as 05-01 and 05-02. The plan requires
the header to say authorization is "never derived from payment state", then
asserts `grep -cE "payment|subscription|charge|greenInvoice" require-role.ts`
returns 0. The single match is that very sentence. Verified the real invariant
instead — comments stripped, the count is 0.

## Not proven

Everything here is unit-tested against a mocked repository. No query in
`role.repo.ts` has run against a database; the column names, the join hint
`users!community_manager_applications_user_id_fkey`, and the guarded-update
semantics are unverified until plan 05-09 applies the migrations. The blockers
in `05-01-SUMMARY.md` (unset `SUPABASE_JWT_SECRET`, unverified HS256) are
unchanged.
