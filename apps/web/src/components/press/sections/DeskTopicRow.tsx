/* The row owns its own open handler - it either calls the `onOpen` a client
   desk hands it, or navigates itself. Server desks (KnessetDesk) render it
   without a handler, so the boundary has to live here rather than at the
   call site. */
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  isMunicipality,
  municipalityHref,
} from '@/components/uikit/municipality-link';
import { reactionSentiment } from '@/components/press/reactions';
import type { BillTitle } from '@/lib/knesset/billTitle';
import { topicHeadline } from './deskData';
import type { DeskTopicVariant } from './deskBento';
import { getAsideTopics, restoreTopic, setTopicAside } from './deskAside';
import { useVoteSwipe } from './useVoteSwipe';
import type { SwipeIntent } from './voteSwipe';
import styles from './ConsensusDesk.module.css';
import { localePrefix, type Locale } from '@/lib/i18n';

export interface DeskOption {
  id: string;
  text: string;
  votes: number;
  pct: number;
}

export interface DeskSource {
  /** Source posts consolidated into this topic. */
  postCount: number;
  commentsCount: number;
  /** Per-reaction tallies keyed by reaction kind (like/love/haha/wow/sad/angry). */
  reactions: Record<string, number>;
  reactionsTotal: number;
  url: string | null;
  /** When the engagement numbers were last measured at the source. */
  fetchedAt: string | null;
  /** 0–100 engagement heat. */
  hotness: number;
}

export interface DeskTopic {
  id: string;
  title: string;
  /**
   * A legal citation split into kicker / headline / qualifier. Set by desks
   * whose titles arrive as citations rather than headlines (the Knesset one);
   * absent on municipal topics, whose titles are already written for a reader.
   */
  titleParts?: BillTitle | null;
  description: string;
  /**
   * AI-generated duotone plate for this topic (desk agents' art job), printed
   * as a faded layer under the tile's type. Null until the agent has plated
   * the vote - the tile is complete without it.
   */
  artUrl: string | null;
  participantCount: number;
  endDate: string;
  options: DeskOption[];
  source: DeskSource | null;
}

/** Editorial ranking of a Knesset item (agents/knesset-ranker output). */
export interface DeskRanking {
  /** 0–100 combined editorial heat. */
  hotness: number;
  /** Public relevance/pressingness sub-score (0–100). */
  relevance: number | null;
  /** Media-coverage sub-score (0–100), computed from `outletsCounted`. */
  media: number | null;
  /**
   * Distinct Israeli outlets with live coverage from the last two weeks -
   * the counted fact the media sub-score is derived from. Null for rows
   * ranked before the ranker counted its evidence (judgment-only scores).
   */
  outletsCounted: number | null;
  /**
   * Editor-agent headline saying what the item does. Null until the ranker
   * has curated it; the tile then falls back to the split citation.
   */
  headline: string | null;
  /** One-sentence Hebrew rationale. */
  rationale: string | null;
  /** Israeli press coverage the ranker verified. */
  mediaRefs: string[];
  rankedAt: string | null;
}

/**
 * Days left on a topic, or -1 for one whose date has passed.
 *
 * The clamp used to be `Math.max(0, …)`, which turned every expired topic into
 * a zero and printed "מסתיים היום" over a vote that had closed days ago. That
 * is the desk telling a reader they still have until tonight to vote on
 * something they can no longer vote on. A closed topic says it is closed.
 */
function daysRemaining(endDate: string): number {
  const at = new Date(endDate).getTime();
  if (!Number.isFinite(at)) return -1;
  const ms = at - Date.now();
  if (ms <= 0) return -1;
  return Math.ceil(ms / 86_400_000);
}

const he = (n: number) => n.toLocaleString('he-IL');

