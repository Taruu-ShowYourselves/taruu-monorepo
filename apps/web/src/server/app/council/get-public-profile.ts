import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import type { PublicCouncilProfile } from '@sync/shared/contracts';
import { getPublicCouncilAggregate } from '@/lib/supabase/db';
import { isCouncilPublicPagesEnabled } from '@/lib/features/council-public-pages';
import { buildPublicCouncilProfile } from '@/server/domain/council/public-profile';
import { dbError, notFound, type AppError } from '@/server/http/errors';

export function getPublicCouncilProfile(
  rawIdentifier: string,
  locale = 'he'
): ResultAsync<PublicCouncilProfile, AppError> {
  if (!isCouncilPublicPagesEnabled()) {
    return errAsync(notFound('Council'));
  }

  let identifier: string;
  try {
    identifier = decodeURIComponent(rawIdentifier ?? '').trim();
  } catch {
    return errAsync(notFound('Council'));
  }

  if (!identifier || identifier.length > 160) {
    return errAsync(notFound('Council'));
  }

  return ResultAsync.fromPromise(
    getPublicCouncilAggregate(identifier),
    (cause) => dbError('council.public-profile', cause)
  ).andThen((row) =>
    row
      ? okAsync(buildPublicCouncilProfile(row, locale))
      : errAsync(notFound('Council'))
  );
}
