/**
 * Use-case: list votes, optionally filtered by municipality/status.
 */

import type { ResultAsync } from 'neverthrow';
import {
  listVotes as repoListVotes,
  listActiveVotesWithOptions,
} from '@/server/infra/supabase/vote.repo';
import {
  toVoteDto,
  toVoteOptionDto,
  type VoteDto,
  type VoteOptionDto,
} from '@/server/domain/votes/vote';
import type { AppError } from '@/server/http/errors';

export interface ListVotesQuery {
  municipality?: string;
  status?: 'pending' | 'active' | 'ended';
  /** Include option tallies — supported for active votes only. */
  includeOptions?: boolean;
}

export function listVotes(
  query: ListVotesQuery
): ResultAsync<{ votes: (VoteDto & { options?: VoteOptionDto[] })[] }, AppError> {
  if (query.includeOptions && (query.status ?? 'active') === 'active') {
    return listActiveVotesWithOptions(query.municipality).map((rows) => ({
      votes: rows.map((row) => ({
        ...toVoteDto(row),
        options: row.options.map((option) => toVoteOptionDto(option)),
      })),
    }));
  }
  return repoListVotes(query).map((rows) => ({ votes: rows.map(toVoteDto) }));
}
