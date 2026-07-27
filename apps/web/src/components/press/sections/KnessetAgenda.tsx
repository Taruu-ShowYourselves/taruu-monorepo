import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import type { DeskTopic } from './DeskTopicRow';
import {
  formatAgendaDate,
  weekdayOf,
  type AgendaRow as AgendaRowData,
  type AgendaSession,
  type KnessetAgenda as KnessetAgendaData,
} from './knessetAgendaData';
import styles from './KnessetAgenda.module.css';

function daysRemaining(endDate: string): number {
  const ms = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function ConsensusMeters({ topic }: { topic: DeskTopic }) {
  const hasBallots = topic.options.some((o) => o.votes > 0);
  const days = daysRemaining(topic.endDate);

  return (
    <>
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

      <p className={styles.itemMeta}>
        <span>{topic.participantCount} משתתפים</span>
        <span aria-hidden>·</span>
        <span>{days === 0 ? 'מסתיים היום' : `נותרו ${days} ימים`}</span>
      </p>
    </>
  );
}

function AgendaItemRow({
  row,
  position,
  locale,
}: {
  row: AgendaRowData;
  position: number;
  locale: Locale;
}) {
  const { topic } = row;

  return (
    <li className={styles.itemRow}>
      {/* Sequence position, not the official Ordinal — Knesset ordinals
          restart per agenda section, so raw values repeat (many "01"s). */}
      <span className={styles.itemOrdinal} aria-hidden>
        {String(position).padStart(2, '0')}
      </span>

      <div className={styles.itemBody}>
        {row.itemType ? (
          <span className={styles.itemType}>{row.itemType}</span>
        ) : null}

        <h3 className={styles.itemTitle}>
          <Link href={`/${locale}/votes/${topic.id}`} className={styles.itemLink}>
            {topic.title}
          </Link>
        </h3>

        <ConsensusMeters topic={topic} />

        <Link href={`/${locale}/votes/${topic.id}`} className={styles.voteCta}>
          להצבעה ←
        </Link>
      </div>
    </li>
  );
}

function SessionBlock({
  session,
  locale,
}: {
  session: AgendaSession;
  locale: Locale;
}) {
  const date = formatAgendaDate(session.sessionDate);
  const weekday = weekdayOf(session.sessionDate);

  return (
    <section aria-labelledby={`plm-${session.plenumSessionId}`}>
      <header className={styles.sessionHeader}>
        <span className={styles.sessionStamp}>סדר יום · DAY ORDER</span>
        <h2 id={`plm-${session.plenumSessionId}`} className={styles.sessionTitle}>
          ישיבת מליאה
          {session.sessionNumber ? ` מס׳ ${session.sessionNumber}` : ''}
          {date ? ` — ${weekday ? `${weekday}, ` : ''}${date}` : ''}
        </h2>
        {session.knessetNum ? (
          <span className={styles.sessionMeta}>הכנסת ה־{session.knessetNum}</span>
        ) : null}
      </header>

      <ol className={styles.itemList}>
        {session.rows.map((row, i) => (
          <AgendaItemRow
            key={row.topic.id}
            row={row}
            position={i + 1}
            locale={locale}
          />
        ))}
      </ol>
    </section>
  );
}

interface KnessetAgendaProps {
  agenda: KnessetAgendaData;
  locale: Locale;
}

/**
 * KnessetAgenda — the plenum day order (סדר יום המליאה) as a broadsheet
 * index: one block per sitting, entries in their official order, each one
 * a live ballot. National topics without sitting metadata trail at the end.
 */
export function KnessetAgenda({ agenda, locale }: KnessetAgendaProps) {
  return (
    <div className={styles.agenda}>
      {agenda.sessions.map((session) => (
        <SessionBlock
          key={session.plenumSessionId}
          session={session}
          locale={locale}
        />
      ))}

      {agenda.extras.length > 0 ? (
        <section aria-labelledby="knesset-extras">
          <header className={styles.sessionHeader}>
            <h2 id="knesset-extras" className={styles.extrasHeader}>
              ■ עוד על הדסק הארצי
            </h2>
          </header>
          <ol className={styles.itemList}>
            {agenda.extras.map((topic, i) => (
              <AgendaItemRow
                key={topic.id}
                row={{
                  topic,
                  ordinal: null,
                  itemType: null,
                  isDiscussion: false,
                }}
                position={i + 1}
                locale={locale}
              />
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
