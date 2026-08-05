/**
 * Feed assembly - one stream out of two desks.
 *
 * The municipal desk (discovery-found topics) and the national desk (Knesset
 * day-order items) are different tables with different evidence, but the
 * reader gets one continuous stream. This module flattens both into a single
 * serialisable shape the client reader can order and render without touching
 * the database again.
 */

import { formatBillTitle } from '@/lib/knesset/billTitle';
import { KNESSET_SCOPE } from '@sync/shared';
import type { KnessetItem, KnessetRanking } from '@/lib/supabase/types';
import {
  toDeskTopic,
  type VoteWithRelations,
} from '@/components/press/sections/deskData';
import type {
  DeskRanking,
  DeskTopic,
} from '@/components/press/sections/DeskTopicRow';
import {
  formatAgendaDate,
  weekdayOf,
} from '@/components/press/sections/knessetAgendaData';

/** Where a national topic sits in the plenum's day order. */
export interface FeedAgenda {
  /** "13.07.2026", or null when the sitting date is unknown. */
  readonly date: string | null;
  readonly weekday: string | null;
  readonly ordinal: number | null;
  readonly itemType: string | null;
  readonly knessetNum: number | null;
  readonly isDiscussion: boolean;
}

export interface FeedTopicItem {
  readonly id: string;
  /** Municipality name, or KNESSET_SCOPE for national items. */
  readonly scope: string;
  readonly isNational: boolean;
  /** 0-100 heat used for ordering: editorial ranking first, engagement second. */
  readonly heat: number;
  readonly topic: DeskTopic;
  readonly ranking: DeskRanking | null;
  readonly agenda: FeedAgenda | null;
}

/**
 * Distinct verified outlets behind a ranking's media score. Rows written
 * before the ranker counted its coverage carry no evidence and report null,
 * so the strip can fall back to the opaque sub-score instead of printing a
 * zero it cannot stand behind.
 */
function outletsCountedOf(evidence: unknown): number | null {
  if (!evidence || typeof evidence !== 'object') return null;
  const count = (evidence as { outletsCounted?: unknown }).outletsCounted;
  return typeof count === 'number' && Number.isFinite(count) ? count : null;
}

function toDeskRanking(row: KnessetRanking): DeskRanking {
  return {
    hotness: row.hotness,
    headline: row.headline,
    relevance: row.relevance,
    media: row.media,
    outletsCounted: outletsCountedOf(row.media_evidence),
    rationale: row.rationale,
    mediaRefs: Array.isArray(row.media_refs) ? row.media_refs : [],
    rankedAt: row.ranked_at,
  };
}

function toFeedAgenda(item: KnessetItem): FeedAgenda {
  return {
    date: formatAgendaDate(item.session_date),
    weekday: weekdayOf(item.session_date),
    ordinal: item.ordinal,
    itemType: item.item_type,
    knessetNum: item.knesset_num,
    isDiscussion: item.is_discussion,
  };
}

/**
 * Flatten active votes (+ Knesset metadata and rankings) into the feed stream.
 * Nothing here is load-bearing beyond the vote itself: a missing ranking or
 * agenda row costs the card its evidence strip, never its ballot.
 */
export function buildFeedItems(
  votes: readonly VoteWithRelations[],
  knessetItems: readonly KnessetItem[],
  rankings: ReadonlyMap<string, KnessetRanking>
): FeedTopicItem[] {
  const agendaByVote = new Map(knessetItems.map((item) => [item.vote_id, item]));

  return votes.map((vote) => {
    const rankingRow = rankings.get(vote.id) ?? null;
    const agendaRow = agendaByVote.get(vote.id) ?? null;
    const isNational = vote.municipality_id === KNESSET_SCOPE;
    const base = toDeskTopic(vote);
    // National titles arrive as legal citations; split them so the feed sets
    // the same headline the Knesset desk does.
    const topic: DeskTopic = isNational
      ? { ...base, titleParts: formatBillTitle(base.title) }
      : base;

    return {
      id: vote.id,
      scope: vote.municipality_id,
      isNational,
      heat: rankingRow?.hotness ?? topic.source?.hotness ?? 0,
      topic,
      ranking: rankingRow ? toDeskRanking(rankingRow) : null,
      agenda: agendaRow ? toFeedAgenda(agendaRow) : null,
    };
  });
}