interface RowCopy {
  /* Sentiment glyph strip */
  approvingTitle: string;
  objectingTitle: string;
  commentsTitle: string;
  /* Slug line */
  unmeasured: string;
  unmeasuredTitle: string;
  heatTitle: string;
  /* Source evidence strip */
  aiKicker: string;
  rankBadge: (rank: number) => string;
  postsLine: (count: number) => string;
  fetchedTitle: string;
  measuredAt: (date: string) => string;
  originalPostLink: string;
  refFallback: string;
  /* Ranking evidence strip */
  rankedKicker: string;
  relevanceTitle: string;
  relevanceLabel: (score: number) => string;
  outletsTitleVerified: string;
  outletsTitle: string;
  outlets: (count: number) => string;
  mediaTitle: string;
  mediaLabel: (score: number) => string;
  rankedTitle: string;
  rankedAt: (date: string) => string;
  /* Source one-liner */
  sourceHeatTitle: string;
  postLink: string;
  /* Tile body */
  muniProfileTitle: (municipality: string) => string;
  /* The sovereign scale */
  sovereignLocal: string;
  sovereignNational: string;
  sovereignFor: string;
  sovereignAgainst: string;
  sovereignAbstain: string;
  /** Voices counted so far - the weight the reader is about to move. */
  sovereignTally: (count: string) => string;
  /** Printed where the tally would be, on a topic nobody has voted on yet. */
  sovereignOpening: string;
  sovereignBarTitle: (forPct: number, againstPct: number) => string;
  sovereignEmptyTitle: string;
  participants: (count: string) => string;
  daysLeft: (days: number) => string;
  leadCta: string;
  /** Direction-semantic CTA glyph: mirrored between RTL and LTR. */
  ctaArrow: string;
  /* The swipe-vote */
  /** Printed on the tile's own edge while it is being pushed that way. */
  swipeFor: string;
  swipeAgainst: string;
  swipeAside: string;
  /** How to use a tile, printed once the reader has it under a finger. */
  swipeHint: string;
  swipeCastFor: string;
  swipeCastAgainst: string;
  /** The set-aside state, and the way back out of it. */
  asideTitle: string;
  asideNote: string;
  asideUndo: string;
}

const COPY: Record<Locale, RowCopy> = {
  he: {
    approvingTitle: 'ריאקציות אוהדות על הפוסטים המקוריים: לייק, לב, חיוך, וואו',
    objectingTitle: 'ריאקציות של מורת רוח: כעס, עצב',
    commentsTitle: 'תגובות על הפוסטים המקוריים',
    unmeasured: 'לא נמדד',
    unmeasuredTitle: 'הנושא טרם נמדד',
    heatTitle: 'מדד חום: כמה הנושא בוער עכשיו',
    aiKicker: 'ה־AI שלנו איתר',
    rankBadge: (rank) => `#${rank} בחום`,
    postsLine: (count) =>
      `עלה מתוך ${count === 1 ? 'פוסט' : `${count} פוסטים`} בקבוצות הפייסבוק המקומיות.`,
    fetchedTitle: 'מועד המדידה האחרון במקור',
    measuredAt: (date) => `נמדד ${date}`,
    originalPostLink: 'לפוסט המקורי ←',
    refFallback: 'מקור',
    rankedKicker: 'דסק החדשות דירג',
    relevanceTitle: 'רלוונטיות לציבור הישראלי',
    relevanceLabel: (score) => `ציבור ${score}`,
    outletsTitleVerified:
      'כלי תקשורת ישראליים שסיקרו את הנושא בשבועיים האחרונים - נספרו ואומתו',
    outletsTitle: 'כלי תקשורת ישראליים שסיקרו את הנושא בשבועיים האחרונים',
    outlets: (count) => (count === 0 ? 'ללא סיקור' : `${count} כלי תקשורת`),
    mediaTitle: 'היקף סיקור תקשורתי עכשווי',
    mediaLabel: (score) => `תקשורת ${score}`,
    rankedTitle: 'מועד הדירוג האחרון',
    rankedAt: (date) => `דורג ${date}`,
    sourceHeatTitle: 'מדד חום: תגובות וריאקציות על הפוסטים המקוריים',
    postLink: 'לפוסט ←',
    muniProfileTitle: (municipality) => `פרופיל רשות - ${municipality}`,
    sovereignLocal: 'הריבון המקומי',
    sovereignNational: 'הריבון הארצי',
    sovereignFor: 'בעד',
    sovereignAgainst: 'נגד',
    sovereignAbstain: 'נמנע',
    sovereignTally: (count) => `${count} קולות נספרו`,
    sovereignOpening: 'הקול הראשון קובע את הכיוון',
    sovereignBarTitle: (forPct, againstPct) =>
      `עמדת הריבון: ${forPct}% בעד, ${againstPct}% נגד`,
    sovereignEmptyTitle: 'טרם נספרו קולות בנושא הזה',
    participants: (count) => `${count} משתתפים`,
    daysLeft: (days) =>
      days < 0 ? 'ההצבעה נסגרה' : days === 1 ? 'מסתיים היום' : `נותרו ${days} ימים`,
    leadCta: 'הצביעו · VOTE',
    ctaArrow: '←',
    swipeFor: 'בעד',
    swipeAgainst: 'נגד',
    swipeAside: 'לא נושא לקונצנזוס',
    swipeHint: 'גררו · ימינה בעד · שמאלה נגד',
    swipeCastFor: 'בעד · לקלפי',
    swipeCastAgainst: 'נגד · לקלפי',
    asideTitle: 'לא נושא לקונצנזוס',
    asideNote: 'ירד מהמהדורה שלכם. נספר כדי לשפר את בחירת הנושאים — לא כהצבעה, ובלי לפרסם מי אמר.',
    asideUndo: 'החזרת הנושא',
  },
  en: {
    approvingTitle: 'Approving reactions on the original posts: like, love, haha, wow',
    objectingTitle: 'Disapproving reactions: angry, sad',
    commentsTitle: 'Comments on the original posts',
    unmeasured: 'Not measured',
    unmeasuredTitle: 'This topic has not been measured yet',
    heatTitle: 'Heat index: how hot the topic is right now',
    aiKicker: 'Our AI detected',
    rankBadge: (rank) => `#${rank} by heat`,
    postsLine: (count) =>
      count === 1
        ? 'Surfaced from a single post in the local Facebook groups.'
        : `Surfaced from ${count} posts in the local Facebook groups.`,
    fetchedTitle: 'When the source was last measured',
    measuredAt: (date) => `Measured ${date}`,
    originalPostLink: 'Original post →',
    refFallback: 'source',
    rankedKicker: 'The news desk ranked',
    relevanceTitle: 'Relevance to the Israeli public',
    relevanceLabel: (score) => `Public ${score}`,
    outletsTitleVerified:
      'Israeli media outlets that covered the topic in the past two weeks - counted and verified',
    outletsTitle: 'Israeli media outlets that covered the topic in the past two weeks',
    outlets: (count) =>
      count === 0 ? 'No coverage' : count === 1 ? '1 outlet' : `${count} outlets`,
    mediaTitle: 'Extent of current media coverage',
    mediaLabel: (score) => `Media ${score}`,
    rankedTitle: 'When the item was last ranked',
    rankedAt: (date) => `Ranked ${date}`,
    sourceHeatTitle: 'Heat index: comments and reactions on the original posts',
    postLink: 'To the post →',
    muniProfileTitle: (municipality) => `Municipality profile - ${municipality}`,
    sovereignLocal: 'The local sovereign',
    sovereignNational: 'The national sovereign',
    sovereignFor: 'For',
    sovereignAgainst: 'Against',
    sovereignAbstain: 'Abstain',
    sovereignTally: (count) => `${count} voices counted`,
    sovereignOpening: 'The first voice sets the direction',
    sovereignBarTitle: (forPct, againstPct) =>
      `The sovereign's standing: ${forPct}% for, ${againstPct}% against`,
    sovereignEmptyTitle: 'No voices counted on this topic yet',
    participants: (count) => `${count} participants`,
    daysLeft: (days) =>
      days < 0 ? 'Voting closed' : days === 1 ? 'Ends today' : `${days} days left`,
    leadCta: 'Cast your ballot · VOTE',
    ctaArrow: '→',
    swipeFor: 'For',
    swipeAgainst: 'Against',
    swipeAside: 'Not a consensus matter',
    swipeHint: 'Push · left for · right against',
    swipeCastFor: 'For · to the ballot',
    swipeCastAgainst: 'Against · to the ballot',
    asideTitle: 'Not a consensus matter',
    asideNote: 'Dropped from your edition. Counted to improve which topics run — never as a vote, never attributed.',
    asideUndo: 'Put it back',
  },
};

