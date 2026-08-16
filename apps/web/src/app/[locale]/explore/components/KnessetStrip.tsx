import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import { SourceLine } from '@/components/press/sections/DeskTopicRow';
import type { NowTopic } from '../data';
import { ShareBar } from './ShareBar';
import styles from './KnessetStrip.module.css';
import { localePrefix } from '@/lib/i18n';

interface KnessetStripCopy {
  kicker: string;
  headline: string;
  headlineRed: string;
  emptyLede: string;
  emptyLink: string;
  noBallots: string;
  civicVotesWord: string;
  footerLink: string;
}

const COPY: Record<Locale, KnessetStripCopy> = {
  he: {
    kicker: 'המהדורה הארצית · THE NATIONAL DESK',
    headline: 'על סדר היום',
    headlineRed: 'בכנסת.',
    emptyLede: 'סדר היום הבא של המליאה בהכנה.',
    emptyLink: 'לדסק הארצי ←',
    noBallots: 'הקלפי האזרחית פתוחה. הקול הראשון שלכם.',
    civicVotesWord: 'קולות אזרחיים',
    footerLink: 'לדסק הארצי המלא ←',
  },
  en: {
    kicker: 'The National Edition · THE NATIONAL DESK',
    headline: 'On the agenda',
    headlineRed: 'in the Knesset.',
    emptyLede: 'The plenum’s next agenda is in preparation.',
    emptyLink: 'The national desk →',
    noBallots: 'The civic ballot box is open. The first vote is yours.',
    civicVotesWord: 'civic votes',
    footerLink: 'The full national desk →',
  },
};

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
  const t = COPY[locale];
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
            {t.kicker}
          </span>
          <h2 id="knesset-strip-headline" className={styles.headline}>
            {t.headline} <span className={styles.red}>{t.headlineRed}</span>
          </h2>
        </header>

        {topics.length === 0 ? (
          <p className={styles.emptyLine}>
            {t.emptyLede}{' '}
            <Link href={`${localePrefix(locale)}/knesset`} className={styles.footerLink}>
              {t.emptyLink}
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
                          href={`${localePrefix(locale)}/votes/${entry.topic.id}`}
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
                          {t.noBallots}
                        </p>
                      )}
                      <p className={styles.itemMeta}>
                        {ballots.toLocaleString('he-IL')} {t.civicVotesWord}
                      </p>
                      {entry.topic.source ? (
                        <SourceLine source={entry.topic.source} locale={locale} />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className={styles.footer}>
              <Link href={`${localePrefix(locale)}/knesset`} className={styles.footerLink}>
                {t.footerLink}
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
