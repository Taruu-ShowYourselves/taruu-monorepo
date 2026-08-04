import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import type { Locale } from '@/lib/i18n';
import { BagsList } from './BagsList';
import { formatIls } from './format';
import styles from './MoneyDesk.module.css';

interface MoneyDeskProps {
  locale: Locale;
  /** Total ILS in the civic fund; null = unavailable (prints `-`, never 0). */
  totalRaisedIls: number | null;
}

/**
 * S6 - הכסף, גלוי. The one glass section on the page: a frosted ledger panel
 * floating over an ink-halftone paper band. Glass = the live-money layer, by
 * definition (spec §5.1) - everything editorial around it stays ink on paper.
 * Only numbers, symbols, kickers and single-line labels sit on the glass.
 */
export function MoneyDesk({ locale, totalRaisedIls }: MoneyDeskProps) {
  return (
    <section
      id="money-desk"
      className={styles.desk}
      aria-labelledby="money-desk-headline"
    >
      {/* Halftone applied to the band behind the glass, never to the glass. */}
      <div className={styles.halftone} aria-hidden />

      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            הקרן האזרחית · THE MONEY DESK
          </span>
          <h2 id="money-desk-headline" className={styles.headline}>
            הכסף, <span className={styles.red}>גלוי.</span>
          </h2>
        </header>

        <div className={styles.panelGrid}>
          <GlassCard variant="press" className={styles.panel}>
            <div className={styles.panelInner}>
              <Link href={`/${locale}/treasury`} className={styles.ledgerHead}>
                <span className={styles.ledgerLabel}>סה״כ בקרן האזרחית</span>
                <span className={styles.ledgerLink}>לשקיפות מלאה ←</span>
              </Link>

              <p className={styles.total}>
                {totalRaisedIls === null ? (
                  <>
                    <span className={styles.totalDash}>-</span>
                    <span className={styles.totalPending}>בהכנה</span>
                  </>
                ) : (
                  <span className={styles.totalNum}>{formatIls(totalRaisedIls)}</span>
                )}
              </p>

              <div className={styles.panelRule} aria-hidden />

              <p className={styles.bagsKicker}>BAGS מובילים · TOP 5</p>
              <BagsList locale={locale} />

              <div className={styles.panelRule} aria-hidden />

              <p className={styles.panelLinks}>
                <Link href={`/${locale}/coin`} className={styles.panelLink}>
                  לשוק המלא ←
                </Link>
                <Link href={`/${locale}/economics`} className={styles.panelLink}>
                  איך הכלכלה עובדת ←
                </Link>
              </p>
            </div>
          </GlassCard>
        </div>
      </div>
    </section>
  );
}