/**
 * Approval, objection and comment counts as press glyphs.
 *
 * One shared row so the lead tile's full strip and a brief's one-liner report
 * the same measured facts in the same language.
 */
function Sentiment({ source, locale = 'he' }: { source: DeskSource; locale?: Locale }) {
  const t = COPY[locale];
  const { approving, objecting } = reactionSentiment(source.reactions);

  return (
    <span className={styles.reactions}>
      <span className={styles.reaction} title={t.approvingTitle}>
        <span aria-hidden>👍</span>
        {he(approving)}
      </span>
      <span className={styles.reaction} title={t.objectingTitle}>
        <span aria-hidden>👎</span>
        {he(objecting)}
      </span>
      <span className={styles.reaction} title={t.commentsTitle}>
        <span aria-hidden>💬</span>
        {he(source.commentsCount)}
      </span>
    </span>
  );
}

/**
 * The tile's slug line: running number, a heat bar, the degrees.
 *
 * Heat used to print as a mono figure buried in the evidence footer, which
 * made a river of tiles unscannable - a reader had to read six footers to
 * find the hot one. As a bar on the top rule it is legible at a glance and
 * costs no extra line.
 */
/**
 * The two sides of a ballot, as percentages of everything cast.
 *
 * Every topic on both desks opens with the same three options - בעד / נגד /
 * נמנע - so the standing is genuinely a balance and not a bar chart of
 * arbitrary choices. Matching on the words rather than on position because
 * `toDeskTopic` sorts options by votes: whichever side is winning would
 * otherwise be labelled "for".
 *
 * The fallback matters more than it looks. A topic seeded with different
 * options must still print something honest, so the two heaviest options
 * become the two sides in order.
 */
