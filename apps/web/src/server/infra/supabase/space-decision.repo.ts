import 'server-only';

/**
 * Proposal decisions — one scoped read and one conditional transition.
 *
 * This module is deliberately just those two functions. 05-06's content
 * moderation writer lives in `space-member.repo.ts`, so two plans running in
 * the same wave never contend on one file.
 *
 * Like every other space query these run as the Supabase service role, which
 * has BYPASSRLS. The space predicate is therefore written here, into the SQL,
 * and the branded `SpaceScope` is the only thing that can supply it.
 */

import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { Vote } from '@/lib/supabase/types';
import type { SpaceScope } from '@/server/app/space-admin/authorize';
import { conflict, dbError, type AppError } from '@/server/http/errors';
import type { ProposalRow } from '@/server/infra/supabase/space.repo';

/**
 * The 409 copy, verbatim from 05-UI-SPEC.md. Exported because the use-case
 * raises the same conflict when it reads a proposal that is already decided,
 * and one sentence rendered two different ways would be a UI bug nobody sees
 * until a screenshot review.
 */
export const DECISION_CONFLICT_HE =
  'ההצעה כבר הוכרעה על ידי מנהל אחר. רעננו את הרשימה כדי לראות את המצב העדכני.';

/**
 * One proposal with the two schedule columns the decision needs, plus the
 * submitter embed the detail panel renders. A superset of the queue's row, so
 * `toProposalSummary` maps it without a second display-name helper.
 */
export interface ProposalDetailRow extends ProposalRow {
  start_date: string;
  end_date: string;
}

type EmbeddedUser = {
  users: { first_name: string | null; last_name: string | null } | null;
};

/** One proposal, read THROUGH the scope. A cross-space voteId reads back nothing. */
export function findProposalInScope(
  scope: SpaceScope,
  voteId: string
): ResultAsync<ProposalDetailRow | null, AppError> {
  const query = supabaseAdmin
    .from('votes')
    // Hand-written column list, never a star: a private column added to `votes`
    // later must be opted in here before it can reach an admin response.
    //
    // The submitter embed names its foreign key because `votes` has three into
    // `users` — `creator_id` plus the `hidden_by` / `flagged_by` moderation
    // columns from 20260802000012. Unqualified, PostgREST answers PGRST201 and
    // the detail panel 500s. Same fix, same reason, as `listProposals`.
    .select(
      'id, title, description, status, creator_id, start_date, end_date, created_at, hidden_at, flagged_at, users!votes_creator_id_fkey(first_name, last_name)'
    )
    .eq('id', voteId)
    .eq('municipality_id', scope.municipalityCode) // object-level scope, in the SQL
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      if (!data) return null;
      const row = data as unknown as Omit<
        ProposalDetailRow,
        'submitter_first_name' | 'submitter_last_name'
      > &
        EmbeddedUser;
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        status: row.status,
        creator_id: row.creator_id,
        start_date: row.start_date,
        end_date: row.end_date,
        created_at: row.created_at,
        hidden_at: row.hidden_at,
        flagged_at: row.flagged_at,
        submitter_first_name: row.users?.first_name ?? null,
        submitter_last_name: row.users?.last_name ?? null,
      };
    });

  return ResultAsync.fromPromise(query, (cause) => dbError('votes.findInScope', cause));
}

/**
 * Deterministic decision. The prior-state guard and the space predicate live
 * in the same UPDATE statement, so two concurrent decisions cannot both win:
 * the loser gets zero rows and a 409, never a second publication.
 *
 * Not an advisory transaction lock. Supabase connections arrive through a
 * pooler from Cloudflare Workers, where session-scoped lock semantics are not
 * dependable, and the conditional update already gives determinism at zero
 * cost — the same idiom `markMerchOrderPaid` has used in this codebase since
 * the merch rail shipped.
 *
 * The database carries a backstop underneath this guard: the partial unique
 * index `uq_space_proposal_single_approval` over `space_audit_log` admits one
 * approval row per vote, so even a code path that somehow skipped this
 * statement could not record a second approval for the same proposal.
 */
export function transitionProposal(
  scope: SpaceScope,
  voteId: string,
  prior: 'in_review',
  next: 'active' | 'pending' | 'rejected' | 'changes_requested'
): ResultAsync<Vote, AppError> {
  const query = supabaseAdmin
    .from('votes')
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq('id', voteId)
    .eq('municipality_id', scope.municipalityCode)
    .eq('status', prior)
    .select()
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      return data;
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('votes.transition', cause)
  ).andThen((row) =>
    row ? okAsync(row) : errAsync<Vote, AppError>(conflict(DECISION_CONFLICT_HE))
  );
}
