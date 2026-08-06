import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import styles from './MechanismTiles.module.css';
import { localePrefix } from '@/lib/i18n';

interface Tile {
  slug: string;
  no: string;
  title: string;
  note: string;
}

interface MechanismCopy {
  kicker: string;
  headlineLead: string;
  headlineAccent: string;
  tiles: Tile[];
  archiveLead: string;
  archiveLink: string;
  /** Direction-semantic arrow: Hebrew ←, English →. */
  arrow: string;
}

const COPY: Record<Locale, MechanismCopy> = {
  he: {
    kicker: 'חדר המכונות · THE MECHANISM',
    headlineLead: 'איך זה',
    headlineAccent: 'עובד.',
    tiles: [
      {
        slug: '/how-it-works',
        no: '01',
        title: 'איך זה עובד',
        note: 'מאימות ועד קלפי: כל המנגנון, צעד אחר צעד.',
      },
      {
        slug: '/pricing',
        no: '02',
        title: 'תמחור',
        note: 'להצביע - חינם. לפתוח נושא - ₪50.',
      },
      {
        slug: '/faq',
        no: '03',
        title: 'שאלות נפוצות',
        note: 'הספקות של כולם, עם תשובות ישרות.',
      },
      {
        slug: '/about',
        no: '04',
        title: 'אודות',
        note: 'מי מאחורי המערכת, ולמה עכשיו.',
      },
    ],
    archiveLead: 'מחפשים הצבעות שהסתיימו?',
    archiveLink: 'לארכיון התוצאות ←',
    arrow: '←',
  },
  en: {
    kicker: 'THE MECHANISM',
    headlineLead: 'How it',
    headlineAccent: 'works.',
    tiles: [
      {
        slug: '/how-it-works',
        no: '01',
        title: 'How it works',
        note: 'From verification to ballot: the whole mechanism, step by step.',
      },
      {
        slug: '/pricing',
        no: '02',
        title: 'Pricing',
        note: 'Voting is free. Opening a topic costs ₪50.',
      },
      {
        slug: '/faq',
        no: '03',
        title: 'FAQ',
        note: "Everyone's doubts, with straight answers.",
      },
      {
        slug: '/about',
        no: '04',
        title: 'About',
        note: 'Who is behind the system, and why now.',
      },
    ],
    archiveLead: 'Looking for votes that have closed?',
    archiveLink: 'To the results archive →',
    arrow: '→',
  },
};

/**
 * S7 - איך זה עובד. Editorial boxed link tiles in a 2×2 zig-zag with one
 * wide tile (never a 3-equal-card row). Static, zero data cost; invert on
 * hover per press discipline. A quiet inline link leads to the archive.
 */
export function MechanismTiles({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  const prefix = localePrefix(locale);

  return (
    <section
      id="mechanism"
      className={styles.desk}
      aria-labelledby="mechanism-headline"
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            {t.kicker}
          </span>
          <h2 id="mechanism-headline" className={styles.headline}>
            {t.headlineLead} <span className={styles.red}>{t.headlineAccent}</span>
          </h2>
        </header>

        <div className={styles.grid}>
          {t.tiles.map((tile) => (
            <Link
              key={tile.slug}
              href={`${prefix}${tile.slug}`}
              className={styles.tile}
            >
              <span className={styles.tileNo} aria-hidden>
                {tile.no}
              </span>
              <span className={styles.tileTitle}>{tile.title}</span>
              <span className={styles.tileNote}>{tile.note}</span>
              <span className={styles.tileArrow} aria-hidden>
                {t.arrow}
              </span>
            </Link>
          ))}
        </div>

        <p className={styles.archiveLine}>
          {t.archiveLead}{' '}
          <Link href={`${prefix}/votes/archive`} className={styles.archiveLink}>
            {t.archiveLink}
          </Link>
        </p>
      </div>
    </section>
  );
}
