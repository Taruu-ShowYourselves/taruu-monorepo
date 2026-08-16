import 'server-only';

/**
 * Audit history (Surface 6) - the read half of SPACE-04.
 *
 * One capability, `audit.read`, and one repository call that will not run
 * without the scope it mints. The page carries `rows`, `nextCursor` and
 * `truncated`, and nothing else: counting an append-only log that is written
 * continuously is expensive and stale by the time it arrives, so the surface
 * reports how many records it is showing rather than how many exist.
 *
 * Offset paging is not offered at any layer. New entries land at the head of
 * the sort order while an admin reads, so page two by offset would repeat rows
 * it already showed and skip rows it never will.
 */

import { err, errAsync, ok, type Result, type ResultAsync } from 'neverthrow';
import { z } from 'zod';
import type { AuditPage, AuditRow } from '@sync/shared/contracts';
import type { SpaceAuditRow } from '@/lib/supabase/types';
import { authorize } from '@/server/app/space-admin/authorize';
import { validation, type AppError } from '@/server/http/errors';
import {
  listAuditRows,
  type AuditRowWithActor,
} from '@/server/infra/supabase/space-audit.repo';
import type { Session } from '@/services/auth/session';

/**
 * The seven values the `object_type` CHECK admits. Declared here because the
 * contract types the field as a plain string, and a filter accepting anything
 * else would be a query that matches nothing rather than an error. The
 * annotation is what keeps this honest - drifting from the column's own union
 * is a compile error here, not a silently empty page in production.
 */
const AUDIT_OBJECT_TYPES = [
  'vote',
  'grant',
  'space',
  'member',
  'notification_campaign',
  'content',
  'escalation',
] as const satisfies readonly SpaceAuditRow['object_type'][];

/**
 * Deliberately above the repository's hard page cap. A caller asking for more
 * than the cap should be served the cap and told it was capped, which is what
 * `truncated` is for; rejecting the request outright would turn a UI detail
 * into a 400.
 */
const AUDIT_REQUEST_MAX = 500;

export const AuditListQuerySchema = z.object({
  objectType: z.enum(AUDIT_OBJECT_TYPES).optional(),
  actor: z.string().uuid().optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(AUDIT_REQUEST_MAX).optional(),
});

export type AuditListQuery = z.infer<typeof AuditListQuerySchema>;

/** Hebrew-only product, so an actor with no stored name still needs a label. */
const ACTOR_FALLBACK_HE = 'מנהל/ת מרחב';

const displayName = (first: string | null, last: string | null): string =>
  [first, last].filter((part): part is string => Boolean(part && part.trim())).join(' ') ||
  ACTOR_FALLBACK_HE;

/**
 * The keyset the repository pages on is `${created_at}|${id}`. It is wrapped in
 * base64url before it leaves the server so the client handles one opaque,
 * URL-safe token instead of two internal column values it might be tempted to
 * construct itself.
 */
const encodeCursor = (keyset: string): string =>
  Buffer.from(keyset, 'utf8').toString('base64url');

const decodeCursor = (cursor: string | undefined): Result<string | undefined, AppError> => {
  if (cursor === undefined) return ok(undefined);
  const keyset = Buffer.from(cursor, 'base64url').toString('utf8');
  // Anything that does not decode back to the keyset shape is a client bug, and
  // is reported as one. It is checked after authorization, so an unauthorized
  // space still answers 403 whatever the cursor looks like.
  return keyset.includes('|')
    ? ok(keyset)
    : err(validation(['cursor: not a valid pagination cursor']));
};

/**
 * The actor's name arrives with the row. `listAuditRows` embeds
 * `users(first_name, last_name)` through the `actor_user_id` foreign key, so a
 * page of any size costs one round trip and never one per row.
 */
const toAuditRow = (row: AuditRowWithActor): AuditRow => ({
  id: row.id,
  createdAt: row.created_at,
  actorId: row.actor_user_id,
  actorDisplayName: displayName(row.actor_first_name, row.actor_last_name),
  action: row.action,
  objectType: row.object_type,
  objectId: row.object_id,
  priorState: row.prior_state,
  newState: row.new_state,
  reason: row.reason,
});

export function listSpaceAudit(
  session: Session,
  rawSpaceId: string,
  filter: AuditListQuery
): ResultAsync<AuditPage, AppError> {
  return authorize(session, rawSpaceId, 'audit.read').andThen((scope) => {
    const cursor = decodeCursor(filter.cursor);
    if (cursor.isErr()) return errAsync<AuditPage, AppError>(cursor.error);

    return listAuditRows(scope, {
      objectType: filter.objectType,
      actorId: filter.actor,
      cursor: cursor.value,
      limit: filter.limit,
    }).map((page) => ({
      rows: page.rows.map(toAuditRow),
      nextCursor: page.nextCursor === null ? null : encodeCursor(page.nextCursor),
      truncated: page.truncated,
    }));
  });
}
