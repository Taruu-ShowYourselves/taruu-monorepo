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
  toVoteSourceDto,
  type VoteDto,
  type VoteOptionDto,
  type VoteSourceDto,
  type PublicVoteStatus,
} from '@/server/domain/votes/vote';
import type { AppError } from '@/server/http/errors';

export interface ListVotesQuery {
  municipality?: string;
  status?: PublicVoteStatus;
  /** Include option tallies - supported for active votes only. */
  includeOptions?: boolean;
}

export function listVotes(
  query: ListVotesQuery
): ResultAsync<
  {
    votes: (VoteDto & {
      options?: VoteOptionDto[];
      source?: VoteSourceDto | null;
    })[];
  },
  AppError
> {
  if (query.includeOptions && (query.status ?? 'active') === 'active') {
    return listActiveVotesWithOptions(query.municipality).map((rows) => ({
      votes: rows.map((row) => ({
        ...toVoteDto(row),
        options: row.options.map((option) => toVoteOptionDto(option)),
        // Source engagement rides along with the tallies: every surface that
        // ranks by heat (live map, desks) needs both in one round-trip.
        source: row.source ? toVoteSourceDto(row.source) : null,
      })),
    }));
  }
  return repoListVotes(query).map((rows) => ({ votes: rows.map(toVoteDto) }));
}
