import 'server-only';

/**
 * Member suspension and reinstatement (SPACE-09).
 *
 * Both sides are `member.suspend`: reinstating is the inverse of suspending,
 * not a separate authority, and a second capability would let an admin lock a
 * member out with no power to let them back in.
 *
 * Neither path deletes anything. Suspension sets a nullable column on the
 * suspension record and on the member's active grants; reinstatement clears
 * them again. The member's audit history is untouched by both, which is the
 * property SPACE-09 is actually about - the acceptance criterion is not "access
 * stops" but "access stops and the record survives".
 */

import type { ResultAsync } from 'neverthrow';
import type { ReinstateMemberRequest, SuspendMemberRequest } from '@sync/shared/contracts';
import { authorize } from '@/server/app/space-admin/authorize';
import type { AppError } from '@/server/http/errors';
import { insertAuditRow } from '@/server/infra/supabase/space-audit.repo';
import {
  insertMemberSuspension,
  liftMemberSuspension,
} from '@/server/infra/supabase/space-member.repo';
import type { Session } from '@/services/auth/session';

export interface MembershipMutationResult {
  userId: string;
  suspended: boolean;
}

export function suspendMember(
  session: Session,
  rawSpaceId: string,
  command: SuspendMemberRequest
): ResultAsync<MembershipMutationResult, AppError> {
  return authorize(session, rawSpaceId, 'member.suspend').andThen((scope) =>
    insertMemberSuspension(scope, {
      userId: command.userId,
      reason: command.reason,
    }).andThen(() =>
      insertAuditRow({
        space_id: scope.spaceId,
        actor_user_id: scope.userId,
        action: 'member.suspended',
        object_type: 'member',
        object_id: command.userId,
        prior_state: { suspended: false },
        new_state: { suspended: true },
        reason: command.reason,
      }).map(() => ({ userId: command.userId, suspended: true }))
    )
  );
}

export function reinstateMember(
  session: Session,
  rawSpaceId: string,
  command: ReinstateMemberRequest
): ResultAsync<MembershipMutationResult, AppError> {
  return authorize(session, rawSpaceId, 'member.suspend').andThen((scope) =>
    liftMemberSuspension(scope, { userId: command.userId }).andThen(() =>
      insertAuditRow({
        space_id: scope.spaceId,
        actor_user_id: scope.userId,
        action: 'member.reinstated',
        object_type: 'member',
        object_id: command.userId,
        prior_state: { suspended: true },
        new_state: { suspended: false },
        reason: command.reason,
      }).map(() => ({ userId: command.userId, suspended: false }))
    )
  );
}
