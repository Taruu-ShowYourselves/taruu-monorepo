/**
 * Use-case: a citizen's review of a sitting Knesset member.
 *
 * The member is addressed by slug, never by database id, because the slug is
 * what the page's URL carries and resolving it here keeps the route handler
 * free of any knowledge of the roster's shape.
 *
 * The residency rule - only a placed citizen may review - is enforced by a
 * trigger on the table rather than here. This layer would have to read the
 * user row and then write, and between those two statements the claim can
 * change; the trigger runs inside the same statement as the insert.
 */

import { errAsync, ResultAsync } from 'neverthrow';
import type { SubmitGovReviewRequest } from '@sync/shared/contracts';
import {
  findPersonIdBySlug,
  retractMemberReview,
  upsertMemberReview,
} from '@/server/infra/supabase/government.repo';
import { memberReviews, type MemberReviewsRead } from '@/server/read/government';
import { forbidden, notFound, type AppError } from '@/server/http/errors';

export interface MemberReviewResponse extends MemberReviewsRead {
  personId: number;
}

/** The trigger's own words, surfaced as a 403 rather than a 500. */
const NOT_A_PLACED_CITIZEN = 'requires a citizen with a verified authority';

function readBack(
  personId: number,
  userId: string | null
): ResultAsync<MemberReviewResponse, AppError> {
  return ResultAsync.fromSafePromise(memberReviews(personId, userId)).map(
    (read) => ({ personId, ...read })
  );
}

export function submitMemberReview(
  slug: string,
  userId: string,
  input: SubmitGovReviewRequest
): ResultAsync<MemberReviewResponse, AppError> {
  return findPersonIdBySlug(decodeURIComponent(slug).trim()).andThen((personId) => {
    if (personId === null) return errAsync(notFound('Knesset member'));

    return upsertMemberReview({
      personId,
      userId,
      rating: input.rating,
      body: input.body ?? null,
    })
      .mapErr((error): AppError =>
        error.kind === 'DB' && error.cause?.includes(NOT_A_PLACED_CITIZEN)
          ? forbidden('רק תושב מאומת יכול לדרג נבחר ציבור')
          : error
      )
      .andThen(() => readBack(personId, userId));
  });
}

export function withdrawMemberReview(
  slug: string,
  userId: string
): ResultAsync<MemberReviewResponse, AppError> {
  return findPersonIdBySlug(decodeURIComponent(slug).trim()).andThen((personId) => {
    if (personId === null) return errAsync(notFound('Knesset member'));
    return retractMemberReview(personId, userId).andThen(() =>
      readBack(personId, userId)
    );
  });
}

/** Public read: published reviews, plus the viewer's own row if they have one. */
export function listMemberReviews(
  slug: string,
  viewerId: string | null
): ResultAsync<MemberReviewResponse, AppError> {
  return findPersonIdBySlug(decodeURIComponent(slug).trim()).andThen((personId) =>
    personId === null
      ? errAsync(notFound('Knesset member'))
      : readBack(personId, viewerId)
  );
}
