import { hotnessOf, reactionsTotalOf } from '@sync/shared';
import type { Vote, VoteOption, VoteSource } from '@/lib/supabase/types';
import type { DeskRanking, DeskTopic } from './DeskTopicRow';

export { hotnessOf };

export type VoteWithRelations = Vote & {
  options: VoteOption[];
  source: VoteSource | null;
};

/** DB vote (+options/source) → presentational DeskTopic. */
export function toDeskTopic(vote: VoteWithRelations): DeskTopic {
  const totalBallots = vote.options.reduce((sum, o) => sum + o.votes, 0);
  const reactions = (vote.source?.reactions ?? {}) as Record<string, number>;
  const reactionsTotal = reactionsTotalOf(reactions);
  const commentsCount = vote.source?.comments_count ?? 0;

  return {
    id: vote.id,
    title: vote.title,
    description: vote.description,
    participantCount: vote.participant_count,
    endDate: vote.end_date,
    options: vote.options
      .map((o) => ({
        id: o.id,
        text: o.text,
        votes: o.votes,
        pct: totalBallots > 0 ? Math.round((o.votes / totalBallots) * 100) : 0,
      }))
      .sort((a, b) => b.votes - a.votes),
    source: vote.source
      ? {
          postCount: vote.source.post_count,
          commentsCount,
          reactions,
          reactionsTotal,
          url: vote.source.source_url,
          fetchedAt: vote.source.fetched_at,
          hotness: hotnessOf(commentsCount, reactionsTotal),
        }
      : null,
  };
}

/**
 * The title to print for a topic, best source first.
 *
 * Three grades, and every surface must pick the same one or the desk and the
 * feed disagree about what a bill is called:
 *
 *  1. the ranker's curated headline - what the item *does*;
 *  2. the subject of the legal citation, split out by `formatBillTitle`;
 *  3. the raw title, for municipal topics that were written as headlines
 *     already and for anything the split could not improve.
 */
export function topicHeadline(
  topic: DeskTopic,
  ranking?: DeskRanking | null
): string {
  const curated = ranking?.headline?.trim();
  if (curated) return curated;
  return topic.titleParts?.headline || topic.title;
}
