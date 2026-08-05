import { NextRequest, NextResponse } from 'next/server';
import {
  getKnessetItemsByVoteIds,
  getKnessetRankingsByVoteIds,
} from '@/lib/supabase/db';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Public evidence used by the live Knesset feed on the homepage. */
export async function GET(request: NextRequest) {
  const ids = [...new Set((request.nextUrl.searchParams.get('ids') ?? '').split(','))]
    .filter((id) => UUID.test(id))
    .slice(0, 20);

  if (ids.length === 0) {
    return NextResponse.json({ evidence: {} });
  }

  const [items, rankings] = await Promise.all([
    getKnessetItemsByVoteIds(ids),
    getKnessetRankingsByVoteIds(ids),
  ]);
  const itemsByVote = new Map(items.map((item) => [item.vote_id, item]));

  const evidence = Object.fromEntries(
    ids.map((id) => {
      const item = itemsByVote.get(id);
      const ranking = rankings.get(id);
      return [
        id,
        {
          official: item
            ? {
                sessionDate: item.session_date,
                itemType: item.item_type,
                ordinal: item.ordinal,
                docUrl: item.doc_url,
                docGroup: item.doc_group,
                summary: item.summary,
                fetchedAt: item.fetched_at,
              }
            : null,
          ranking: ranking
            ? {
                hotness: ranking.hotness,
                relevance: ranking.relevance,
                media: ranking.media,
                rationale: ranking.rationale,
                mediaRefs: ranking.media_refs,
                rankedAt: ranking.ranked_at,
              }
            : null,
        },
      ];
    })
  );

  return NextResponse.json(
    { evidence },
    { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=120' } }
  );
}
