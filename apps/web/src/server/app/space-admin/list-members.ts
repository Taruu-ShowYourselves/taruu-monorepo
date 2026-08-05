import 'server-only';

/**
 * The members surface (Surface 3).
 *
 * The single export is `getSpaceMembers`, deliberately **not** the repository's
 * name for the same idea. `listSpaceMembers` already belongs to
 * `infra/supabase/space-member.repo.ts`, and two functions sharing one name
 * across the app and infra layers is precisely how a Server Component ends up
 * importing the repository and reaching the database with no authorization
 * call in front of it. There is one name for the authorized read, it is this
 * one, and every consumer imports it.
 *
 * The response is assembled from the seven-column allow-list and is narrower
 * still than what was read: names become a display name, and the verification
 * timestamp becomes a boolean. The surface copy promises identity documents are
 * unreachable from this dashboard; that promise is kept here and in the
 * repository's column list, not by the client choosing what to render.
 */

import type { ResultAsync } from 'neverthrow';
import { z } from 'zod';
import type { SpaceMember, SpaceMemberListResponse } from '@sync/shared/contracts';
import { authorize } from '@/server/app/space-admin/authorize';
import type { Capability } from '@/server/domain/space/capability';
import type { AppError } from '@/server/http/errors';
import {
  countSpaceMembers,
  listActiveMemberSuspensions,
  listGrantsForSpace,
  listSpaceMembers,
  type MemberRow,
} from '@/server/infra/supabase/space-member.repo';
import type { Session } from '@/services/auth/session';

/**
 * Declared here rather than read off the repository so the schema keeps its
 * bounds when a test replaces that module wholesale.
 */
const MEMBER_LIMIT_MAX = 200;

export const MemberListQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(MEMBER_LIMIT_MAX).optional(),
  cursor: z.string().min(1).optional(),
});

export type MemberListQuery = z.infer<typeof MemberListQuerySchema>;

/** Hebrew-only product, so an unnamed member still needs a Hebrew label. */
const MEMBER_FALLBACK_HE = 'תושב/ת';

const toDisplayName = (row: MemberRow): string =>
  [row.first_name, row.last_name]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(' ') || MEMBER_FALLBACK_HE;

const groupCapabilities = (
  rows: ReadonlyArray<{ user_id: string; capability: Capability }>
): Map<string, Capability[]> => {
  const grouped = new Map<string, Capability[]>();
  for (const row of rows) {
    const existing = grouped.get(row.user_id);
    if (existing) existing.push(row.capability);
    else grouped.set(row.user_id, [row.capability]);
  }
  return grouped;
};

export function getSpaceMembers(
  session: Session,
  rawSpaceId: string,
  filter: MemberListQuery
): ResultAsync<SpaceMemberListResponse, AppError> {
  return authorize(session, rawSpaceId, 'member.read').andThen((scope) =>
    listSpaceMembers(scope, filter).andThen((rows) => {
      const userIds = rows.map((row) => row.id);

      // Two batched lookups for the whole page rather than two per row: the
      // table renders fifty members at a time and an N+1 here would be felt.
      return listGrantsForSpace(scope, userIds).andThen((grants) =>
        listActiveMemberSuspensions(scope, userIds).andThen((suspensions) =>
          countSpaceMembers(scope).map((total): SpaceMemberListResponse => {
            const capabilities = groupCapabilities(grants);
            const suspended = new Set(suspensions.map((row) => row.user_id));

            const members: SpaceMember[] = rows.map((row) => ({
              id: row.id,
              displayName: toDisplayName(row),
              municipality: row.municipality_id ?? scope.municipalityCode,
              joinedAt: row.created_at,
              verificationStatus: row.verification_status,
              // A boolean, never the timestamp: *when* someone was verified is
              // more than administration needs and points at the document.
              identityVerified: Boolean(row.identity_verified_at),
              suspended: suspended.has(row.id),
              capabilities: capabilities.get(row.id) ?? [],
            }));

            return { members, total };
          })
        )
      );
    })
  );
}
