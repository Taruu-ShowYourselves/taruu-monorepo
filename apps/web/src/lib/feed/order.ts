/**
 * Feed ordering - what the reader sees first.
 *
 * Pure and dependency-light on purpose: the reader's stream order is a
 * product decision, so it gets executable proof rather than living inside a
 * component. Two rules compose:
 *
 *   1. HEAT      - editorial/engagement temperature (0-100) is the base score.
 *   2. PROXIMITY - a topic from the reader's own municipality outranks a
 *                  hotter one two districts away; national (Knesset) items sit
 *                  between the two, because they are everyone's business.
 *
 * With no stored locality the stream collapses to pure national heat, which is
 * exactly the front page a first-time visitor should get.
 */

import { MUNICIPALITY_GEO, distanceKm } from '@sync/shared';

export interface RankableEntry {
  readonly id: string;
  /** Municipality name, or the national scope for Knesset items. */
  readonly scope: string;
  readonly isNational: boolean;
  /** 0-100 heat: editorial ranking when present, else source engagement. */
  readonly heat: number;
}

/** Heat points a topic loses per kilometre from the reader. */
const KM_WEIGHT = 0.7;
/** Penalty for a municipality with no known coordinates. */
const UNKNOWN_PENALTY = 40;
/** The reader's own municipality always leads. */
const HOME_BONUS = 1000;
/** National items follow the home desk, ahead of neighbouring towns. */
const NATIONAL_BONUS = 500;

const GEO_BY_NAME = new Map(MUNICIPALITY_GEO.map((m) => [m.name, m]));

/**
 * Locality-weighted score for one entry. Exported for the tests that pin the
 * ordering rules; callers should use `orderFeed`.
 */
export function localityScore(entry: RankableEntry, home: string | null): number {
  if (entry.isNational) return entry.heat + (home ? NATIONAL_BONUS : 0);
  if (!home) return entry.heat;
  if (entry.scope === home) return entry.heat + HOME_BONUS;

  const homeGeo = GEO_BY_NAME.get(home);
  const geo = GEO_BY_NAME.get(entry.scope);
  if (!homeGeo || !geo) return entry.heat - UNKNOWN_PENALTY;
  return entry.heat - distanceKm(homeGeo.lat, homeGeo.lng, geo.lat, geo.lng) * KM_WEIGHT;
}

export interface OrderedEntry<T extends RankableEntry> {
  readonly entry: T;
  /** 1-based position by pure country-wide heat - the badge, not the order. */
  readonly heatRank: number;
}

/**
 * Order the stream for one reader. `heatRank` stays the nationwide heat
 * position so the badge keeps meaning the same thing for every reader, while
 * the array order is the personalised one.
 */
export function orderFeed<T extends RankableEntry>(
  entries: readonly T[],
  home: string | null
): OrderedEntry<T>[] {
  const heatRank = new Map<string, number>();
  [...entries]
    .sort((a, b) => b.heat - a.heat)
    .forEach((entry, i) => heatRank.set(entry.id, i + 1));

  return [...entries]
    .sort((a, b) => localityScore(b, home) - localityScore(a, home))
    .map((entry) => ({ entry, heatRank: heatRank.get(entry.id) ?? 0 }));
}

/** How many topics pass before the stream asks the reader for one of their own. */
export const PROMPT_EVERY = 5;

export type WithPrompts<T> =
  | { readonly kind: 'topic'; readonly key: string; readonly item: T; readonly heatRank: number }
  | { readonly kind: 'prompt'; readonly key: string; readonly seq: number }
  | { readonly kind: 'end'; readonly key: string };

/**
 * Interleave "raise a topic" prompts into the ordered stream, and close it
 * with an end card. The prompt never opens the feed (a reader who has seen
 * nothing yet has nothing to propose) and never lands last, where the end
 * card belongs.
 */
export function withPrompts<T extends RankableEntry>(
  ordered: readonly OrderedEntry<T>[],
  every: number = PROMPT_EVERY
): WithPrompts<T>[] {
  const cards: WithPrompts<T>[] = [];
  let seq = 0;

  ordered.forEach(({ entry, heatRank }, i) => {
    cards.push({ kind: 'topic', key: entry.id, item: entry, heatRank });
    const isLast = i === ordered.length - 1;
    if (!isLast && every > 0 && (i + 1) % every === 0) {
      seq += 1;
      cards.push({ kind: 'prompt', key: `prompt-${seq}`, seq });
    }
  });

  cards.push({ kind: 'end', key: 'end' });
  return cards;
}
