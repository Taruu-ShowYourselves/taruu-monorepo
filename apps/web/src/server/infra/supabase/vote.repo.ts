/**
 * Vote repository - Result-typed access to the votes/vote_options tables.
 *
 * Delegates to the db.ts query helpers (single query surface, mockable in
 * tests) and converts their throw/null conventions into explicit Results.
 */

import { ResultAsync } from 'neverthrow';
import {
  getActiveVotes,
  getActiveVotesWithOptions,
  getVotesByMunicipality,
  createVote as dbCreateVote,
  createVoteOptions as dbCreateVoteOptions,
} from '@/lib/supabase/db';
import type {
  Vote,
  VoteOption,
  VoteSource,
  InsertTables,
} from '@/lib/supabase/types';
import type { PublicVoteStatus } from '@/server/domain/votes/vote';
import { dbError, type AppError } from '@/server/http/errors';

export function listVotes(filter: {
  municipality?: string;
  status?: PublicVoteStatus;
}): ResultAsync<Vote[], AppError> {
  const query = filter.municipality
    ? getVotesByMunicipality(filter.municipality, filter.status)
    : getActiveVotes();
  return ResultAsync.fromPromise(query, (cause) => dbError('votes.list', cause));
}

/** Active votes with option tallies + source engagement (list views). */
export function listActiveVotesWithOptions(
  municipality?: string
): ResultAsync<
  (Vote & { options: VoteOption[]; source: VoteSource | null })[],
  AppError
> {
  return ResultAsync.fromPromise(getActiveVotesWithOptions(municipality), (cause) =>
    dbError('votes.listWithOptions', cause)
  );
}

export function insertVote(row: InsertTables<'votes'>): ResultAsync<Vote, AppError> {
  return ResultAsync.fromPromise(dbCreateVote(row), (cause) =>
    dbError('votes.insert', cause)
  );
}

export function insertVoteOptions(
  rows: InsertTables<'vote_options'>[]
): ResultAsync<VoteOption[], AppError> {
  return ResultAsync.fromPromise(dbCreateVoteOptions(rows), (cause) =>
    dbError('vote_options.insert', cause)
  );
}
