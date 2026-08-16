import 'server-only';

/**
 * Permitted-content controls: hide, unhide, flag, unflag (SPACE-06).
 *
 * These live on the server as their own use-case even though their UI is a
 * panel inside the proposals surface rather than a route of its own - the
 * locked decision was "no seventh route", which is a statement about the URL
 * space, not about where authority is checked.
 *
 * `prior_state` and `new_state` both carry the *whole* moderation state rather
 * than the single field that moved. An audit row reading `{ hidden: true }`
 * alone cannot answer "was it also flagged at the time?", and that is exactly
 * the question a reviewer reads the log to answer.
 */

import type { ResultAsync } from 'neverthrow';
import type { ContentAction, ModerateContentRequest } from '@sync/shared/contracts';
import { authorize } from '@/server/app/space-admin/authorize';
import type { AppError } from '@/server/http/errors';
import { insertAuditRow } from '@/server/infra/supabase/space-audit.repo';
import {
  setContentModeration,
  type ModeratedContentRow,
} from '@/server/infra/supabase/space-member.repo';
import type { Session } from '@/services/auth/session';

/**
 * A type alias rather than an interface, deliberately: the audit row's
 * `prior_state`/`new_state` are typed `Json`, and TypeScript grants an implicit
 * index signature to object type aliases but not to interfaces. Declaring this
 * an interface makes the audit write a compile error.
 */
export type ModerationState = {
  hidden: boolean;
  flagged: boolean;
};

export interface ContentMutationResult extends ModerationState {
  proposalId: string;
}

const AUDIT_ACTIONS: Record<ContentAction, string> = {
  hide: 'content.hidden',
  unhide: 'content.unhidden',
  flag: 'content.flagged',
  unflag: 'content.unflagged',
};

const stateOf = (row: ModeratedContentRow): ModerationState => ({
  hidden: row.hidden_at !== null,
  flagged: row.flagged_at !== null,
});

/**
 * The write was conditional on the field not already being in its target
 * state, so the field it touched is known to have flipped and the prior state
 * is the new one with that field inverted. No second read, and therefore no
 * window in which another admin's change could be recorded as this one's
 * starting point.
 */
const priorStateOf = (action: ContentAction, next: ModerationState): ModerationState =>
  action === 'hide' || action === 'unhide'
    ? { ...next, hidden: !next.hidden }
    : { ...next, flagged: !next.flagged };

export function moderateContent(
  session: Session,
  rawSpaceId: string,
  voteId: string,
  command: ModerateContentRequest
): ResultAsync<ContentMutationResult, AppError> {
  return authorize(session, rawSpaceId, 'content.moderate').andThen((scope) =>
    setContentModeration(scope, voteId, command.action).andThen((row) => {
      const next = stateOf(row);

      return insertAuditRow({
        space_id: scope.spaceId,
        actor_user_id: scope.userId,
        action: AUDIT_ACTIONS[command.action],
        object_type: 'content',
        object_id: row.id,
        prior_state: priorStateOf(command.action, next),
        new_state: next,
        reason: command.reason,
      }).map(() => ({ proposalId: row.id, ...next }));
    })
  );
}
