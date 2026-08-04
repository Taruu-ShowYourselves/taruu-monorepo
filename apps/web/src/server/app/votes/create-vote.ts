/**
 * Use-case: create a vote.
 *
 * Orchestration only - gates, payment, persistence. Notification fan-out is
 * handed to `deps.defer` so it runs after the response is sent.
 */

import { errAsync, okAsync, type ResultAsync } from 'neverthrow';
import { findUserById } from '@/server/infra/supabase/user.repo';
import { assertPaymentUsable } from '@/server/infra/supabase/payment.repo';
import {
  insertVote,
  insertVoteOptions,
} from '@/server/infra/supabase/vote.repo';
import { notifyVoteCreated } from '@/server/infra/notify/vote-created';
import {
  initialStatus,
  toVoteDto,
  toVoteOptionDto,
  type VoteDto,
  type VoteOptionDto,
} from '@/server/domain/votes/vote';
import { forbidden, validation, type AppError } from '@/server/http/errors';

export interface CreateVoteCommand {
  userId: string;
  title: string;
  description: string;
  options: { label: string; description?: string }[];
  startDate: string;
  endDate: string;
  paymentTxId: string;
}

export interface CreateVoteDeps {
  /** Schedule work after the response is sent (Next `after` / waitUntil). */
  defer: (task: () => Promise<void>) => void;
  now?: () => Date;
}

export type CreatedVote = VoteDto & { options: VoteOptionDto[] };

export function createVote(
  deps: CreateVoteDeps,
  cmd: CreateVoteCommand
): ResultAsync<{ vote: CreatedVote }, AppError> {
  const now = deps.now?.() ?? new Date();
  const start = new Date(cmd.startDate);
  const end = new Date(cmd.endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return errAsync(validation(['startDate/endDate must be valid, endDate after startDate']));
  }

  return findUserById(cmd.userId)
    .andThen((creator) => {
      // Only a fully verified resident may raise a vote, and always for
      // their OWN municipality - a local issue is raised by a local.
      if (creator.verification_status !== 'verified') {
        return errAsync<typeof creator, AppError>(
          forbidden('Only verified residents may create a vote')
        );
      }
      if (!creator.municipality_id) {
        return errAsync<typeof creator, AppError>(
          validation(['Set your municipality before creating a vote'])
        );
      }
      return okAsync<typeof creator, AppError>(creator);
    })
    .andThen((creator) =>
      assertPaymentUsable(cmd.paymentTxId, cmd.userId, 'vote_creation').map(
        () => creator
      )
    )
    .andThen((creator) =>
      insertVote({
        title: cmd.title,
        description: cmd.description,
        municipality_id: creator.municipality_id as string,
        creator_id: cmd.userId,
        status: initialStatus(start, now),
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        participant_count: 0,
      }).map((vote) => ({ creator, vote }))
    )
    .andThen(({ creator, vote }) =>
      insertVoteOptions(
        cmd.options.map((opt) => ({ vote_id: vote.id, text: opt.label, votes: 0 }))
      ).map((rows) => ({ creator, vote, rows }))
    )
    .map(({ creator, vote, rows }) => {
      deps.defer(() => notifyVoteCreated(vote, creator));
      return {
        vote: {
          ...toVoteDto(vote),
          options: rows.map((row, i) =>
            toVoteOptionDto(row, cmd.options[i]?.description)
          ),
        },
      };
    });
}