/**
 * How long the swipe lesson runs.
 *
 * Long enough for all three cues to light in turn and be read - the CSS
 * sequence in ConsensusDesk.module.css runs right, left, then down at roughly
 * 1.2s apiece - and short enough that a reader who ignores it is not left with
 * a tile flashing at them while they read the headline underneath.
 */
const TUTOR_MS = 5200;

const FOR_TEXT = /^(בעד|for)$/i;
const AGAINST_TEXT = /^(נגד|against)$/i;
const ABSTAIN_TEXT = /^(נמנע|abstain)$/i;

interface SovereignStanding {
  forPct: number;
  againstPct: number;
  abstainPct: number;
  total: number;
  /** The ballot options behind the two sides - what a swipe actually casts. */
  forOption: DeskOption | undefined;
  againstOption: DeskOption | undefined;
}

export function standingOf(options: DeskOption[]): SovereignStanding {
  const total = options.reduce((sum, o) => sum + o.votes, 0);
  const named = (re: RegExp) => options.find((o) => re.test(o.text.trim()));
  const unnamed = options.filter(
    (o) => !FOR_TEXT.test(o.text.trim()) && !AGAINST_TEXT.test(o.text.trim())
  );
  const forOption = named(FOR_TEXT) ?? unnamed[0];
  const againstOption = named(AGAINST_TEXT) ?? unnamed[1];
  const abstainOption = named(ABSTAIN_TEXT);

  return {
    forPct: forOption?.pct ?? 0,
    againstPct: againstOption?.pct ?? 0,
    abstainPct: abstainOption?.pct ?? 0,
    total,
    forOption,
    againstOption,
  };
}

/**
 * The sovereign scale - the tile's headline instrument.
 *
 * It replaced a stack of label/bar/percentage rows, which read as a poll
 * result: something that had already happened somewhere else and was being
 * reported here. A balance reads as a thing under load. The two sides grow
 * toward each other from opposite edges of one heavy rule, the numbers are set
 * at display weight rather than as captions, and on a topic nobody has voted
 * on the bar prints empty with its fulcrum showing - which is the whole point,
 * because that is the moment a single ballot moves it furthest.
 */
function SovereignScale({
  options,
  national,
  locale,
}: {
  options: DeskOption[];
  /** Knesset topics answer to the national sovereign, not a municipal one. */
  national: boolean;
  locale: Locale;
}) {
  const t = COPY[locale];
  const { forPct, againstPct, abstainPct, total } = standingOf(options);
  const open = total > 0;

  return (
    <div className={styles.sovereign}>
      <p className={styles.sovereignHead}>
        <span className={styles.sovereignLabel}>
          <span aria-hidden className={styles.sovereignTick} />
          {national ? t.sovereignNational : t.sovereignLocal}
        </span>
        <span className={styles.sovereignTally}>
          {open ? t.sovereignTally(he(total)) : t.sovereignOpening}
        </span>
      </p>

      {/* An untouched topic prints two zeros rather than two dashes: at display
          weight an em-dash reads as a stray rule, and a zero is both honest and
          the whole invitation - nobody has moved this yet. */}
      <p className={styles.sovereignSides} data-empty={!open || undefined}>
        <span className={styles.sovereignSide} data-side="for">
          <b>{forPct}%</b>
          <i>{t.sovereignFor}</i>
        </span>
        <span className={styles.sovereignSide} data-side="against">
          <b>{againstPct}%</b>
          <i>{t.sovereignAgainst}</i>
        </span>
      </p>

      <span
        className={styles.sovereignBar}
        data-open={open || undefined}
        role="img"
        aria-label={
          open ? t.sovereignBarTitle(forPct, againstPct) : t.sovereignEmptyTitle
        }
      >
        {/* Both sides are painted from their own edge inward, so the seam
            between them is the reading - not the length of either bar. */}
        <span
          className={styles.sovereignForFill}
          style={{ inlineSize: `${forPct}%` }}
          aria-hidden
        />
        <span
          className={styles.sovereignAgainstFill}
          style={{ inlineSize: `${againstPct}%` }}
          aria-hidden
        />
        {abstainPct > 0 ? (
          <span className={styles.sovereignAbstainMark} aria-hidden>
            {t.sovereignAbstain} {abstainPct}%
          </span>
        ) : null}
        <span className={styles.sovereignFulcrum} aria-hidden />
      </span>
    </div>
  );
}

