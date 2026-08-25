/**
 * Votes domain - pure functions only. No IO, no framework.
 *
 * The single source of truth for the DB-row → API-DTO mapping that was
 * previously hand-duplicated across route handlers.
 */

import { hotnessOf, reactionsTotalOf } from '@sync/shared';
import type { Vote, VoteOption, VoteSource } from '@/lib/supabase/types';

export interface VoteDto {
  id: string;
  title: string;
  description: string;
  municipality: string;
  creatorId: string;
  status: string;
  startDate: string;
  endDate: string;
  participantCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface VoteOptionDto {
  id: string;
  label: string;
  description?: string;
  voteCount: number;
}

/**
 * Where the topic came from and how hot it is at the source - the public
 * evidence strip behind every vote (post/comment/reaction tallies as last
 * measured, plus the derived 0–100 hotness).
 */
export interface VoteSourceDto {
  postCount: number;
  commentsCount: number;
  /** Per-kind tallies: like/love/haha/wow/sad/angry. */
  reactions: Record<string, number>;
  reactionsTotal: number;
  /** 0–100 engagement heat, derived from comments + reactions. */
  hotness: number;
  url: string | null;
  fetchedAt: string;
}

export function toVoteDto(row: Vote): VoteDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    municipality: row.municipality_id,
    creatorId: row.creator_id,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    participantCount: row.participant_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toVoteSourceDto(row: VoteSource): VoteSourceDto {
  const reactions = (row.reactions ?? {}) as Record<string, number>;
  const reactionsTotal = reactionsTotalOf(reactions);
  const commentsCount = row.comments_count ?? 0;
  return {
    postCount: row.post_count ?? 0,
    commentsCount,
    reactions,
    reactionsTotal,
    hotness: hotnessOf(commentsCount, reactionsTotal),
    url: row.source_url,
    fetchedAt: row.fetched_at,
  };
}

export function toVoteOptionDto(
  row: VoteOption,
  inputDescription?: string
): VoteOptionDto {
  return {
    id: row.id,
    label: row.text,
    description: inputDescription,
    voteCount: row.votes ?? 0,
  };
}

/** A vote whose start date has arrived opens immediately. */
export function initialStatus(startDate: Date, now: Date): 'active' | 'pending' {
  return startDate <= now ? 'active' : 'pending';
}

/**
 * Every new proposal enters review. `pending` is NOT this state - it means
 * "approved and scheduled, not yet open". `initialStatus` still decides
 * between active and pending, but only at approval time.
 *
 * A function rather than a constant, so the eventual "trusted submitter skips
 * review" rule has a place to live.
 */
export const submissionStatus = (): 'in_review' => 'in_review';

/**
 * The only statuses a vote may be shown at under a public read path.
 *
 * An allow-list, never a deny-list: a status invented later is invisible until
 * someone deliberately adds it here. This one constant does both jobs - the
 * default filter when no status is supplied, and the validation set for an
 * explicitly supplied one. There is deliberately no second
 * "publicly filterable" list; two nearly-identical allow-lists is exactly how
 * one of them drifts.
 *
 * `'pending'` is IN, deliberately. In this codebase it means "approved and
 * scheduled, not yet open" - never "awaiting approval" - and /he/votes shows
 * scheduled votes today. The security goal here is excluding the four *review*
 * states (draft, in_review, changes_requested, rejected), which this list still
 * does; dropping `'pending'` alongside them would be an unrelated behaviour
 * change to a live public surface. Do not "tighten" it later.
 *
 * `'failed'` is OUT, deliberately. It marks a vote whose NFT resolution failed.
 * `getVotesByMunicipality` carried no status predicate before this allow-list
 * existed, so such a vote used to appear in default listings and no longer
 * does. That narrowing is intended, not a regression to be "restored".
 */
export const PUBLIC_VOTE_STATUSES = [
  'pending',
  'active',
  'ended',
  'resolving',
  'resolved',
] as const;
export type PublicVoteStatus = (typeof PUBLIC_VOTE_STATUSES)[number];

/**
 * The allow-list's complement, re-exported so consumers have one import site
 * for "which statuses are under review" alongside "which statuses are public".
 */
export { REVIEW_VOTE_STATUSES } from '@/server/domain/space/review';
export type { ReviewVoteStatus } from '@/server/domain/space/review';

/**
 * Normalise a raw `?status=` query parameter to a public status, or `null`
 * meaning "no filter - fall back to the allow-list".
 *
 * Client compatibility: the API once accepted 'cancelled'; the DB knows 'ended'
 * and never had a 'cancelled' label.
 *
 * Every review status returns `null` rather than being rejected, so
 * `?status=in_review` degrades to the ordinary public list instead of selecting
 * drafts - and instead of becoming an existence oracle for the review
 * vocabulary via a distinctive 400.
 */
export function normalizeStatusFilter(status: string | null): PublicVoteStatus | null {
  if (status === 'cancelled') return 'ended'; // legacy client alias
  return (PUBLIC_VOTE_STATUSES as readonly string[]).includes(status ?? '')
    ? (status as PublicVoteStatus)
    : null;
}

/** Why a vote will not accept participation right now. */
export type ParticipationClosedCode = 'VOTE_ENDED' | 'VOTE_NOT_OPEN';

export interface ParticipationOpenDecision {
  open: boolean;
  code?: ParticipationClosedCode;
}

/**
 * Is this vote open for participation, at this instant?
 *
 * One rule, two callers. `POST /api/votes/[id]/participate` asks before
 * recording a free ballot; `POST /api/payments/create` asks before charging for
 * a paid one. They used to disagree, because only the first one asked at all -
 * the paid path took a resident's money for a vote that had already closed and
 * only discovered the fact in the webhook, after the charge was irreversible.
 *
 * This is deliberately NOT a third opinion. `cast_vote` (migration
 * 20260904000002) is the authority: it re-reads status and end_date under a row
 * lock inside the same transaction that writes the ballot, so it is the only
 * check that cannot be raced. What this function does is give the two callers
 * the same *early* answer as that authority, in the same order, so a resident
 * gets a specific message before anything irreversible happens instead of a
 * generic failure afterwards.
 *
 * The order matters and is copied from `cast_vote`, not invented here:
 * ended-or-expired is tested BEFORE not-yet-open. A vote that was scheduled and
 * never opened, whose end_date has now passed, is ENDED - it is not going to
 * open. The participate route used to answer VOTE_NOT_OPEN for that case, which
 * told the resident to come back later for a vote that was over. Aligning the
 * order fixes that, and is the only behaviour change in this extraction.
 *
 * `status` is typed as the raw column string rather than a union: it is
 * compared, never exhausted, and a status invented later must fall through to
 * "not open" rather than fail to compile somewhere unrelated.
 *
 * It is the second gate, not the only one. Both callers get their `vote` from
 * `getVoteWithOptions`, which filters `.in('status', PUBLIC_VOTE_STATUSES)` -
 * so a vote in one of the four review states (draft, in_review,
 * changes_requested, rejected) never reaches this function at all: the read
 * returns null and the caller answers 404. This function's accept-list of
 * exactly one status is what closes the gap between that database-level
 * visibility filter and `cast_vote`, and what keeps a status invented later
 * closed by default rather than open by omission.
 */
export function decideParticipationOpen(
  vote: { status: string; end_date: string },
  now: Date
): ParticipationOpenDecision {
  if (vote.status === 'ended' || new Date(vote.end_date) < now) {
    return { open: false, code: 'VOTE_ENDED' };
  }
  if (vote.status !== 'active') {
    return { open: false, code: 'VOTE_NOT_OPEN' };
  }
  return { open: true };
}
