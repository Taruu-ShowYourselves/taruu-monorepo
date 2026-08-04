import Link from 'next/link';
import {
  isMunicipality,
  municipalityHref,
} from '@/components/uikit/municipality-link';
import { reactionSentiment } from '@/components/press/reactions';
import type { BillTitle } from '@/lib/knesset/billTitle';
import { topicHeadline } from './deskData';
import styles from './ConsensusDesk.module.css';

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

/**
 * Approval, objection and comment counts as press glyphs.
 *
 * One shared row so the lead tile's full strip and a brief's one-liner report
 * the same measured facts in the same language.
 */
function Sentiment({ source }: { source: DeskSource }) {
  const { approving, objecting } = reactionSentiment(source.reactions);

  return (
    <span className={styles.reactions}>
      <span
        className={styles.reaction}
        title="ריאקציות אוהדות על הפוסטים המקוריים: לייק, לב, חיוך, וואו"
      >
        <span aria-hidden>▲</span>
        {he(approving)}
      </span>
      <span
        className={styles.reaction}
        title="ריאקציות של מורת רוח: כעס, עצב"
      >
        <span aria-hidden>▼</span>
        {he(objecting)}
      </span>
      <span className={styles.reaction} title="תגובות על הפוסטים המקוריים">
        <span aria-hidden>▣</span>
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
function SlugLine({ index, heat }: { index: number; heat: number | null }) {
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
        <span className={styles.slugUnmeasured} title="הנושא טרם נמדד">
          לא נמדד
        </span>
      ) : (
        <span className={styles.slugHeat} title="מדד חום: כמה הנושא בוער עכשיו">
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
}: {
  source: DeskSource;
  /** 1-based rank by engagement heat across all live topics. */
  heatRank?: number;
}) {
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
          ה־AI שלנו איתר
        </span>
        {heatRank ? (
          <span className={styles.rankBadge}>#{heatRank} בחום</span>
        ) : null}
      </div>

      <p className={styles.aiLine}>
        עלה מתוך{' '}
        {source.postCount === 1 ? 'פוסט' : `${source.postCount} פוסטים`} בקבוצות
        הפייסבוק המקומיות.
      </p>

      <div className={styles.aiStats}>
        <Sentiment source={source} />

        {fetched ? (
          <span className={styles.fetchedAt} title="מועד המדידה האחרון במקור">
            נמדד {fetched}
          </span>
        ) : null}

        {source.url ? (
          <a
            className={styles.sourceLink}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            לפוסט המקורי ←
          </a>
        ) : null}
      </div>
    </aside>
  );
}

/** Press-readable label for a coverage URL: ynet.co.il → ynet. */
function refLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').replace(/\.co\.il$|\.com$|\.org\.il$/, '');
  } catch {
    return 'מקור';
  }
}

/**
 * Compact evidence strip for ranked Knesset items: editorial heat, why the
 * desk ranked it, and the Israeli press coverage the ranker verified.
 */
