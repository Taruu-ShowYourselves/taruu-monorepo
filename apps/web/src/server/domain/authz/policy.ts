/**
 * Pure authorization decisions (RBAC-02).
 *
 * Two decisions live here and nowhere else:
 *   evaluateAuthorization() — may this caller act as <role> in <space>?
 *   canReview()             — may this reviewer decide on this target?
 *
 * evaluateAuthorization runs a LIST of independent requirements against
 * already-fetched facts. Phase 6 adds an active-billing prerequisite by making
 * `billingActive` real; the requirement list and every call site of
 * requireRole() are untouched. That is the whole point of this shape:
 * approval is a prerequisite that by itself grants nothing.
 */

import type { RoleName, RoleGrantStatus } from '@sync/shared/contracts';

export interface GrantFacts {
  id: string;
  role: RoleName;
  /** municipalities.code, or null for a platform-wide super_admin grant. */
  spaceId: string | null;
  status: RoleGrantStatus;
}

export interface AuthzFacts {
  /** The caller's live grant for the requested (role, space), or null. */
  grant: GrantFacts | null;
  /**
   * Phase 5 always passes `true` — there is no billing table yet. Phase 6
   * replaces the constant in require-role.ts with a real lookup. Tests pass
   * `false` here today to prove the composition already denies.
   */
  billingActive: boolean;
}

export type DenyReason =
  | 'no_grant'
  | 'grant_suspended'
  | 'grant_revoked'
  | 'billing_inactive';

export type AuthzDecision =
  | { allowed: true; grant: GrantFacts }
  | { allowed: false; reason: DenyReason };

type Requirement = (facts: AuthzFacts) => DenyReason | null;

/** ALL must hold. Phase 6 appends; it does not rewrite. Order = report order. */
export const AUTHZ_REQUIREMENTS: readonly Requirement[] = [
  (f) => (f.grant ? null : 'no_grant'),
  (f) => (f.grant?.status === 'suspended' ? 'grant_suspended' : null),
  (f) => (f.grant?.status === 'revoked' ? 'grant_revoked' : null),
  (f) => (f.billingActive ? null : 'billing_inactive'),
];

export function evaluateAuthorization(facts: AuthzFacts): AuthzDecision {
  for (const requirement of AUTHZ_REQUIREMENTS) {
    const denial = requirement(facts);
    if (denial) return { allowed: false, reason: denial };
  }
  // Unreachable unless the first requirement is removed.
  return facts.grant
    ? { allowed: true, grant: facts.grant }
    : { allowed: false, reason: 'no_grant' };
}

// === Reviewer scope ======================================================

export type ReviewAction = 'approve' | 'reject' | 'suspend' | 'reinstate' | 'revoke';

/** Roles that may only ever be acted on by a super_admin. */
const ADMIN_TIER_ROLES: readonly RoleName[] = ['super_admin', 'space_admin'];

export interface ReviewerFacts {
  /** Every grant the actor holds, whatever its status. */
  actorGrants: GrantFacts[];
  /** Space the reviewed object belongs to (a municipalities.code). */
  targetSpaceId: string;
  /** Role of the grant being acted on; null when the target is an application. */
  targetRole: RoleName | null;
}

/**
 * PHASE DECISION (resolves 05-RESEARCH.md Open Question 1):
 *
 *   super_admin  — every action, every space, every target role.
 *   space_admin  — every action, but only inside its OWN space, and only
 *                  against community_manager targets (or an application,
 *                  targetRole === null).
 *
 * Rationale: ROADMAP criterion 3 says "an admin ... can approve, reject, or
 * suspend" without naming a tier, and issue #79's "super admins may suspend
 * independently of billing" asserts super-admin capability, not exclusivity. A
 * space admin who can approve but cannot suspend within their own space cannot
 * undo their own decision, which is operationally indefensible. The asymmetry
 * that remains is the one issue #79 actually implies: acting on an ADMIN-tier
 * grant is super_admin-only, so space admins cannot neutralize each other.
 */
export function canReview(facts: ReviewerFacts, _action: ReviewAction): boolean {
  const live = facts.actorGrants.filter((g) => g.status === 'active');

  if (live.some((g) => g.role === 'super_admin')) return true;

  if (facts.targetRole !== null && ADMIN_TIER_ROLES.includes(facts.targetRole)) {
    return false;
  }

  return live.some(
    (g) => g.role === 'space_admin' && g.spaceId === facts.targetSpaceId
  );
}
