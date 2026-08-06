import Link from 'next/link';
import {
  isMunicipality,
  municipalityHref,
} from '@/components/uikit/municipality-link';
import { reactionSentiment } from '@/components/press/reactions';
import type { BillTitle } from '@/lib/knesset/billTitle';
import { topicHeadline } from './deskData';
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

function daysRemaining(endDate: string): number {
  const ms = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
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
  leadingNow: string;
  noBallots: string;
  participants: (count: string) => string;
  daysLeft: (days: number) => string;
  leadCta: string;
  /** Direction-semantic CTA glyph: mirrored between RTL and LTR. */
  ctaArrow: string;
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
    leadingNow: 'מוביל עכשיו',
    noBallots: 'טרם נפתחו קולות',
    participants: (count) => `${count} משתתפים`,
    daysLeft: (days) => (days === 0 ? 'מסתיים היום' : `נותרו ${days} ימים`),
    leadCta: 'הצביעו · VOTE',
    ctaArrow: '←',
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
    leadingNow: 'Leading now',
    noBallots: 'No ballots cast yet',
    participants: (count) => `${count} participants`,
    daysLeft: (days) => (days === 0 ? 'Ends today' : `${days} days left`),
    leadCta: 'Cast your ballot · VOTE',
    ctaArrow: '→',
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

/**
 * Three tile weights, three depths of story.
 *
 * `lead` fills a 2×2 cell as an ink block: the whole standing, the full
 * evidence, a ballot door. `feature` fills a tall 1×2 column - the whole
 * standing, but at brief typography. `brief` fills a 1×1: the headline, where
 * the count leads, one line of evidence.
 *
 * The variants exist because one card body cannot honestly fill every cell.
 * Rendering the same content at both sizes left the big tile two-thirds empty
 * and overflowed the small one - the evidence strip spilled through the card
 * border, which is how the heat badges ended up floating outside the box.
 */
export type DeskTopicVariant = 'lead' | 'feature' | 'brief';

/** Tiles per bento stretch - see {@link slotVariant} for how they tile. */
const STRETCH = 6;

/**
 * The weight of the tile at this position in the running order.
 *
 * A stretch of six tiles exactly fills five bento columns: the lead takes two
 * whole columns, the feature one, and the four briefs pair up into the last
 * two. Because every column ends up full, the mosaic never opens a hole - the
 * failure mode of mixing spans under `grid-auto-flow: column dense`.
 *
 * Both desks hand their rows in running order - heat-and-locality for the
 * civic desk, editorial heat for the national one - so slot 0 of every stretch
 * is genuinely its top story rather than an arbitrary cell.
 */
export function slotVariant(index: number): DeskTopicVariant {
  const slot = index % STRETCH;
  if (slot === 0) return 'lead';
  if (slot === 1) return 'feature';
  return 'brief';
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
  /** Opens the quick ballot without leaving the desk. */
  onOpen?: (topic: DeskTopic) => void;
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
  locale,
}: DeskTopicRowProps) {
  const t = COPY[locale];
  const days = daysRemaining(topic.endDate);
  const hasBallots = topic.options.some((o) => o.votes > 0);
  const isLead = variant === 'lead';
  const isBrief = variant === 'brief';

  // The brief tile prints the leading position only; the full split is one
  // click away and does not fit a 1×1 cell without pushing the card open.
  const meters = isBrief ? topic.options.slice(0, 1) : topic.options;
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
  const open = () => {
    if (onOpen) onOpen(topic);
    else window.location.assign(`${localePrefix(locale)}/votes/${topic.id}`);
  };

  return (
    <li
      className={`${styles.topicCard} ${
        isLead
          ? styles.topicCardLead
          : variant === 'feature'
            ? styles.topicCardFeature
            : ''
      }`}
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
            <button type="button" className={styles.topicLink} onClick={open}>
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
          {hasBallots ? (
            <>
              {isBrief ? (
                <span className={styles.meterKicker}>{t.leadingNow}</span>
              ) : null}
              <ul className={styles.meterList}>
                {meters.map((option) => (
                  <li key={option.id} className={styles.meterRow}>
                    <span className={styles.meterLabel}>{option.text}</span>
                    <span className={styles.meterTrack}>
                      <span
                        className={styles.meterFill}
                        style={{ inlineSize: `${option.pct}%` }}
                        aria-hidden
                      />
                    </span>
                    <span className={styles.meterPct}>{option.pct}%</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            /* Printed on every unopened topic, so it earns one tight mono line
               and not a sentence - eight identical paragraphs down a desk read
               as noise rather than as an invitation. */
            <p className={styles.noBallots}>
              <span aria-hidden>▍</span> {t.noBallots}
            </p>
          )}

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
            <button type="button" className={styles.leadCta} onClick={open}>
              {t.leadCta}
              <span aria-hidden>{t.ctaArrow}</span>
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
