/**
 * THE server-side authorization helper (RBAC-02).
 *
 * Every privileged route reaches authorization through this module and nothing
 * else. Authorization is never inferred client-side and never derived from
 * payment state: `requireRole` reads role_grants only.
 *
 * PHASE 6 CONTRACT: the billing prerequisite is added by replacing the
 * `billingActive` constant below with a repository call. No signature here and
 * no call site anywhere changes. Do not "optimize" that constant away.
 */

import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import type { RoleName } from '@sync/shared/contracts';
import {
  canReview,
  evaluateAuthorization,
  type GrantFacts,
  type ReviewAction,
} from '@/server/domain/authz/policy';
import { findLiveGrant, listActiveGrants } from '@/server/infra/supabase/role.repo';
import { forbidden, type AppError } from '@/server/http/errors';
import type { RoleGrant } from '@/lib/supabase/types';

export function toGrantFacts(row: RoleGrant): GrantFacts {
  return {
    id: row.id,
    role: row.role,
    spaceId: row.space_id,
    status: row.status,
  };
}

/**
 * Phase 5: no billing table exists, so this is a stable `true`.
 * Phase 6: replace with `hasActiveSubscription(userId, role, spaceId)`.
 */
function billingRequirementSatisfied(
  _userId: string,
  _role: RoleName,
  _spaceId: string | null
): ResultAsync<boolean, AppError> {
  return okAsync(true);
}

/** The one enforcement point. */
export function requireRole(
  userId: string,
  role: RoleName,
  spaceId: string | null
): ResultAsync<GrantFacts, AppError> {
  return findLiveGrant(userId, role, spaceId).andThen((row) =>
    billingRequirementSatisfied(userId, role, spaceId).andThen((billingActive) => {
      const decision = evaluateAuthorization({
        grant: row ? toGrantFacts(row) : null,
        billingActive,
      });
      return decision.allowed
        ? okAsync<GrantFacts, AppError>(decision.grant)
        : errAsync<GrantFacts, AppError>(forbidden(decision.reason));
    })
  );
}

export interface ReviewerAuthority {
  actorUserId: string;
  actorRole: 'super_admin' | 'space_admin';
  grant: GrantFacts;
}

/**
 * Admin-review authorization, composed from requireRole. super_admin first
 * (platform-wide), then space_admin scoped to the target space.
 *
 * A non-FORBIDDEN failure (a DB error) propagates instead of falling through -
 * a database outage must surface as 500, never as a spurious 403.
 */
export function requireReviewAuthority(
  userId: string,
  target: { spaceId: string; targetRole: RoleName | null; action: ReviewAction }
): ResultAsync<ReviewerAuthority, AppError> {
  return requireRole(userId, 'super_admin', null)
    .map<ReviewerAuthority>((grant) => ({
      actorUserId: userId,
      actorRole: 'super_admin',
      grant,
    }))
    .orElse((error) => {
      if (error.kind !== 'FORBIDDEN') return errAsync<ReviewerAuthority, AppError>(error);
      return requireRole(userId, 'space_admin', target.spaceId).andThen((grant) =>
        canReview(
          {
            actorGrants: [grant],
            targetSpaceId: target.spaceId,
            targetRole: target.targetRole,
          },
          target.action
        )
          ? okAsync<ReviewerAuthority, AppError>({
              actorUserId: userId,
              actorRole: 'space_admin',
              grant,
            })
          : errAsync<ReviewerAuthority, AppError>(forbidden('insufficient_scope'))
      );
    });
}

export type AdminScope =
  | { kind: 'platform' }
  | { kind: 'spaces'; spaceIds: string[] };

/** Which review queue may this actor see? Denies when the actor is no admin. */
export function requireAdminScope(userId: string): ResultAsync<AdminScope, AppError> {
  return listActiveGrants(userId).andThen((rows) => {
    if (rows.some((r) => r.role === 'super_admin')) {
      return okAsync<AdminScope, AppError>({ kind: 'platform' });
    }
    const spaceIds = rows
      .filter((r) => r.role === 'space_admin' && r.space_id !== null)
      .map((r) => r.space_id as string);
    return spaceIds.length > 0
      ? okAsync<AdminScope, AppError>({ kind: 'spaces', spaceIds })
      : errAsync<AdminScope, AppError>(forbidden('no_admin_grant'));
  });
}
