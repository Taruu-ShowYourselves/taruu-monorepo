/**
 * Vote repository — Result-typed access to the votes/vote_options tables.
 *
 * Delegates to the db.ts query helpers (single query surface, mockable in
 * tests) and converts their throw/null conventions into explicit Results.
 */

import { ResultAsync } from 'neverthrow';
import {
  getActiveVotes,
  getVotesByMunicipality,
  createVote as dbCreateVote,
  createVoteOptions as dbCreateVoteOptions,
} from '@/lib/supabase/db';
import type { Vote, VoteOption, InsertTables } from '@/lib/supabase/types';
import { dbError, type AppError } from '@/server/http/errors';

type VoteStatus = 'pending' | 'active' | 'ended';

export function listVotes(filter: {
  municipality?: string;
  status?: VoteStatus;
}): ResultAsync<Vote[], AppError> {
  const query = filter.municipality
    ? getVotesByMunicipality(filter.municipality, filter.status)
    : getActiveVotes();
  return ResultAsync.fromPromise(query, (cause) => dbError('votes.list', cause));
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