function SlugLine({
  index,
  heat,
  locale = 'he',
}: {
  index: number;
  heat: number | null;
  locale?: Locale;
}) {
  const t = COPY[locale];
  return (
    <p className={styles.slug}>
      <span className={styles.slugNo} aria-hidden>
        {String(index + 1).padStart(2, '0')}
      </span>

      {/* The track prints whether or not there is a measurement, so an
          unmeasured tile keeps the same slug rule as its neighbours instead of
          reading as a half-drawn one. Only the fill and the degrees are a
          claim, and those appear only when the desk has actually counted. */}
      <span className={styles.heatTrack} aria-hidden>
        {heat === null ? null : (
          <span
            className={styles.heatFill}
            style={{ inlineSize: `${Math.min(100, Math.max(0, heat))}%` }}
          />
        )}
      </span>

      {heat === null ? (
        <span className={styles.slugUnmeasured} title={t.unmeasuredTitle}>
          {t.unmeasured}
        </span>
      ) : (
        <span className={styles.slugHeat} title={t.heatTitle}>
          {heat}°
        </span>
      )}
    </p>
  );
}

/**
 * Compact evidence strip at the foot of a topic card: where the AI found the
 * topic, the raw reaction/comment counts, measurement date and source link.
 */
export function SourceMetrics({
  source,
  heatRank,
  locale = 'he',
}: {
  source: DeskSource;
  /** 1-based rank by engagement heat across all live topics. */
  heatRank?: number;
  locale?: Locale;
}) {
  const t = COPY[locale];
  const fetched = source.fetchedAt
    ? new Intl.DateTimeFormat('he-IL', {
        day: '2-digit',
        month: '2-digit',
        timeZone: 'Asia/Jerusalem',
      }).format(new Date(source.fetchedAt))
    : null;

  return (
    <aside className={styles.aiCallout}>
      <div className={styles.aiHead}>
        <span className={styles.aiKicker}>
          <span aria-hidden className={styles.aiPulse} />
          {t.aiKicker}
        </span>
        {heatRank ? (
          <span className={styles.rankBadge}>{t.rankBadge(heatRank)}</span>
        ) : null}
      </div>

      <p className={styles.aiLine}>{t.postsLine(source.postCount)}</p>

      <div className={styles.aiStats}>
        <Sentiment source={source} locale={locale} />

        {fetched ? (
          <span className={styles.fetchedAt} title={t.fetchedTitle}>
            {t.measuredAt(fetched)}
          </span>
        ) : null}

        {source.url ? (
          <a
            className={styles.sourceLink}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.originalPostLink}
          </a>
        ) : null}
      </div>
    </aside>
  );
}

/** Press-readable label for a coverage URL: ynet.co.il → ynet. */
function refLabel(url: string, fallback: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').replace(/\.co\.il$|\.com$|\.org\.il$/, '');
  } catch {
    return fallback;
  }
}

/**
 * Compact evidence strip for ranked Knesset items: editorial heat, why the
 * desk ranked it, and the Israeli press coverage the ranker verified.
 */
export function RankingMetrics({
  ranking,
  heatRank,
  locale = 'he',
}: {
  ranking: DeskRanking;
  /** 1-based rank by editorial heat across the desk. */
  heatRank?: number;
  locale?: Locale;
}) {
  const t = COPY[locale];
  const ranked = ranking.rankedAt
    ? new Intl.DateTimeFormat('he-IL', {
        day: '2-digit',
        month: '2-digit',
        timeZone: 'Asia/Jerusalem',
      }).format(new Date(ranking.rankedAt))
    : null;

  return (
    <aside className={styles.aiCallout}>
      <div className={styles.aiHead}>
        <span className={styles.aiKicker}>
          <span aria-hidden className={styles.aiPulse} />
          {t.rankedKicker}
        </span>
        <span className={styles.rankBadge}>
          {heatRank ? `${t.rankBadge(heatRank)} · ` : ''}
          {ranking.hotness}°
        </span>
      </div>

      {/* The rationale is the tile's standfirst, so the strip does not repeat
          it - what is left here is the counted evidence behind the score. */}

      <div className={styles.aiStats}>
        <span className={styles.reactions}>
          {ranking.relevance !== null ? (
            <span className={styles.reaction} title={t.relevanceTitle}>
              <span aria-hidden>◉</span>
              {t.relevanceLabel(ranking.relevance)}
            </span>
          ) : null}
          {ranking.outletsCounted !== null ? (
            <span className={styles.reaction} title={t.outletsTitleVerified}>
              <span aria-hidden>▤</span>
              {t.outlets(ranking.outletsCounted)}
            </span>
          ) : ranking.media !== null ? (
            <span className={styles.reaction} title={t.mediaTitle}>
              <span aria-hidden>▤</span>
              {t.mediaLabel(ranking.media)}
            </span>
          ) : null}
        </span>

        {ranked ? (
          <span className={styles.fetchedAt} title={t.rankedTitle}>
            {t.rankedAt(ranked)}
          </span>
        ) : null}

        {ranking.mediaRefs.slice(0, 3).map((url) => (
          <a
            key={url}
            className={styles.sourceLink}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={url}
          >
            {refLabel(url, t.refFallback)} ↗
          </a>
        ))}
      </div>
    </aside>
  );
}

