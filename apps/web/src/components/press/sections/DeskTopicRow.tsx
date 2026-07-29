import Link from 'next/link';
import {
  isMunicipality,
  municipalityHref,
} from '@/components/uikit/municipality-link';
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
   * Distinct Israeli outlets with live coverage from the last two weeks —
   * the counted fact the media sub-score is derived from. Null for rows
   * ranked before the ranker counted its evidence (judgment-only scores).
   */
  outletsCounted: number | null;
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

/** Facebook reaction kinds → press glyphs, in display order. */
const REACTION_GLYPHS: [string, string][] = [
  ['like', '👍'],
  ['love', '❤️'],
  ['haha', '😆'],
  ['wow', '😮'],
  ['sad', '😢'],
  ['angry', '😡'],
];

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
        <span className={styles.reactions} title="ריאקציות על הפוסטים המקוריים">
          {REACTION_GLYPHS.filter(([kind]) => (source.reactions[kind] ?? 0) > 0).map(
            ([kind, glyph]) => (
              <span key={kind} className={styles.reaction}>
                <span aria-hidden>{glyph}</span>
                {(source.reactions[kind] ?? 0).toLocaleString('he-IL')}
              </span>
            )
          )}
          <span className={styles.reaction}>
            <span aria-hidden>💬</span>
            {source.commentsCount.toLocaleString('he-IL')}
          </span>
        </span>

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

      {ranking.rationale ? (
        <p className={styles.aiLine}>{ranking.rationale}</p>
      ) : null}

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
              title="כלי תקשורת ישראליים שסיקרו את הנושא בשבועיים האחרונים — נספרו ואומתו"
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
 * One-line evidence summary for dense index rows (explore desks): heat,
 * reaction counts, source link. The full strip stays on the desk cards.
 */
export function SourceLine({ source }: { source: DeskSource }) {
  return (
    <p className={styles.sourceLine}>
      <span
        className={styles.sourceLineHeat}
        title="מדד חום: תגובות וריאקציות על הפוסטים המקוריים"
      >
        🔥 {source.hotness}°
      </span>
      <span className={styles.reactions}>
        {REACTION_GLYPHS.filter(([kind]) => (source.reactions[kind] ?? 0) > 0).map(
          ([kind, glyph]) => (
            <span key={kind} className={styles.reaction}>
              <span aria-hidden>{glyph}</span>
              {(source.reactions[kind] ?? 0).toLocaleString('he-IL')}
            </span>
          )
        )}
        <span className={styles.reaction}>
          <span aria-hidden>💬</span>
          {source.commentsCount.toLocaleString('he-IL')}
        </span>
      </span>
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

interface DeskTopicRowProps {
  topic: DeskTopic;
  /** Municipality the topic belongs to — shown as a chip inside the card. */
  municipality: string;
  index: number;
  /** 1-based rank by engagement heat across the whole stream (sourced topics only). */
  heatRank?: number;
  /** Editorial ranking (Knesset items) — rendered when there is no social source. */
  ranking?: DeskRanking | null;
  locale: string;
}

/** One numbered index entry: municipality chip, title, source engagement, consensus meters. */
export function DeskTopicRow({
  topic,
  municipality,
  index,
  heatRank,
  ranking = null,
  locale,
}: DeskTopicRowProps) {
  const days = daysRemaining(topic.endDate);
  const hasBallots = topic.options.some((o) => o.votes > 0);

  return (
    <li className={styles.topicCard}>
      <span className={styles.topicNo} aria-hidden>
        {String(index + 1).padStart(2, '0')}
      </span>

      <div className={styles.topicBody}>
        {isMunicipality(municipality) ? (
          <Link
            href={municipalityHref(municipality)}
            className={styles.topicMuni}
            title={`פרופיל רשות — ${municipality}`}
          >
            {municipality}
          </Link>
        ) : (
          <span className={styles.topicMuni}>{municipality}</span>
        )}

        <h3 className={styles.topicTitle}>
          <Link href={`/${locale}/votes/${topic.id}`} className={styles.topicLink}>
            {topic.title}
          </Link>
        </h3>
        <p className={styles.topicDesc}>{topic.description}</p>

        {hasBallots ? (
          <ul className={styles.meterList}>
            {topic.options.map((option) => (
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
        ) : (
          <p className={styles.noBallots}>עדיין אין קולות. הקול הראשון פתוח.</p>
        )}

        <p className={styles.topicMeta}>
          <span>{topic.participantCount} משתתפים</span>
          <span aria-hidden>·</span>
          <span>{days === 0 ? 'מסתיים היום' : `נותרו ${days} ימים`}</span>
        </p>

        {topic.source ? (
          <SourceMetrics source={topic.source} heatRank={heatRank} />
        ) : ranking ? (
          <RankingMetrics ranking={ranking} heatRank={heatRank} />
        ) : null}
      </div>
    </li>
  );
}