export function RankingMetrics({
  ranking,
  heatRank,
}: {
  ranking: DeskRanking;
  /** 1-based rank by editorial heat across the desk. */
  heatRank?: number;
}) {
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
          דסק החדשות דירג
        </span>
        <span className={styles.rankBadge}>
          {heatRank ? `#${heatRank} בחום · ` : ''}
          {ranking.hotness}°
        </span>
      </div>

      {/* The rationale is the tile's standfirst, so the strip does not repeat
          it - what is left here is the counted evidence behind the score. */}

      <div className={styles.aiStats}>
        <span className={styles.reactions}>
          {ranking.relevance !== null ? (
            <span className={styles.reaction} title="רלוונטיות לציבור הישראלי">
              <span aria-hidden>◉</span>
              ציבור {ranking.relevance}
            </span>
          ) : null}
          {ranking.outletsCounted !== null ? (
            <span
              className={styles.reaction}
              title="כלי תקשורת ישראליים שסיקרו את הנושא בשבועיים האחרונים - נספרו ואומתו"
            >
              <span aria-hidden>▤</span>
              {ranking.outletsCounted === 0
                ? 'ללא סיקור'
                : `${ranking.outletsCounted} כלי תקשורת`}
            </span>
          ) : ranking.media !== null ? (
            <span className={styles.reaction} title="היקף סיקור תקשורתי עכשווי">
              <span aria-hidden>▤</span>
              תקשורת {ranking.media}
            </span>
          ) : null}
        </span>

        {ranked ? (
          <span className={styles.fetchedAt} title="מועד הדירוג האחרון">
            דורג {ranked}
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
            {refLabel(url)} ↗
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
}: {
  source: DeskSource;
  heat?: boolean;
}) {
  return (
    <p className={styles.sourceLine}>
      {heat ? (
        <span
          className={styles.sourceLineHeat}
          title="מדד חום: תגובות וריאקציות על הפוסטים המקוריים"
        >
          <span aria-hidden>●</span> {source.hotness}°
        </span>
      ) : null}
      <Sentiment source={source} />
      {source.url ? (
        <a
          className={styles.sourceLink}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          לפוסט ←
        </a>
      ) : null}
    </p>
  );
}

/**
 * One-line editorial summary for a ranked Knesset item - the brief-tile
 * counterpart of `RankingMetrics`, using the same counted facts and glyphs.
 */
export function RankingLine({ ranking }: { ranking: DeskRanking }) {
  return (
    <p className={styles.sourceLine}>
      <span className={styles.reactions}>
        {ranking.outletsCounted !== null ? (
          <span
            className={styles.reaction}
            title="כלי תקשורת ישראליים שסיקרו את הנושא בשבועיים האחרונים"
          >
            <span aria-hidden>▤</span>
            {ranking.outletsCounted === 0
              ? 'ללא סיקור'
              : `${ranking.outletsCounted} כלי תקשורת`}
          </span>
        ) : null}
        {ranking.relevance !== null ? (
          <span className={styles.reaction} title="רלוונטיות לציבור הישראלי">
            <span aria-hidden>◉</span>
            ציבור {ranking.relevance}
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
  locale: string;
}

/** One bento tile: municipality chip, headline, consensus meters, evidence. */
export function DeskTopicRow({
  topic,
  municipality,
  index,
  heatRank,
  ranking = null,
  variant = 'brief',
  locale,
}: DeskTopicRowProps) {
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
      <SlugLine index={index} heat={heat} />

      {/* The edition sits with the slug rule, not with the copy: on a two-row
          tile the headline centres in the tile's slack, and a chip carried
          along with it drifted to the middle of the card. */}
      {isMunicipality(municipality) ? (
        <Link
          href={municipalityHref(municipality)}
          className={styles.topicMuni}
          title={`פרופיל רשות - ${municipality}`}
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
            <Link href={`/${locale}/votes/${topic.id}`} className={styles.topicLink}>
              {headline}
            </Link>
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
                <span className={styles.meterKicker}>מוביל עכשיו</span>
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
              <span aria-hidden>▍</span> טרם נפתחו קולות
            </p>
          )}

          <p className={styles.topicMeta}>
            <span>{he(topic.participantCount)} משתתפים</span>
            <span aria-hidden>·</span>
            <span>{days === 0 ? 'מסתיים היום' : `נותרו ${days} ימים`}</span>
            {!isLead && heatRank ? (
              <>
                <span aria-hidden>·</span>
                <span className={styles.metaHeat}>#{heatRank} בחום</span>
              </>
            ) : null}
          </p>

          {isBrief ? (
            topic.source ? (
              <SourceLine source={topic.source} heat={false} />
            ) : ranking ? (
              <RankingLine ranking={ranking} />
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
                  <SourceMetrics source={topic.source} heatRank={heatRank} />
                ) : ranking ? (
                  <RankingMetrics ranking={ranking} heatRank={heatRank} />
                ) : null}
              </div>
              <div className={styles.evidenceNarrow}>
                {topic.source ? (
                  <SourceLine source={topic.source} heat={false} />
                ) : ranking ? (
                  <RankingLine ranking={ranking} />
                ) : null}
              </div>
            </>
          )}

          {isLead ? (
            <Link href={`/${locale}/votes/${topic.id}`} className={styles.leadCta}>
              הצביעו · VOTE
              <span aria-hidden>←</span>
            </Link>
          ) : null}
        </div>
      </div>
    </li>
  );
}
