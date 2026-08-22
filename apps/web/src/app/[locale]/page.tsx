/* PROTOTYPE — the simplified entry experience, under evaluation.
 *
 * The production homepage is parked, unchanged, at `/[locale]/classic`. To end
 * the experiment: restore this file from `classic/page.tsx` and delete both
 * that route and `components/press/sections/EntryExperience.*`.
 *
 * This page is a data loader and nothing else. It reads the same ledger the
 * two desks read (`activeVotesWithOptions`, request-memoised), shapes the rows
 * with the same `toDeskTopic` the desks use, and hands two sets of `DeskEntry`
 * to the client entry component. Ranking, card art and bill-title splitting
 * are the existing helpers, called exactly as KnessetDesk calls them - the
 * tiles a reader opens here are the production tiles, with the production
 * ballot behind them.
 */

import { KNESSET_SCOPE } from '@sync/shared';
import { Masthead, Ticker } from '@/components/press';
import { Colophon } from '@/components/press/sections';
import { EntryExperience } from '@/components/press/sections/EntryExperience';
import type { DeskEntry } from '@/components/press/sections/DeskStream';
import { toDeskTopic } from '@/components/press/sections/deskData';
import { getKnessetRankingsByVoteIds } from '@/lib/supabase/db';
import { formatBillTitle } from '@/lib/knesset/billTitle';
import { activeVotesWithOptions } from '@/server/read/active-votes';
import { activeVoteCardArt } from '@/server/read/card-art';
import type { Locale } from '@/lib/i18n';

// Same window as the desks it replaces: the ledger moves slowly, the tiles
// re-poll on the client, and a per-request SSR of the whole ledger was the
// four-second TTFB the homepage used to pay.
export const revalidate = 60;

/** Municipal topics carried per town - the entry screen shows the head of it. */
const TOPICS_PER_MUNICIPALITY = 6;
/** The national print run on the entry screen; the rest lives on /knesset. */
const KNESSET_TOPICS = 8;

interface HomePageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;

  const [votes, art] = await Promise.all([
    activeVotesWithOptions(),
    activeVoteCardArt(),
  ]);

  /* ---- The local lane -------------------------------------------------- */
  const municipalVotes = votes.filter((v) => v.municipality_id !== KNESSET_SCOPE);

  const municipalTopics = municipalVotes.map((vote) => ({
    topic: toDeskTopic(vote, art.get(vote.id) ?? null),
    municipality: vote.municipality_id,
  }));

  /* The heat rank a tile prints is its position across the WHOLE live ledger,
     not within its own town - the same figure /feed and the desks print, so
     the badge does not disagree with itself between surfaces. Computed before
     the per-town cap for the same reason. */
  const heatRanks = new Map<string, number>();
  [...municipalTopics]
    .filter((entry) => entry.topic.source)
    .sort((a, b) => (b.topic.source?.hotness ?? 0) - (a.topic.source?.hotness ?? 0))
    .forEach((entry, i) => heatRanks.set(entry.topic.id, i + 1));

  const perTown = new Map<string, DeskEntry[]>();
  for (const entry of [...municipalTopics].sort(
    (a, b) => (b.topic.source?.hotness ?? 0) - (a.topic.source?.hotness ?? 0)
  )) {
    const bucket = perTown.get(entry.municipality) ?? [];
    if (bucket.length >= TOPICS_PER_MUNICIPALITY) continue;
    bucket.push({
      topic: entry.topic,
      municipality: entry.municipality,
      heatRank: heatRanks.get(entry.topic.id),
    });
    perTown.set(entry.municipality, bucket);
  }
  const municipal = [...perTown.values()].flat();

  /* ---- The national lane ----------------------------------------------- */
  const knessetVotes = votes.filter((v) => v.municipality_id === KNESSET_SCOPE);
  const rankings = await getKnessetRankingsByVoteIds(knessetVotes.map((v) => v.id));

  const heatOf = (id: string, fallback: number) =>
    rankings.get(id)?.hotness ?? fallback;

  const knessetTopics = knessetVotes
    .map((vote) => {
      const topic = toDeskTopic(vote, art.get(vote.id) ?? null);
      // Agenda titles arrive as legal citations; the tile sets the instrument,
      // the subject and the qualifier as separate furniture.
      return { ...topic, titleParts: formatBillTitle(topic.title) };
    })
    .sort(
      (a, b) =>
        heatOf(b.id, b.source?.hotness ?? 0) - heatOf(a.id, a.source?.hotness ?? 0)
    )
    .slice(0, KNESSET_TOPICS);

  const rankedIds = knessetTopics
    .filter((topic) => rankings.has(topic.id))
    .map((topic) => topic.id);

  const knesset: DeskEntry[] = knessetTopics.map((topic) => {
    const row = rankings.get(topic.id);
    return {
      topic,
      municipality: KNESSET_SCOPE,
      heatRank: row ? rankedIds.indexOf(topic.id) + 1 : undefined,
      ranking: row
        ? {
            hotness: row.hotness,
            headline: row.headline,
            relevance: row.relevance,
            media: row.media,
            outletsCounted: outletsCountedOf(row.media_evidence),
            rationale: row.rationale,
            mediaRefs: Array.isArray(row.media_refs) ? row.media_refs : [],
            rankedAt: row.ranked_at,
          }
        : null,
    };
  });

  return (
    <div className="np-page">
      <main>
        <Masthead locale={locale} />
        <Ticker locale={locale} />
        <EntryExperience locale={locale} municipal={municipal} knesset={knesset} />
      </main>
      <Colophon locale={locale} />
    </div>
  );
}

/**
 * Distinct verified outlets behind a ranking's media score. Rows written
 * before the ranker counted its coverage carry no evidence - they report null
 * and the tile falls back to the opaque sub-score. (Same reading as
 * KnessetDesk's.)
 */
function outletsCountedOf(evidence: unknown): number | null {
  if (!evidence || typeof evidence !== 'object') return null;
  const count = (evidence as { outletsCounted?: unknown }).outletsCounted;
  return typeof count === 'number' && Number.isFinite(count) ? count : null;
}
