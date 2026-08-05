import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import styles from './MechanismTiles.module.css';

interface Tile {
  href: string;
  no: string;
  title: string;
  note: string;
}

/**
 * S7 - איך זה עובד. Editorial boxed link tiles in a 2×2 zig-zag with one
 * wide tile (never a 3-equal-card row). Static, zero data cost; invert on
 * hover per press discipline. A quiet inline link leads to the archive.
 */
export function MechanismTiles({ locale }: { locale: Locale }) {
  const tiles: Tile[] = [
    {
      href: `/${locale}/how-it-works`,
      no: '01',
      title: 'איך זה עובד',
      note: 'מאימות ועד קלפי: כל המנגנון, צעד אחר צעד.',
    },
    {
      href: `/${locale}/pricing`,
      no: '02',
      title: 'תמחור',
      note: 'להצביע - חינם. לפתוח נושא - ₪50.',
    },
    {
      href: `/${locale}/faq`,
      no: '03',
      title: 'שאלות נפוצות',
      note: 'הספקות של כולם, עם תשובות ישרות.',
    },
    {
      href: `/${locale}/about`,
      no: '04',
      title: 'אודות',
      note: 'מי מאחורי המערכת, ולמה עכשיו.',
    },
  ];

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
            חדר המכונות · THE MECHANISM
          </span>
          <h2 id="mechanism-headline" className={styles.headline}>
            איך זה <span className={styles.red}>עובד.</span>
          </h2>
        </header>

        <div className={styles.grid}>
          {tiles.map((tile) => (
            <Link key={tile.href} href={tile.href} className={styles.tile}>
              <span className={styles.tileNo} aria-hidden>
                {tile.no}
              </span>
              <span className={styles.tileTitle}>{tile.title}</span>
              <span className={styles.tileNote}>{tile.note}</span>
              <span className={styles.tileArrow} aria-hidden>
                ←
              </span>
            </Link>
          ))}
        </div>

        <p className={styles.archiveLine}>
          מחפשים הצבעות שהסתיימו?{' '}
          <Link href={`/${locale}/votes/archive`} className={styles.archiveLink}>
            לארכיון התוצאות ←
          </Link>
        </p>
      </div>
    </section>
  );
}
