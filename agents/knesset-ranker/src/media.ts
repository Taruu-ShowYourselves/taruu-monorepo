/**
 * Media-coverage evidence: counting, validation and scoring.
 *
 * The agent's job is finding coverage (URLs + publish dates via WebSearch);
 * this module's job is turning that into a defensible number. The media
 * sub-score is COMPUTED from the count of distinct Israeli press outlets
 * with live, fresh (≤14 days) coverage — never estimated by the model.
 * Refs are HTTP-validated before anything is written; if every ref is dead
 * the media score is zero.
 */

export const FRESH_DAYS = 14;
export const MAX_COVERAGE_PER_VOTE = 8;
export const MAX_MEDIA_REFS = 5;
export const MAX_QUERIES = 6;

/** Relevance is the editorial 60%, counted media coverage the other 40%. */
export const RELEVANCE_WEIGHT = 0.6;
export const MEDIA_WEIGHT = 0.4;

/**
 * Distinct fresh outlets → media score. An explicit table rather than a
 * curve so the editorial calibration is visible and testable: one outlet is
 * minor coverage, three is a real story, six+ is saturation.
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

export function mediaScoreFromOutletCount(count: number): number {
  const i = Math.max(0, Math.min(count, MEDIA_SCORE_BY_OUTLETS.length - 1));
  return MEDIA_SCORE_BY_OUTLETS[i] ?? 0;
}

export function blendHotness(relevance: number, media: number): number {
  return Math.round(RELEVANCE_WEIGHT * relevance + MEDIA_WEIGHT * media);
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
}

export interface MediaEvidence {
  version: 2;
  queries: string[];
  hits: CoverageHit[];
  outletsCounted: number;
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
      return {
        url: claim.url,
        outlet,
        publishedAt: claim.publishedAt,
        status,
        ok,
        fresh,
        israeliPress,
        counted: ok && fresh && israeliPress,
      };
    })
  );

  const outlets = new Set(
    hits.filter((h) => h.counted && h.outlet).map((h) => h.outlet as string)
  );

  return {
    version: 2,
    queries: queries.slice(0, MAX_QUERIES),
    hits,
    outletsCounted: outlets.size,
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
