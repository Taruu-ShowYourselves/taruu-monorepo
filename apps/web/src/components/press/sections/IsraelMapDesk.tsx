import 'server-only';
import { KNESSET_SCOPE } from '@sync/shared';
import { activeVotesWithOptions } from '@/server/read/active-votes';
import { pointForMunicipality } from '@/components/press/CinematicIntro/israel-map';
import { hotnessOf, reactionsTotalOf } from '@sync/shared';
import type { Locale } from '@/lib/i18n';
import { IsraelMapDeskClient, type MapPin } from './IsraelMapDeskClient';

/**
 * The live map - the whole country's open ledger, drawn as the country.
 *
 * The closing section before the colophon: every open municipal topic,
 * pinned to the town it belongs to on the same stylised outline (and the
 * same projection) the intro's signal map uses, so the two can never
 * disagree about where a town is. The reader has just been told how to take
 * part; this is the standing answer to "where is all of this happening" -
 * the paper's weather map.
 *
 * Data is the request-memoised ledger every other desk reads. The page
 * revalidates every minute, which is what "live" means here - the pins are
 * as fresh as the desks above them.
 */

export async function IsraelMapDesk({ locale = 'he' }: { locale?: Locale }) {
  const votes = await activeVotesWithOptions();

  /* One pin per municipality, carrying its open topics hottest-first. The
     national (Knesset) rows have no single place on a map and stay off it -
     the section is captioned as the municipal ledger. */
  const byMuni = new Map<
    string,
    { x: number; y: number; heat: number; topics: { title: string; heat: number }[] }
  >();

  for (const vote of votes) {
    const muni = vote.municipality_id;
    if (!muni || muni === KNESSET_SCOPE) continue;
    const point = pointForMunicipality(muni);
    if (!point) continue;

    const reactions = (vote.source?.reactions ?? {}) as Record<string, number>;
    const heat = vote.source
      ? hotnessOf(vote.source.comments_count ?? 0, reactionsTotalOf(reactions))
      : 0;

    const entry = byMuni.get(muni);
    if (entry) {
      entry.heat = Math.max(entry.heat, heat);
      entry.topics.push({ title: vote.title, heat });
    } else {
      byMuni.set(muni, {
        x: point.x,
        y: point.y,
        heat,
        topics: [{ title: vote.title, heat }],
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
        .slice(0, 4)
        .map((t) => t.title),
    }))
    /* Hottest town first: it is the default selection, and the list column
       prints in this order. */
    .sort((a, b) => b.heat - a.heat || b.count - a.count);

  return <IsraelMapDeskClient locale={locale} pins={pins} />;
}