/**
 * One-line evidence summary for dense index rows and bento tiles: the heat,
 * how the source reacted, and the way back to it. The full strip stays on
 * lead tiles.
 */
export function SourceLine({
  source,
  /** Bento tiles print heat on their slug line and pass `false` to avoid
   *  saying it twice; index rows have no slug line and keep it here. */
  heat = true,
  locale = 'he',
}: {
  source: DeskSource;
  heat?: boolean;
  locale?: Locale;
}) {
  const t = COPY[locale];
  return (
    <p className={styles.sourceLine}>
      {heat ? (
        <span className={styles.sourceLineHeat} title={t.sourceHeatTitle}>
          <span aria-hidden>●</span> {source.hotness}°
        </span>
      ) : null}
      <Sentiment source={source} locale={locale} />
      {source.url ? (
        <a
          className={styles.sourceLink}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t.postLink}
        </a>
      ) : null}
    </p>
  );
}

/**
 * One-line editorial summary for a ranked Knesset item - the brief-tile
 * counterpart of `RankingMetrics`, using the same counted facts and glyphs.
 */
export function RankingLine({
  ranking,
  locale = 'he',
}: {
  ranking: DeskRanking;
  locale?: Locale;
}) {
  const t = COPY[locale];
  return (
    <p className={styles.sourceLine}>
      <span className={styles.reactions}>
        {ranking.outletsCounted !== null ? (
          <span className={styles.reaction} title={t.outletsTitle}>
            <span aria-hidden>▤</span>
            {t.outlets(ranking.outletsCounted)}
          </span>
        ) : null}
        {ranking.relevance !== null ? (
          <span className={styles.reaction} title={t.relevanceTitle}>
            <span aria-hidden>◉</span>
            {t.relevanceLabel(ranking.relevance)}
          </span>
        ) : null}
      </span>
    </p>
  );
}

interface DeskTopicRowProps {
  topic: DeskTopic;
  /** Municipality the topic belongs to - shown as a chip inside the card. */
  municipality: string;
  index: number;
  /** 1-based rank by engagement heat across the whole stream (sourced topics only). */
  heatRank?: number;
  /** Editorial ranking (Knesset items) - rendered when there is no social source. */
  ranking?: DeskRanking | null;
  /** Bento cell this card has to fill. Defaults to the 1×1 brief. */
  variant?: DeskTopicVariant;
  /**
   * Opens the quick ballot without leaving the desk. `optionId` is the side a
   * swipe carried in, and the ballot opens on its confirmation step - the push
   * is the choice, so asking for it again would make the gesture decorative.
   */
  onOpen?: (topic: DeskTopic, optionId?: string) => void;
  /**
   * Play the swipe lesson on this tile: the three edge cues, lit in turn.
   *
   * The gesture is otherwise undiscoverable - the cues only appear once a tile
   * is already in hand, which is no use to a reader who does not know there is
   * anything to take hold of. Exactly one tile is ever asked, once per reader;
   * DeskStream picks which.
   */
  tutor?: boolean;
  /**
   * Called the first time this tile is substantially on screen, so the stream
   * can hand the lesson to a tile the reader can actually see. Passed only
   * while the lesson is unclaimed - its absence is what stops the tile
   * watching itself for no reason.
   */
  onTutorVisible?: (index: number) => void;
  locale: Locale;
}

