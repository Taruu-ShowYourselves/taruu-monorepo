import 'server-only';
import { KNESSET_SCOPE } from '@sync/shared';
import { activeVotesWithOptions } from '@/server/read/active-votes';
import { countRegisteredUsers } from '@/lib/supabase/db';
import { pointForMunicipality } from '@/components/press/CinematicIntro/israel-map';
import { hotnessOf, reactionsTotalOf } from '@sync/shared';
import type { Locale } from '@/lib/i18n';
import {
  IsraelMapDeskClient,
  type MapPin,
  type MapStats,
} from './IsraelMapDeskClient';

/**
 * The live map - the whole country's open ledger, drawn as the country.
 *
 * Sits right below the locality desk: the reader has just told the paper
 * where they live, and this is the standing answer to "and where is everyone
 * else" - every open municipal topic, pinned to the town it belongs to on
 * the same stylised outline (and the same projection) the intro's signal map
 * uses, so the two can never disagree about where a town is. The paper's
 * weather map, one viewport tall.
 *
 * Data is the request-memoised ledger every other desk reads, plus the
 * platform-wide registration aggregate - a public count with nothing
 * per-user in it (the same number /api/stats/registrations serves). The
 * page revalidates every minute, which is what "live" means here.
 */

/** Ballots cast on one vote, read off the embedded option rows. The raw
 *  Supabase embed carries snake_case columns whatever the declared type
 *  says, so read both spellings. */
function ballotsOf(
  options: { votes?: number; voteCount?: number; vote_count?: number }[]
) {
  return options.reduce(
    (sum, option) =>
      sum + (option.votes ?? option.vote_count ?? option.voteCount ?? 0),
    0
  );
}

export async function IsraelMapDesk({ locale = 'he' }: { locale?: Locale }) {
  const [votes, signups] = await Promise.all([
    activeVotesWithOptions(),
    // Degrades to 0 on failure inside the helper; never fails the page.
    countRegisteredUsers().catch(() => 0),
  ]);

  /* One pin per municipality, carrying its open topics hottest-first. The
     national (Knesset) rows have no single place on a map and stay off it -
     the section is captioned as the municipal ledger. */
  const byMuni = new Map<
    string,
    {
      x: number;
      y: number;
      heat: number;
      topics: { title: string; heat: number; ballots: number }[];
    }
  >();

  let ballotsTotal = 0;
  let topicsTotal = 0;

  for (const vote of votes) {
    const muni = vote.municipality_id;
    if (!muni || muni === KNESSET_SCOPE) continue;
    const point = pointForMunicipality(muni);
    if (!point) continue;

    const reactions = (vote.source?.reactions ?? {}) as Record<string, number>;
    const heat = vote.source
      ? hotnessOf(vote.source.comments_count ?? 0, reactionsTotalOf(reactions))
      : 0;
    const ballots = ballotsOf(vote.options ?? []);
    ballotsTotal += ballots;
    topicsTotal += 1;

    const entry = byMuni.get(muni);
    if (entry) {
      entry.heat = Math.max(entry.heat, heat);
      entry.topics.push({ title: vote.title, heat, ballots });
    } else {
      byMuni.set(muni, {
        x: point.x,
        y: point.y,
        heat,
        topics: [{ title: vote.title, heat, ballots }],
      });
    }
  }

  const pins: MapPin[] = [...byMuni.entries()]
    .map(([name, entry]) => ({
      name,
      x: entry.x,
      y: entry.y,
      heat: entry.heat,
      count: entry.topics.length,
      topics: entry.topics
        .sort((a, b) => b.heat - a.heat)
        /* The docket scrolls now, so it carries the town's real agenda
           rather than a four-line teaser; the cap only guards the payload. */
        .slice(0, 24)
        .map((t) => ({ title: t.title, ballots: t.ballots })),
    }))
    /* Hottest town first: it is the default selection, and the list column
       prints in this order. */
    .sort((a, b) => b.heat - a.heat || b.count - a.count);

  const stats: MapStats = {
    signups,
    topics: topicsTotal,
    towns: pins.length,
    ballots: ballotsTotal,
  };

  return <IsraelMapDeskClient locale={locale} pins={pins} stats={stats} />;
}
