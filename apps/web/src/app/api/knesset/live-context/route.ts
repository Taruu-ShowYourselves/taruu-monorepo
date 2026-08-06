import { NextRequest, NextResponse } from 'next/server';
import {
  getKnessetItemsByVoteIds,
  getKnessetRankingsByVoteIds,
  getTopRankedKnessetVoteIds,
} from '@/lib/supabase/db';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_IDS = 20;

/**
 * Public evidence used by the live Knesset feed on the homepage.
 *
 * Two modes: `?ids=a,b,c` returns evidence for the requested votes;
 * `?top=N` resolves the N hottest ranked active Knesset votes server-side.
 * The client cannot pick hot ids itself — it would need the rankings it is
 * asking for — so the burning-vote surfaces use `top`.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const top = Number(params.get('top'));
  const ids =
    Number.isInteger(top) && top > 0
      ? await getTopRankedKnessetVoteIds(Math.min(top, MAX_IDS))
      : [...new Set((params.get('ids') ?? '').split(','))]
          .filter((id) => UUID.test(id))
          .slice(0, MAX_IDS);

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

  // s-maxage is what lets the Cloudflare edge hold this, not just the browser.
  // The ranker refreshes on a 6-hourly cron, so 120s at the edge is generous.
  return NextResponse.json(
    { evidence },
    {
      headers: {
        'Cache-Control':
          'public, max-age=30, s-maxage=120, stale-while-revalidate=600',
      },
    }
  );
}
