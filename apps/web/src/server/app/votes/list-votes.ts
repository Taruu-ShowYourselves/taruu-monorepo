/**
 * Use-case: list votes, optionally filtered by municipality/status.
 */

import type { ResultAsync } from 'neverthrow';
import { listVotes as repoListVotes } from '@/server/infra/supabase/vote.repo';
import {
  toVoteDto,
  type VoteDto,
  type PublicVoteStatus,
} from '@/server/domain/votes/vote';
import type { AppError } from '@/server/http/errors';

export interface ListVotesQuery {
  municipality?: string;
  status?: PublicVoteStatus;
}

export function listVotes(
  query: ListVotesQuery
): ResultAsync<{ votes: VoteDto[] }, AppError> {
  return repoListVotes(query).map((rows) => ({ votes: rows.map(toVoteDto) }));
}
