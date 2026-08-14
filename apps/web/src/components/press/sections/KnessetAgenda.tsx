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
import { localePrefix } from '@/lib/i18n';

interface KnessetAgendaCopy {
  noBallots: string;
  participants: string;
  endsToday: string;
  daysLeft: (days: number) => string;
  sessionStamp: string;
  plenumSession: string;
  sessionNo: (n: number) => string;
  knessetNum: (n: number) => string;
  voteCta: string;
  extrasHeader: string;
}

const COPY: Record<Locale, KnessetAgendaCopy> = {
  he: {
    noBallots: 'טרם נרשמו קולות',
    participants: 'משתתפים',
    endsToday: 'מסתיים היום',
    daysLeft: (days) => `נותרו ${days} ימים`,
    sessionStamp: 'סדר יום · DAY ORDER',
    plenumSession: 'ישיבת מליאה',
    sessionNo: (n) => ` מס׳ ${n}`,
    knessetNum: (n) => `הכנסת ה־${n}`,
    voteCta: 'להצבעה ←',
    extrasHeader: '■ עוד על הדסק הארצי',
  },
  en: {
    noBallots: 'No ballots recorded yet',
    participants: 'participants',
    endsToday: 'Ends today',
    daysLeft: (days) => `${days} days remaining`,
    sessionStamp: 'ORDER OF THE DAY',
    plenumSession: 'Plenum sitting',
    sessionNo: (n) => ` No. ${n}`,
    knessetNum: (n) => `Knesset ${n}`,
    voteCta: 'To the vote →',
    extrasHeader: '■ More from the national desk',
  },
};

function daysRemaining(endDate: string): number {
  const ms = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function ConsensusMeters({ topic, locale }: { topic: DeskTopic; locale: Locale }) {
  const t = COPY[locale];
  const hasBallots = topic.options.some((o) => o.votes > 0);
  const days = daysRemaining(topic.endDate);

  // A silent ballot has nothing to measure - one quiet line instead of
  // meter furniture plus a zero-participant count.
  if (!hasBallots) {
    return (
      <p className={styles.noBallots}>
        <span>{t.noBallots}</span>
        <span aria-hidden>·</span>
        <span>{days === 0 ? t.endsToday : t.daysLeft(days)}</span>
      </p>
    );
  }

  return (
    <>
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

      <p className={styles.itemMeta}>
        <span>{topic.participantCount} {t.participants}</span>
        <span aria-hidden>·</span>
        <span>{days === 0 ? t.endsToday : t.daysLeft(days)}</span>
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
  const t = COPY[locale];

  return (
    <li className={styles.itemRow}>
      {/* Sequence position, not the official Ordinal - Knesset ordinals
          restart per agenda section, so raw values repeat (many "01"s). */}
      <span className={styles.itemOrdinal} aria-hidden>
        {String(position).padStart(2, '0')}
      </span>

      <div className={styles.itemBody}>
        {row.itemType ? (
          <span className={styles.itemType}>{row.itemType}</span>
        ) : null}

        <h3 className={styles.itemTitle}>
          <Link href={`${localePrefix(locale)}/votes/${topic.id}`} className={styles.itemLink}>
            {topic.title}
          </Link>
        </h3>

        <ConsensusMeters topic={topic} locale={locale} />

        <Link href={`${localePrefix(locale)}/votes/${topic.id}`} className={styles.voteCta}>
          {t.voteCta}
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
  const t = COPY[locale];
  const date = formatAgendaDate(session.sessionDate);
  const weekday = weekdayOf(session.sessionDate, locale);

  return (
    <section aria-labelledby={`plm-${session.plenumSessionId}`}>
      {/* ~111 entries scroll as one river - a slim line pinned under the
          masthead keeps the current sitting's date in view. It repeats the
          h2 below, so screen readers skip it. */}
      <div className={styles.sessionTicker} aria-hidden>
        <span className={styles.tickerKicker}>
          {t.plenumSession}
          {session.sessionNumber ? t.sessionNo(session.sessionNumber) : ''}
        </span>
        {date ? (
          <span className={styles.tickerDate}>
            {weekday ? `${weekday}, ` : ''}
            {date}
          </span>
        ) : null}
      </div>

      <header className={styles.sessionHeader}>
        <span className={styles.sessionStamp}>{t.sessionStamp}</span>
        <h2 id={`plm-${session.plenumSessionId}`} className={styles.sessionTitle}>
          {t.plenumSession}
          {session.sessionNumber ? t.sessionNo(session.sessionNumber) : ''}
          {date ? ` · ${weekday ? `${weekday}, ` : ''}${date}` : ''}
        </h2>
        {session.knessetNum ? (
          <span className={styles.sessionMeta}>{t.knessetNum(session.knessetNum)}</span>
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
 * KnessetAgenda - the plenum day order (סדר יום המליאה) as a broadsheet
 * index: one block per sitting, entries in their official order, each one
 * a live ballot. National topics without sitting metadata trail at the end.
 */
export function KnessetAgenda({ agenda, locale }: KnessetAgendaProps) {
  const t = COPY[locale];
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
              {t.extrasHeader}
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
