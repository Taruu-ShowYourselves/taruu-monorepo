import type { Vote, VoteOption, VoteSource } from '@/lib/supabase/types';
import type { DeskTopic } from './DeskTopicRow';

/**
 * Hotness — saturating engagement score (0–100). Comments weigh 3× a
 * reaction (writing > clicking). 400 engagement points ≈ 50°, curve
 * flattens toward 100° so one viral post doesn't dwarf the scale.
 */
export function hotnessOf(commentsCount: number, reactionsTotal: number): number {
  const engagement = commentsCount * 3 + reactionsTotal;
  if (engagement <= 0) return 0;
  return Math.min(100, Math.round((100 * engagement) / (engagement + 400)));
}

export type VoteWithRelations = Vote & {
  options: VoteOption[];
  source: VoteSource | null;
};

/** DB vote (+options/source) → presentational DeskTopic. */
export function toDeskTopic(vote: VoteWithRelations): DeskTopic {
  const totalBallots = vote.options.reduce((sum, o) => sum + o.votes, 0);
  const reactions = (vote.source?.reactions ?? {}) as Record<string, number>;
  const reactionsTotal = Object.values(reactions).reduce((s, n) => s + n, 0);
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
          hotness: hotnessOf(commentsCount, reactionsTotal),
        }
      : null,
  };
}
