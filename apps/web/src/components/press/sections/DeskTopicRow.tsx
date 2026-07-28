import Link from 'next/link';
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
 * The AI-discovery callout — the table-flip in one paragraph: our machine
 * heard the street shouting on Facebook, measured it, and promoted it to a
 * verified ballot.
 */
export function SourceMetrics({ source }: { source: DeskSource }) {
  const comments = source.commentsCount.toLocaleString('he-IL');
  const reactions = source.reactionsTotal.toLocaleString('he-IL');

  return (
    <aside className={styles.aiCallout}>
      <span className={styles.aiKicker}>
        <span aria-hidden className={styles.aiPulse} />
        ה־AI שלנו איתר · FROM FEED TO BALLOT
      </span>

      <p className={styles.aiLede}>
        המערכת סימנה את הנושא הזה כי הרחוב כבר בוער:{' '}
        <strong className={styles.aiNum}>{comments} תגובות</strong> ו־
        <strong className={styles.aiNum}>{reactions} ריאקציות</strong>
        {source.postCount > 1 ? (
          <> על <strong className={styles.aiNum}>{source.postCount} פוסטים</strong> בפייסבוק</>
        ) : (
          <> על הפוסט המקורי בפייסבוק</>
        )}
        {' '}— אז הפכנו אותו מרעש ברשת להצבעה מאומתת.
      </p>

      <div className={styles.aiStats}>
        {/* Hotness — engagement thermometer */}
        <span
          className={styles.hotness}
          title="מדד חום — כמה הנושא בוער ברשתות, לפי תגובות וריאקציות"
        >
          <span className={styles.hotnessLabel}>חום</span>
          <span className={styles.hotnessTrack} aria-hidden>
            <span
              className={styles.hotnessFill}
              style={{ inlineSize: `${source.hotness}%` }}
            />
          </span>
          <span className={styles.hotnessDeg}>{source.hotness}°</span>
        </span>

        {/* Per-reaction breakdown */}
        <span className={styles.reactions} title="פירוט הריאקציות על הפוסטים המקוריים">
          {REACTION_GLYPHS.filter(([kind]) => (source.reactions[kind] ?? 0) > 0).map(
            ([kind, glyph]) => (
              <span key={kind} className={styles.reaction}>
                <span aria-hidden>{glyph}</span>
                {(source.reactions[kind] ?? 0).toLocaleString('he-IL')}
              </span>
            )
          )}
        </span>

        {source.url ? (
          <a
            className={styles.sourceLink}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            למקור ←
          </a>
        ) : null}
      </div>
    </aside>
  );
}

interface DeskTopicRowProps {
  topic: DeskTopic;
  index: number;
  locale: string;
}

/** One numbered index entry: title, source engagement, consensus meters. */
export function DeskTopicRow({ topic, index, locale }: DeskTopicRowProps) {
  const days = daysRemaining(topic.endDate);
  const hasBallots = topic.options.some((o) => o.votes > 0);

  return (
    <li className={styles.topicCard}>
      <span className={styles.topicNo} aria-hidden>
        {String(index + 1).padStart(2, '0')}
      </span>

      <div className={styles.topicBody}>
        <h3 className={styles.topicTitle}>
          <Link href={`/${locale}/votes/${topic.id}`} className={styles.topicLink}>
            {topic.title}
          </Link>
        </h3>
        <p className={styles.topicDesc}>{topic.description}</p>

        {topic.source ? <SourceMetrics source={topic.source} /> : null}

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
          <p className={styles.noBallots}>עדיין אין קולות — היו הראשונים.</p>
        )}

        <p className={styles.topicMeta}>
          <span>{topic.participantCount} משתתפים</span>
          <span aria-hidden>·</span>
          <span>{days === 0 ? 'מסתיים היום' : `נותרו ${days} ימים`}</span>
        </p>
      </div>
    </li>
  );
}
