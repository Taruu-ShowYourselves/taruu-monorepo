import { KNESSET_SCOPE } from '@sync/shared';
import { activeVotesWithOptions } from '@/server/read/active-votes';
import { activeVoteCardArt } from '@/server/read/card-art';
import { municipalityCivicStats } from '@/server/read/municipality-stats';
import type { Locale } from '@/lib/i18n';
import type { DeskTopic } from './DeskTopicRow';
import { toDeskTopic } from './deskData';
import { ConsensusDeskClient } from './ConsensusDeskClient';

interface ConsensusDeskProps {
  locale?: Locale;
  /** Render as scenery: no page landmarks. See ConsensusDeskClient. */
  decorative?: boolean;
  /** Rendered inside the tabbed desk section - stream and dial only. */
  embedded?: boolean;
}

/**
 * The desk's print run.
 *
 * The homepage used to SSR every active topic in the country - measured in
 * production as ~3MB of HTML, most of it tiles nobody would reach without
 * pushing the river for minutes. A desk is an edition, not an archive: each
 * municipality runs its hottest few, the whole run is capped, and the archive
 * stays a click away on the votes page. The caps keep every municipality with
 * at least its lead topic on the desk.
 */
const TOPICS_PER_MUNICIPALITY = 5;
const TOPICS_TOTAL = 45;

/**
 * ConsensusDesk - the regional desk. Live topics of consensus per
 * municipality, pulled from the votes ledger and grouped by city like
 * regional editions of the paper. Server component: fetches once per
 * revalidation window, hands the grouped map to the client picker.
 */
export async function ConsensusDesk({
  locale = 'he',
  decorative = false,
  embedded = false,
}: ConsensusDeskProps) {
  // Request-scoped read shared with the national desk - one ledger query per
  // render, not one per desk. Degrades to the empty desk when the DB is
  // unreachable (build-time prerender in CI has no service-role key - #39);
  // ISR refills at runtime.
  // The stats feed the dock's dial and are independent of the ledger read -
  // both are request-memoised, so issue them together rather than in series.
  // Scenery has no dial, so the decorative render skips the stats read.
  const [votes, stats, art] = await Promise.all([
    activeVotesWithOptions(),
    decorative ? Promise.resolve([]) : municipalityCivicStats(),
    // Faded tile plates from the art job; request-memoised across all three
    // desks on the page, and degrades to an empty map on failure.
    activeVoteCardArt(),
  ]);

  const byMunicipality = new Map<string, DeskTopic[]>();
  for (const vote of votes) {
    // National (Knesset) topics live on their own desk, not the municipal one.
    if (vote.municipality_id === KNESSET_SCOPE) continue;

    const topic = toDeskTopic(vote, art.get(vote.id) ?? null);
    const bucket = byMunicipality.get(vote.municipality_id);
    if (bucket) {
      bucket.push(topic);
    } else {
      byMunicipality.set(vote.municipality_id, [topic]);
    }
  }

  // Hottest topics first within each desk.
  for (const topics of byMunicipality.values()) {
    topics.sort((a, b) => (b.source?.hotness ?? 0) - (a.source?.hotness ?? 0));
  }

  // The badge and the dial's figures are computed BEFORE the print run is
  // cut, because both make claims about the whole ledger: '#N בחום' is a
  // topic's rank among every live municipal topic (the same rank /feed
  // prints for it), and the dial's fallback count is how many topics a
  // municipality actually has open - not how many made this edition.
  const heatRanks: Record<string, number> = {};
  [...byMunicipality.values()]
    .flat()
    .filter((topic) => topic.source)
    .sort((a, b) => (b.source?.hotness ?? 0) - (a.source?.hotness ?? 0))
    .forEach((topic, i) => {
      heatRanks[topic.id] = i + 1;
    });

  const openTopicCounts: Record<string, number> = {};
  for (const [municipality, topics] of byMunicipality) {
    openTopicCounts[municipality] = topics.length;
  }

  // Only the edition's worth of each desk - the print run, not the archive.
  for (const [municipality, topics] of byMunicipality) {
    byMunicipality.set(municipality, topics.slice(0, TOPICS_PER_MUNICIPALITY));
  }

  // The overall cap trims the coldest tail of the biggest desks first, so a
  // town with one topic never loses it to a town with five.
  let total = [...byMunicipality.values()].reduce((n, t) => n + t.length, 0);
  while (total > TOPICS_TOTAL) {
    let fullest: DeskTopic[] | null = null;
    for (const topics of byMunicipality.values()) {
      if (topics.length > 1 && (!fullest || topics.length > fullest.length)) {
        fullest = topics;
      }
    }
    if (!fullest) break;
    fullest.pop();
    total -= 1;
  }

  const desks = [...byMunicipality.entries()]
    .map(([municipality, topics]) => ({ municipality, topics }))
    .sort((a, b) => b.topics.length - a.topics.length);

  return (
    <ConsensusDeskClient
      desks={desks}
      stats={stats}
      heatRanks={heatRanks}
      openTopicCounts={openTopicCounts}
      locale={locale}
      decorative={decorative}
      embedded={embedded}
    />
  );
}
