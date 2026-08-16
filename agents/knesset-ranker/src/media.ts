/**
 * Media-coverage evidence: counting, validation and scoring.
 *
 * The agent's job is finding coverage (URLs + publish dates via WebSearch);
 * this module's job is turning that into a defensible number. The media
 * sub-score is COMPUTED from live, fresh (≤14 days) coverage by distinct
 * Israeli press outlets — never estimated by the model. Refs are
 * HTTP-validated before anything is written; if every ref is dead the media
 * score is zero.
 *
 * v3: heat, not just presence. Each counted hit carries a freshness weight
 * that halves every HEAT_HALF_LIFE_DAYS, so an outlet that wrote today
 * outweighs one that wrote twelve days ago; undated hits count at a flat
 * discount instead of passing as fully fresh. The media score maps the
 * decay-weighted outlet total ("effective outlets") through the editorial
 * table, interpolated between steps.
 */

export const FRESH_DAYS = 14;
export const MAX_COVERAGE_PER_VOTE = 8;
export const MAX_MEDIA_REFS = 5;
export const MAX_QUERIES = 6;

/** A counted hit's weight halves every this-many days since publication. */
export const HEAT_HALF_LIFE_DAYS = 4;
/**
 * Weight of an alive Israeli-press hit with no publish date. Non-zero —
 * many Israeli outlets omit dates from search results — but well under a
 * dated fresh hit, so undated URLs can no longer saturate the score.
 */
export const UNDATED_WEIGHT = 0.4;

/**
 * Hotness blend. Press heat carries the plurality: the desk's promise is
 * "the vote the press is burning about right now". Stakes (what actually
 * changes if the item passes) outweighs raw resonance so ceremonial items
 * with saturation coverage stop outranking binding legislation.
 */
export const MEDIA_WEIGHT = 0.45;
export const STAKES_WEIGHT = 0.35;
export const RELEVANCE_WEIGHT = 0.2;

/**
 * Effective outlets → media score anchor points. An explicit table rather
 * than a curve so the editorial calibration is visible and testable: one
 * outlet is minor coverage, three is a real story, six+ is saturation.
 * Fractional effective counts interpolate linearly between entries.
 */
const MEDIA_SCORE_BY_OUTLETS = [0, 35, 55, 68, 78, 85, 90, 94, 97, 100];

/** Israeli multi-label public suffixes — needed to get eTLD+1 right. */
const IL_PUBLIC_SUFFIXES = [
  'co.il',
  'org.il',
  'net.il',
  'gov.il',
  'ac.il',
  'muni.il',
  'k12.il',
  'idf.il',
];

/** .il domains that are institutional, not press. */
const NON_PRESS_IL_SUFFIXES = ['gov.il', 'ac.il', 'muni.il', 'k12.il', 'idf.il'];

/** Israeli outlets publishing off .il (registrable domain form). */
const IL_PRESS_FOREIGN_TLD = new Set([
  'themarker.com',
  'jpost.com',
  'timesofisrael.com',
  'ynetnews.com',
  'israelnationalnews.com',
  'i24news.tv',
  'reshet.tv',
]);

/** Aggregators / platforms that are never press coverage. */
const NON_PRESS_DOMAINS = new Set([
  'facebook.com',
  'x.com',
  'twitter.com',
  'youtube.com',
  'instagram.com',
  'tiktok.com',
  't.me',
  'telegram.me',
  'wikipedia.org',
  'google.com',
  'news.google.com',
]);

/** Registrable domain (eTLD+1), Israeli two-label suffixes handled. */
export function registrableDomain(url: string): string | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  const labels = host.split('.').filter(Boolean);
  if (labels.length < 2) return null;
  const lastTwo = labels.slice(-2).join('.');
  if (IL_PUBLIC_SUFFIXES.includes(lastTwo)) {
    return labels.length >= 3 ? labels.slice(-3).join('.') : lastTwo;
  }
  return lastTwo;
}

/** Is this URL an Israeli press outlet (counts toward the media score)? */
export function isIsraeliPress(url: string): boolean {
  const domain = registrableDomain(url);
  if (!domain) return false;
  if (NON_PRESS_DOMAINS.has(domain)) return false;
  if (IL_PRESS_FOREIGN_TLD.has(domain)) return true;
  if (!domain.endsWith('.il')) return false;
  return !NON_PRESS_IL_SUFFIXES.some(
    (suffix) => domain === suffix || domain.endsWith(`.${suffix}`)
  );
}

/** Published within FRESH_DAYS of `now`. Unknown dates pass (see caller). */
export function isFresh(publishedAt: string | null, now: Date): boolean {
  if (!publishedAt) return true;
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return true;
  return now.getTime() - t <= FRESH_DAYS * 86_400_000 && t <= now.getTime() + 86_400_000;
}

/**
 * Freshness weight of a counted hit at `now`: 1.0 for published-today,
 * halving every HEAT_HALF_LIFE_DAYS; UNDATED_WEIGHT when the date is
 * missing or unparseable. Dates beyond FRESH_DAYS never reach here — the
 * hit is already not counted.
 */
export function freshnessWeight(publishedAt: string | null, now: Date): number {
  if (!publishedAt) return UNDATED_WEIGHT;
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return UNDATED_WEIGHT;
  const ageDays = Math.max(0, (now.getTime() - t) / 86_400_000);
  return 2 ** (-ageDays / HEAT_HALF_LIFE_DAYS);
}

