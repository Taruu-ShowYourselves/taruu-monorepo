import 'server-only';

/**
 * Capability grants: create, revoke, and the platform-admin suspension.
 *
 * The first two follow the phase's audited-mutation chain - resolve a scope,
 * perform one conditional write, append the audit row inside the same chain,
 * and only then map to a response. The audit write is not a side effect fired
 * after success; it is a link in the chain, so a failed append fails the
 * request rather than leaving an unrecorded change behind.
 *
 * The third is different on purpose, and its own comment explains why.
 */

import { errAsync, okAsync, type ResultAsync } from 'neverthrow';
import { z } from 'zod';
import type {
  GrantCapabilityRequest,
  RevokeCapabilityRequest,
  SuspendGrantRequest,
} from '@sync/shared/contracts';
import { authorize } from '@/server/app/space-admin/authorize';
import type { Capability } from '@/server/domain/space/capability';
import { forbidden, type AppError } from '@/server/http/errors';
import { insertAuditRow } from '@/server/infra/supabase/space-audit.repo';
import {
  insertGrant,
  isPlatformAdmin,
  revokeGrant,
  suspendGrantById,
  type GrantRecord,
} from '@/server/infra/supabase/space-member.repo';
import type { Session } from '@/services/auth/session';

export interface GrantMutationResult {
  grantId: string;
  userId: string;
  capability: Capability;
  /** False once the grant is revoked or suspended - the row itself remains. */
  active: boolean;
}

const SpaceIdSchema = z.string().uuid();

const toResult = (grant: GrantRecord, active: boolean): GrantMutationResult => ({
  grantId: grant.id,
  userId: grant.user_id,
  capability: grant.capability,
  active,
});

export function grantCapability(
  session: Session,
  rawSpaceId: string,
  command: GrantCapabilityRequest
): ResultAsync<GrantMutationResult, AppError> {
  return authorize(session, rawSpaceId, 'grant.create').andThen((scope) =>
    insertGrant(scope, {
      userId: command.userId,
      capability: command.capability,
      grantedViaRole: command.grantedViaRole ?? null,
    }).andThen((grant) =>
      insertAuditRow({
        space_id: scope.spaceId,
        actor_user_id: scope.userId,
        action: 'grant.created',
        object_type: 'grant',
        object_id: grant.id,
        prior_state: null,
        new_state: {
          capability: command.capability,
          grantedViaRole: command.grantedViaRole ?? null,
        },
        reason: command.reason,
      }).map(() => toResult(grant, true))
    )
  );
}

export function revokeCapability(
  session: Session,
  rawSpaceId: string,
  command: RevokeCapabilityRequest
): ResultAsync<GrantMutationResult, AppError> {
  return authorize(session, rawSpaceId, 'grant.revoke').andThen((scope) =>
    revokeGrant(scope, { userId: command.userId, capability: command.capability }).andThen(
      (grant) =>
        insertAuditRow({
          space_id: scope.spaceId,
          actor_user_id: scope.userId,
          action: 'grant.revoked',
          object_type: 'grant',
          object_id: grant.id,
          prior_state: { capability: command.capability, active: true },
          new_state: { capability: command.capability, active: false },
          reason: command.reason,
        }).map(() => toResult(grant, false))
    )
  );
}

/**
 * SPACE-09's super-admin action, and the one mutation in the phase that is not
 * capability-gated.
 *
 * It resolves no scope, because a platform admin holds no grant in the space
 * they are acting on. Minting one for them would manufacture the cross-space
 * wildcard the CONTEXT decision rejected: a token that opens every scoped
 * repository in the codebase, handed to a bearer whose authority is supposed to
 * be exactly one action wide. `users.is_platform_admin` is that one action's
 * gate and confers nothing else - it is not a general admin boolean, and eleven
 * space capabilities do not add up to it.
 *
 * A denial here returns the same reason-free `forbidden()` as everywhere else,
 * so a non-admin cannot learn whether the grant or the space exists. The audit
 * row still lands in the target space's log with the platform admin as actor:
 * the space's own admins must be able to see that their authority was changed
 * and by whom.
 */
export function suspendGrantAsPlatformAdmin(
  session: Session,
  rawSpaceId: string,
  command: SuspendGrantRequest
): ResultAsync<GrantMutationResult, AppError> {
  const spaceId = SpaceIdSchema.safeParse(rawSpaceId);
  if (!spaceId.success) return errAsync(forbidden());

  return isPlatformAdmin(session.userId)
    .andThen((platformAdmin) =>
      platformAdmin ? okAsync(spaceId.data) : errAsync<string, AppError>(forbidden())
    )
    .andThen((space) =>
      suspendGrantById(space, command.grantId, session.userId).andThen((grant) =>
        insertAuditRow({
          space_id: space,
          actor_user_id: session.userId,
          action: 'grant.suspended',
          object_type: 'grant',
          object_id: grant.id,
          prior_state: { capability: grant.capability, active: true },
          new_state: { capability: grant.capability, active: false },
          reason: command.reason,
        }).map(() => toResult(grant, false))
      )
    );
}