/** One bento tile: municipality chip, headline, consensus meters, evidence. */
export function DeskTopicRow({
  topic,
  municipality,
  index,
  heatRank,
  ranking = null,
  variant = 'brief',
  onOpen,
  tutor = false,
  onTutorVisible,
  locale,
}: DeskTopicRowProps) {
  const t = COPY[locale];
  const days = daysRemaining(topic.endDate);
  const isLead = variant === 'lead';
  // `wide` is a brief lying down - same copy, a 2×1 cell instead of a 1×1. Only
  // the stylesheet knows the difference.
  const isBrief = variant === 'brief' || variant === 'wide';

  // Editorial heat where the desk ranked the item, engagement heat otherwise.
  const heat = ranking?.hotness ?? topic.source?.hotness ?? null;
  const parts = topic.titleParts ?? null;
  // A curated headline says what the item *does*; the citation split can only
  // say what statute it amends. Prefer the curated one where the ranker has
  // written it, and drop the qualifying clause with it - the headline already
  // carries that meaning, and repeating `תיקון 29` under it is noise. The
  // instrument kicker stays either way: it is true of the item, not of the
  // wording.
  const curated = ranking?.headline?.trim() || null;
  const headline = topicHeadline(topic, ranking);
  // Every Knesset item carries the same agenda boilerplate as its description
  // ("sitting 417, item 1 - the vote here measures the civic majority"), so a
  // desk of them printed one identical standfirst eight times. The ranker's
  // rationale is the only per-topic sentence we have; where it exists it is
  // the standfirst, and the evidence strip stops repeating it.
  const standfirst = ranking?.rationale ?? topic.description;
  const open = useCallback(
    (optionId?: string) => {
      if (onOpen) onOpen(topic, optionId);
      else {
        // No dialog on a server desk. `?option=` is the same deep link the
        // ballot already restores after a sign-in round-trip, so the swipe
        // lands the reader on the confirmation step either way.
        const query = optionId ? `?option=${encodeURIComponent(optionId)}` : '';
        window.location.assign(`${localePrefix(locale)}/votes/${topic.id}${query}`);
      }
    },
    [locale, onOpen, topic]
  );

  /* Set aside is the reader's own edition, held on their device - so it can
     only be read after mount, or the server and the client would print
     different tiles. */
  const [aside, setAside] = useState(false);
  useEffect(() => {
    setAside(getAsideTopics().includes(topic.id));
  }, [topic.id]);

  const { forOption, againstOption } = standingOf(topic.options);
  const commit = useCallback(
    (cast: SwipeIntent) => {
      if (cast === 'aside') {
        setTopicAside(topic.id);
        setAside(true);
        return;
      }
      open((cast === 'for' ? forOption : againstOption)?.id);
    },
    [againstOption, forOption, open, topic.id]
  );

  const swipe = useVoteSwipe<HTMLLIElement>({
    onCommit: commit,
    rtl: locale === 'he',
    disabled: aside,
  });

  /* ---- The swipe lesson ------------------------------------------------
     Offered to the stream the first time this tile is properly on screen.
     0.6 rather than any sliver: the lesson lights three cues pinned to three
     edges, and a tile with one edge showing would teach a gesture pointing
     off the side of the desk. The observer disconnects the moment it offers,
     claimed or not - a tile scrolling in and out must not keep bidding. */
  useEffect(() => {
    const el = swipe.ref.current;
    if (!onTutorVisible || !el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.6) return;
        observer.disconnect();
        onTutorVisible(index);
      },
      { threshold: [0.6] }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onTutorVisible, index, swipe.ref]);

  /* The lesson is over when it has been read once, or the moment the reader
     touches the tile - somebody already pushing it does not need telling. */
  const [teaching, setTeaching] = useState(false);
  useEffect(() => {
    if (!tutor) return;
    setTeaching(true);
    const done = setTimeout(() => setTeaching(false), TUTOR_MS);
    return () => clearTimeout(done);
  }, [tutor]);

  useEffect(() => {
    if (swipe.phase !== 'idle') setTeaching(false);
  }, [swipe.phase]);

  return (
    <li
      ref={swipe.ref}
      className={`${styles.topicCard} ${
        isLead
          ? styles.topicCardLead
          : variant === 'feature'
            ? styles.topicCardFeature
            : variant === 'wide'
              ? styles.topicCardWide
              : styles.topicCardBrief
      }`}
      data-swipe={swipe.phase === 'idle' ? undefined : swipe.phase}
      data-swipe-tutor={teaching || undefined}
      data-swipe-intent={swipe.intent ?? undefined}
      data-swipe-ready={(swipe.ready && swipe.intent) || undefined}
      data-aside={aside || undefined}
      /* Lenis owns the page's scroll; while a tile has the pointer it must
         not also be feeding it. */
      data-lenis-prevent={swipe.phase === 'armed' ? '' : undefined}
    >
      {topic.artUrl ? (
        /* Decorative plate under the type; plain <img> on purpose - the file
           is a pre-optimized WebP from storage and next/image optimization is
           unverified on the Workers runtime. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={topic.artUrl}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          className={styles.topicArt}
        />
      ) : null}

      <SlugLine index={index} heat={heat} locale={locale} />

      {/* The edition sits with the slug rule, not with the copy: on a two-row
          tile the headline centres in the tile's slack, and a chip carried
          along with it drifted to the middle of the card. */}
      {isMunicipality(municipality) ? (
        <Link
          href={municipalityHref(municipality)}
          className={styles.topicMuni}
          title={t.muniProfileTitle(municipality)}
        >
          {municipality}
        </Link>
      ) : (
        <span className={styles.topicMuni}>{municipality}</span>
      )}

      <div className={styles.topicBody}>
        <div className={styles.topicHead}>
          {parts?.kicker ? (
            <span className={styles.billKicker}>{parts.kicker}</span>
          ) : null}

          <h3 className={styles.topicTitle}>
            <button type="button" className={styles.topicLink} onClick={() => open()}>
              {headline}
            </button>
          </h3>

          {!curated && parts?.qualifier ? (
            <span className={styles.billQualifier}>{parts.qualifier}</span>
          ) : null}

          <p className={isLead ? styles.topicDescLead : styles.topicDesc}>
            {standfirst}
          </p>
        </div>

        <div className={styles.topicFoot}>
          {/* Printed open or closed: a topic with no ballots yet is not a tile
              with a missing instrument, it is a scale at rest. */}
          <SovereignScale
            options={topic.options}
            national={!isMunicipality(municipality)}
            locale={locale}
          />

          <p className={styles.topicMeta}>
            <span>{t.participants(he(topic.participantCount))}</span>
            <span aria-hidden>·</span>
            <span>{t.daysLeft(days)}</span>
            {!isLead && heatRank ? (
              <>
                <span aria-hidden>·</span>
                <span className={styles.metaHeat}>{t.rankBadge(heatRank)}</span>
              </>
            ) : null}
          </p>

          {isBrief ? (
            topic.source ? (
              <SourceLine source={topic.source} heat={false} locale={locale} />
            ) : ranking ? (
              <RankingLine ranking={ranking} locale={locale} />
            ) : null
          ) : (
            /* Both tall tiles carry the full attribution - who found the
               topic, why it ranks, what it was measured against. It is the
               honest way to spend a two-row cell: a tall column filled with
               evidence rather than with the whitespace left over from a
               brief's copy.

               Below the bento breakpoint the desks flatten to a row of
               same-size cards, where that strip would make one card tower
               over its neighbours. Both depths are in the DOM and CSS shows
               exactly one - `display: none` keeps the other out of the
               accessibility tree too. */
            <>
              <div className={styles.evidenceWide}>
                {topic.source ? (
                  <SourceMetrics
                    source={topic.source}
                    heatRank={heatRank}
                    locale={locale}
                  />
                ) : ranking ? (
                  <RankingMetrics
                    ranking={ranking}
                    heatRank={heatRank}
                    locale={locale}
                  />
                ) : null}
              </div>
              <div className={styles.evidenceNarrow}>
                {topic.source ? (
                  <SourceLine source={topic.source} heat={false} locale={locale} />
                ) : ranking ? (
                  <RankingLine ranking={ranking} locale={locale} />
                ) : null}
              </div>
            </>
          )}

          {isLead ? (
            <button type="button" className={styles.leadCta} onClick={() => open()}>
              {t.leadCta}
              <span aria-hidden>{t.ctaArrow}</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* The three answers, each printed on the edge it lives on, and lit as
          the tile is pushed toward it. Decorative: the gesture is a shortcut
          past the headline button, and everything here is said again in the
          ballot it opens. */}
      <div className={styles.swipeCues} aria-hidden>
        <span className={styles.swipeCue} data-cue="for">
          {t.swipeFor}
        </span>
        <span className={styles.swipeCue} data-cue="against">
          {t.swipeAgainst}
        </span>
        <span className={styles.swipeCue} data-cue="aside">
          {t.swipeAside}
        </span>
        <span className={styles.swipeHint}>{t.swipeHint}</span>
      </div>

      {/* Pushed far enough that letting go casts it: the tile stops being a
          tinted headline and becomes the answer, in one colour, at the size
          of the thing being said. Nothing is counted until the reader lets
          go - this is the tile telling them what will happen if they do. */}
      <span className={styles.swipeWash} aria-hidden>
        {swipe.intent === 'for'
          ? t.swipeFor
          : swipe.intent === 'against'
            ? t.swipeAgainst
            : t.swipeAside}
      </span>

      {swipe.phase === 'cast' && swipe.intent && swipe.intent !== 'aside' ? (
        <p className={styles.swipeStamp} data-cue={swipe.intent}>
          {swipe.intent === 'for' ? t.swipeCastFor : t.swipeCastAgainst}
        </p>
      ) : null}

      {aside ? (
        <div className={styles.asidePanel}>
          <p className={styles.asideTitle}>{t.asideTitle}</p>
          <p className={styles.asideNote}>{t.asideNote}</p>
          <button
            type="button"
            className={styles.asideUndo}
            onClick={() => {
              restoreTopic(topic.id);
              setAside(false);
            }}
          >
            {t.asideUndo}
          </button>
        </div>
      ) : null}
    </li>
  );
}
