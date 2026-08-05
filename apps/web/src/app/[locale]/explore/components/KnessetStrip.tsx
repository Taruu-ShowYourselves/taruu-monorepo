import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import { SourceLine } from '@/components/press/sections/DeskTopicRow';
import type { NowTopic } from '../data';
import { ShareBar } from './ShareBar';
import styles from './KnessetStrip.module.css';

interface KnessetStripProps {
  locale: Locale;
  /** Top Knesset agenda topics (max 3). */
  topics: NowTopic[];
}

/**
 * S5 - על סדר היום בכנסת. Compact national strip on the deeper paper band:
 * top three agenda items with their civic tallies. Kept thin - /knesset owns
 * the depth.
 */
export function KnessetStrip({ locale, topics }: KnessetStripProps) {
  return (
    <section
      id="knesset-strip"
      className={styles.strip}
      aria-labelledby="knesset-strip-headline"
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            המהדורה הארצית · THE NATIONAL DESK
          </span>
          <h2 id="knesset-strip-headline" className={styles.headline}>
            על סדר היום <span className={styles.red}>בכנסת.</span>
          </h2>
        </header>

        {topics.length === 0 ? (
          <p className={styles.emptyLine}>
            סדר היום הבא של המליאה בהכנה.{' '}
            <Link href={`/${locale}/knesset`} className={styles.footerLink}>
              לדסק הארצי ←
            </Link>
          </p>
        ) : (
          <>
            <ol className={styles.list}>
              {topics.map((entry, i) => {
                const lead = entry.topic.options[0];
                const ballots = entry.topic.options.reduce(
                  (sum, o) => sum + o.votes,
                  0
                );
                return (
                  <li key={entry.topic.id} className={styles.item}>
                    <span className={styles.itemNo} aria-hidden>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className={styles.itemBody}>
                      <h3 className={styles.itemTitle}>
                        <Link
                          href={`/${locale}/votes/${entry.topic.id}`}
                          className={styles.itemLink}
                        >
                          {entry.topic.title}
                        </Link>
                      </h3>
                      {ballots > 0 && lead ? (
                        <div className={styles.itemTally}>
                          <span className={styles.itemLead}>{lead.text}</span>
                          <ShareBar pct={lead.pct} className={styles.itemBar} />
                          <span className={styles.itemPct}>{lead.pct}%</span>
                        </div>
                      ) : (
                        <p className={styles.itemNoBallots}>
                          הקלפי האזרחית פתוחה. הקול הראשון שלכם.
                        </p>
                      )}
                      <p className={styles.itemMeta}>
                        {ballots.toLocaleString('he-IL')} קולות אזרחיים
                      </p>
                      {entry.topic.source ? (
                        <SourceLine source={entry.topic.source} />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className={styles.footer}>
              <Link href={`/${locale}/knesset`} className={styles.footerLink}>
                לדסק הארצי המלא ←
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
