/**
 * Use-case: municipality civic profile - metrics + open/closed votes.
 */

import { errAsync, ResultAsync } from 'neverthrow';
import { MUNICIPALITIES, KNESSET_SCOPE } from '@sync/shared';
import type { MunicipalityProfileResponse } from '@sync/shared/contracts';
import { getMunicipalityProfile as dbGetMunicipalityProfile } from '@/lib/supabase/db';
import { dbError, notFound, type AppError } from '@/server/http/errors';

export function isKnownMunicipality(name: string): boolean {
  return (
    name === KNESSET_SCOPE || (MUNICIPALITIES as readonly string[]).includes(name)
  );
}

export function getMunicipalityProfile(
  rawName: string
): ResultAsync<MunicipalityProfileResponse, AppError> {
  const municipality = decodeURIComponent(rawName ?? '').trim();
  if (!municipality || !isKnownMunicipality(municipality)) {
    return errAsync(notFound('Municipality'));
  }
  return ResultAsync.fromPromise(dbGetMunicipalityProfile(municipality), (cause) =>
    dbError('municipality.profile', cause)
  ).map((profile) => ({ municipality, ...profile }));
}