/** Media score for a decay-weighted outlet total, table-interpolated. */
export function mediaScoreFromOutlets(effectiveOutlets: number): number {
  const last = MEDIA_SCORE_BY_OUTLETS.length - 1;
  const clamped = Math.max(0, Math.min(effectiveOutlets, last));
  const lower = Math.floor(clamped);
  const upper = Math.min(lower + 1, last);
  const fraction = clamped - lower;
  const a = MEDIA_SCORE_BY_OUTLETS[lower] ?? 0;
  const b = MEDIA_SCORE_BY_OUTLETS[upper] ?? a;
  return Math.round(a + (b - a) * fraction);
}

export interface HotnessInputs {
  relevance: number;
  /** Null when the agent omitted the axis; relevance stands in. */
  stakes: number | null;
  media: number;
}

export function blendHotness({ relevance, stakes, media }: HotnessInputs): number {
  return Math.round(
    MEDIA_WEIGHT * media +
      STAKES_WEIGHT * (stakes ?? relevance) +
      RELEVANCE_WEIGHT * relevance
  );
}

/** A coverage claim from the agent, before validation. */
export interface CoverageClaim {
  url: string;
  publishedAt: string | null;
}

/** One validated coverage hit, as stored in media_evidence. */
export interface CoverageHit {
  url: string;
  outlet: string | null;
  publishedAt: string | null;
  /** HTTP status observed, null when the request itself failed. */
  status: number | null;
  /** Alive: reachable and not 404/410. Bot-blocks (403 etc.) stay alive. */
  ok: boolean;
  fresh: boolean;
  israeliPress: boolean;
  /** ok && fresh && israeliPress — contributes its outlet to the count. */
  counted: boolean;
  /** Freshness decay weight (0–1); 0 when the hit is not counted. */
  weight: number;
}

export interface MediaEvidence {
  version: 3;
  queries: string[];
  hits: CoverageHit[];
  /** Distinct counted outlets, unweighted — kept for the web's fallback. */
  outletsCounted: number;
  /** Decay-weighted outlet total: Σ per-outlet max freshness weight. */
  effectiveOutlets: number;
  checkedAt: string;
}

export type FetchLike = (
  url: string,
  init: { method: string; redirect: 'follow'; signal: AbortSignal; headers: Record<string, string> }
) => Promise<{ status: number }>;

const VALIDATION_TIMEOUT_MS = 8_000;
const VALIDATION_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  'accept-language': 'he-IL,he;q=0.9,en;q=0.7',
};

/**
 * HEAD the URL (GET fallback for servers that reject HEAD). Dead = network
 * failure, timeout, 404 or 410 — a 403/429/5xx page still exists, so it
 * stays alive but the status is recorded in the evidence.
 */
export async function probeUrl(
  url: string,
  fetchFn: FetchLike = fetch as unknown as FetchLike
): Promise<{ status: number | null; ok: boolean }> {
  const attempt = async (method: 'HEAD' | 'GET') =>
    fetchFn(url, {
      method,
      redirect: 'follow',
      signal: AbortSignal.timeout(VALIDATION_TIMEOUT_MS),
      headers: VALIDATION_HEADERS,
    });

  try {
    let response = await attempt('HEAD');
    if ([403, 405, 501].includes(response.status)) response = await attempt('GET');
    const dead = response.status === 404 || response.status === 410;
    return { status: response.status, ok: !dead };
  } catch {
    return { status: null, ok: false };
  }
}

/**
 * Validate the agent's coverage claims and assemble the evidence record.
 * Outlets are counted once each, only from hits that are alive, fresh and
 * Israeli press.
 */
export async function buildEvidence(
  queries: string[],
  claims: CoverageClaim[],
  now: Date,
  fetchFn?: FetchLike
): Promise<MediaEvidence> {
  const unique = new Map<string, CoverageClaim>();
  for (const claim of claims.slice(0, MAX_COVERAGE_PER_VOTE)) {
    if (!unique.has(claim.url)) unique.set(claim.url, claim);
  }

  const hits: CoverageHit[] = await Promise.all(
    [...unique.values()].map(async (claim) => {
      const outlet = registrableDomain(claim.url);
      const israeliPress = isIsraeliPress(claim.url);
      const fresh = isFresh(claim.publishedAt, now);
      const { status, ok } = await probeUrl(claim.url, fetchFn);
      const counted = ok && fresh && israeliPress;
      return {
        url: claim.url,
        outlet,
        publishedAt: claim.publishedAt,
        status,
        ok,
        fresh,
        israeliPress,
        counted,
        weight: counted ? freshnessWeight(claim.publishedAt, now) : 0,
      };
    })
  );

  // Each outlet contributes its single freshest (heaviest) counted hit —
  // ten same-day articles on one site are one outlet burning, not ten.
  const weightByOutlet = new Map<string, number>();
  for (const hit of hits) {
    if (!hit.counted || !hit.outlet) continue;
    const best = weightByOutlet.get(hit.outlet) ?? 0;
    if (hit.weight > best) weightByOutlet.set(hit.outlet, hit.weight);
  }
  const effectiveOutlets =
    Math.round(
      [...weightByOutlet.values()].reduce((sum, w) => sum + w, 0) * 100
    ) / 100;

  return {
    version: 3,
    queries: queries.slice(0, MAX_QUERIES),
    hits,
    outletsCounted: weightByOutlet.size,
    effectiveOutlets,
    checkedAt: now.toISOString(),
  };
}

/**
 * The refs shown on the desk: counted hits first (one per outlet), capped.
 */
export function refsForDisplay(evidence: MediaEvidence): string[] {
  const seen = new Set<string>();
  const refs: string[] = [];
  for (const hit of evidence.hits) {
    if (!hit.counted || !hit.outlet || seen.has(hit.outlet)) continue;
    seen.add(hit.outlet);
    refs.push(hit.url);
    if (refs.length >= MAX_MEDIA_REFS) break;
  }
  return refs;
}
