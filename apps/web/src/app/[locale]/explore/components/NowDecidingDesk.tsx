import Link from 'next/link';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';
import { NewsButton } from '@/components/press/NewsButton';
import { AnimateIn } from '@/components/uikit/animate-in';
import {
  isMunicipality,
  municipalityHref,
} from '@/components/uikit/municipality-link';
import type { Locale } from '@/lib/i18n';
import { SourceLine } from '@/components/press/sections/DeskTopicRow';
import type { NowTopic } from '../data';
import { ShareBar } from './ShareBar';
import styles from './NowDecidingDesk.module.css';

function daysRemaining(endDate: string): number {
  const ms = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function closingLabel(endDate: string): string {
  const days = daysRemaining(endDate);
  return days === 0 ? 'מסתיים היום' : `נותרו ${days} ימים`;
}

function MuniKicker({ name }: { name: string }) {
  if (isMunicipality(name)) {
    return (
      <Link
        href={municipalityHref(name)}
        className={styles.muni}
        title={`פרופיל רשות - ${name}`}
      >
        {name}
      </Link>
    );
  }
  return <span className={styles.muni}>{name}</span>;
}

/** Lead row - headline + top-2 tally bars + mono meta (S3 anatomy). */
function LeadRow({ entry, locale }: { entry: NowTopic; locale: Locale }) {
  const { topic, municipality } = entry;
  const ballots = topic.options.reduce((sum, o) => sum + o.votes, 0);
  const top2 = topic.options.slice(0, 2);

  return (
    <li className={styles.row} data-animate>
      <p className={styles.rowKicker}>
        <MuniKicker name={municipality} />
        <span className={styles.closing}>{closingLabel(topic.endDate)}</span>
      </p>

      <h3 className={styles.rowTitle}>
        <Link href={`/${locale}/votes/${topic.id}`} className={styles.rowLink}>
          {topic.title}
        </Link>
      </h3>

      {ballots > 0 ? (
        <ul className={styles.tallies}>
          {top2.map((option) => (
            <li key={option.id} className={styles.tally}>
              <span className={styles.tallyLabel}>{option.text}</span>
              <ShareBar pct={option.pct} className={styles.tallyBar} />
              <span className={styles.tallyPct}>{option.pct}%</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.noBallots}>עדיין אין קולות. הקול הראשון פתוח.</p>
      )}

      <p className={styles.rowMeta}>
        {ballots.toLocaleString('he-IL')} קולות · {topic.participantCount.toLocaleString('he-IL')} משתתפים
      </p>

      {topic.source ? <SourceLine source={topic.source} /> : null}
    </li>
  );
}

/** Compact row - headline + mono meta only (inline-end column on wide). */
function CompactRow({
  entry,
  index,
  locale,
}: {
  entry: NowTopic;
  index: number;
  locale: Locale;
}) {
  const { topic, municipality } = entry;
  const ballots = topic.options.reduce((sum, o) => sum + o.votes, 0);

  return (
    <li className={styles.compactRow} data-animate={index < 2 ? true : undefined}>
      <span className={styles.compactNo} aria-hidden>
        {String(index + 5).padStart(2, '0')}
      </span>
      <div className={styles.compactBody}>
        <h3 className={styles.compactTitle}>
          <Link href={`/${locale}/votes/${topic.id}`} className={styles.rowLink}>
            {topic.title}
          </Link>
        </h3>
        <p className={styles.compactMeta}>
          <MuniKicker name={municipality} />
          <span aria-hidden>·</span>
          <span>{ballots.toLocaleString('he-IL')} קולות</span>
        </p>
        {topic.source ? <SourceLine source={topic.source} /> : null}
      </div>
    </li>
  );
}

interface NowDecidingDeskProps {
  locale: Locale;
  topics: NowTopic[];
}

/**
 * S3 - מכריעים עכשיו. The hottest live municipal ballots across all desks,
 * hotness-sorted. Ink-on-paper press furniture: hairline rows, no cards.
 * Desktop splits 2fr/1fr - four lead rows inline-start, four compact rows
 * inline-end (VARIANCE 7); strict single column under 768px.
 */
export function NowDecidingDesk({ locale, topics }: NowDecidingDeskProps) {
  const leads = topics.slice(0, 4);
  const compacts = topics.slice(4, 8);

  return (
    <section
      id="now-deciding"
      className={styles.desk}
      aria-labelledby="now-deciding-headline"
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            עכשיו בקלפי · NOW DECIDING
          </span>
          <h2 id="now-deciding-headline" className={styles.headline}>
            מכריעים <span className={styles.red}>עכשיו.</span>
          </h2>
        </header>

        <div className={styles.ruleHeavy} aria-hidden />

        {topics.length === 0 ? (
          <div className={styles.notice}>
            <span className={styles.noticeStamp}>המהדורה הראשונה בדפוס · 04.08</span>
            <p className={styles.noticeLede}>
              ההצבעות הראשונות יופיעו כאן ברגע שהקלפי נפתחת.
            </p>
            <NewsButton
              href={WHATSAPP_FOUNDERS_LINK}
              target="_blank"
              rel="noopener noreferrer"
              variant="red"
              size="md"
              trailing={<span aria-hidden>←</span>}
            >
              הצטרפו למייסדים
            </NewsButton>
          </div>
        ) : (
          <>
            <AnimateIn className={styles.split}>
              <ul className={styles.leadList}>
                {leads.map((entry) => (
                  <LeadRow key={entry.topic.id} entry={entry} locale={locale} />
                ))}
              </ul>

              {compacts.length > 0 ? (
                <ul className={styles.compactList}>
                  {compacts.map((entry, i) => (
                    <CompactRow
                      key={entry.topic.id}
                      entry={entry}
                      index={i}
                      locale={locale}
                    />
                  ))}
                </ul>
              ) : null}
            </AnimateIn>

            <div className={styles.footer}>
              <Link href={`/${locale}/votes`} className={styles.footerLink}>
                לכל ההצבעות ←
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
