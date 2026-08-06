import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import type { Locale } from '@/lib/i18n';
import { BagsList } from './BagsList';
import { formatIls } from './format';
import styles from './MoneyDesk.module.css';
import { localePrefix } from '@/lib/i18n';

interface MoneyDeskCopy {
  kicker: string;
  headline: string;
  headlineRed: string;
  ledgerLabel: string;
  ledgerLink: string;
  totalPending: string;
  bagsKicker: string;
  marketLink: string;
  economicsLink: string;
}

const COPY: Record<Locale, MoneyDeskCopy> = {
  he: {
    kicker: 'הקרן האזרחית · THE MONEY DESK',
    headline: 'הכסף,',
    headlineRed: 'גלוי.',
    ledgerLabel: 'סה״כ בקרן האזרחית',
    ledgerLink: 'לשקיפות מלאה ←',
    totalPending: 'בהכנה',
    bagsKicker: 'BAGS מובילים · TOP 5',
    marketLink: 'לשוק המלא ←',
    economicsLink: 'איך הכלכלה עובדת ←',
  },
  en: {
    kicker: 'The civic fund · THE MONEY DESK',
    headline: 'The money,',
    headlineRed: 'in the open.',
    ledgerLabel: 'Total in the civic fund',
    ledgerLink: 'Full transparency →',
    totalPending: 'pending',
    bagsKicker: 'Leading BAGS · TOP 5',
    marketLink: 'The full market →',
    economicsLink: 'How the economics work →',
  },
};

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
  const t = COPY[locale];
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
            {t.kicker}
          </span>
          <h2 id="money-desk-headline" className={styles.headline}>
            {t.headline} <span className={styles.red}>{t.headlineRed}</span>
          </h2>
        </header>

        <div className={styles.panelGrid}>
          <GlassCard variant="press" className={styles.panel}>
            <div className={styles.panelInner}>
              <Link href={`${localePrefix(locale)}/treasury`} className={styles.ledgerHead}>
                <span className={styles.ledgerLabel}>{t.ledgerLabel}</span>
                <span className={styles.ledgerLink}>{t.ledgerLink}</span>
              </Link>

              <p className={styles.total}>
                {totalRaisedIls === null ? (
                  <>
                    <span className={styles.totalDash}>-</span>
                    <span className={styles.totalPending}>{t.totalPending}</span>
                  </>
                ) : (
                  <span className={styles.totalNum}>{formatIls(totalRaisedIls)}</span>
                )}
              </p>

              <div className={styles.panelRule} aria-hidden />

              <p className={styles.bagsKicker}>{t.bagsKicker}</p>
              <BagsList locale={locale} />

              <div className={styles.panelRule} aria-hidden />

              <p className={styles.panelLinks}>
                <Link href={`${localePrefix(locale)}/coin`} className={styles.panelLink}>
                  {t.marketLink}
                </Link>
                <Link href={`${localePrefix(locale)}/economics`} className={styles.panelLink}>
                  {t.economicsLink}
                </Link>
              </p>
            </div>
          </GlassCard>
        </div>
      </div>
    </section>
  );
}
