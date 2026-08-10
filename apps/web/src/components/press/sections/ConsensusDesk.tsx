import { KNESSET_SCOPE } from '@sync/shared';
import { getCardArtByVoteIds } from '@/lib/supabase/db';
import { activeVotesWithOptions } from '@/server/read/active-votes';
import { municipalityCivicStats } from '@/server/read/municipality-stats';
import type { Locale } from '@/lib/i18n';
import type { DeskTopic } from './DeskTopicRow';
import { toDeskTopic } from './deskData';
import { ConsensusDeskClient } from './ConsensusDeskClient';

interface ConsensusDeskProps {
  locale?: Locale;
}

/**
 * ConsensusDesk - the regional desk. Live topics of consensus per
 * municipality, pulled from the votes ledger and grouped by city like
 * regional editions of the paper. Server component: fetches once per
 * revalidation window, hands the grouped map to the client picker.
 */
export async function ConsensusDesk({ locale = 'he' }: ConsensusDeskProps) {
  // Request-scoped read shared with the national desk - one ledger query per
  // render, not one per desk. Degrades to the empty desk when the DB is
  // unreachable (build-time prerender in CI has no service-role key - #39);
  // ISR refills at runtime.
  // The stats feed the dock's dial and are independent of the ledger read -
  // both are request-memoised, so issue them together rather than in series.
  const [votes, stats] = await Promise.all([
    activeVotesWithOptions(),
    municipalityCivicStats(),
  ]);
  // Faded tile plates from the art job; degrades to an empty map on failure.
  const art = await getCardArtByVoteIds(votes.map((v) => v.id));

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

  const desks = [...byMunicipality.entries()]
    .map(([municipality, topics]) => ({ municipality, topics }))
    .sort((a, b) => b.topics.length - a.topics.length);

  return <ConsensusDeskClient desks={desks} stats={stats} locale={locale} />;
}
