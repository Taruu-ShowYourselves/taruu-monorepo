/**
 * Use-case: a reader setting a topic aside as not a matter of consensus.
 *
 * The desk's third gesture. It is not a ballot and this module is careful to
 * keep it from becoming one — nothing here touches points, tallies, GPS or the
 * chain, and the read it returns is a count plus the caller's own standing,
 * never a list of who said what.
 *
 * Unlike a vote, this does not require a verified resident. A reader who has
 * not proved where they live can still say a question does not belong on a
 * public desk; that judgement is about the question, not about their standing
 * to answer it. Requiring residency here would mean the only people who can
 * report a bad topic are the people entitled to vote on it.
 */

import { errAsync, ResultAsync } from 'neverthrow';
import type { SetAsideReason, TopicAsideStanding } from '@sync/shared/contracts';
import {
  asideStanding,
  removeSetAside,
  topicExists,
  upsertSetAside,
} from '@/server/infra/supabase/topic-feedback.repo';
import { notFound, type AppError } from '@/server/http/errors';

function readBack(
  voteId: string,
  userId: string | null
): ResultAsync<TopicAsideStanding, AppError> {
  return asideStanding(voteId, userId).map((row) => ({
    topicId: voteId,
    asideCount: row.asideCount,
    ownReason: row.ownReason,
  }));
}

/** Public read: the count, plus the caller's own reason if they are signed in. */
export function topicAsideStanding(
  voteId: string,
  viewerId: string | null
): ResultAsync<TopicAsideStanding, AppError> {
  return topicExists(voteId).andThen((exists) =>
    exists ? readBack(voteId, viewerId) : errAsync(notFound('topic'))
  );
}

export function setTopicAside(
  voteId: string,
  userId: string,
  reason: SetAsideReason
): ResultAsync<TopicAsideStanding, AppError> {
  return topicExists(voteId).andThen((exists) =>
    exists
      ? upsertSetAside({ voteId, userId, reason }).andThen(() =>
          readBack(voteId, userId)
        )
      : errAsync(notFound('topic'))
  );
}

/** A reader putting the topic back on their desk. */
export function restoreTopic(
  voteId: string,
  userId: string
): ResultAsync<TopicAsideStanding, AppError> {
  return topicExists(voteId).andThen((exists) =>
    exists
      ? removeSetAside(voteId, userId).andThen(() => readBack(voteId, userId))
      : errAsync(notFound('topic'))
  );
}
