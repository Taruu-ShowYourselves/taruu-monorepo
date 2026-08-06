import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import { PulseCounter } from './PulseCounter';
import styles from './PulseStrip.module.css';
import { localePrefix } from '@/lib/i18n';

interface PulseStripCopy {
  sectionAriaLabel: string;
  pending: string;
  registeredLabel: string;
  activeVotesLabel: string;
  municipalitiesLabel: string;
  fundLabel: string;
  growthMore: string;
  growthLess: string;
}

const COPY: Record<Locale, PulseStripCopy> = {
  he: {
    sectionAriaLabel: 'הדופק - נתוני הרשת',
    pending: 'בהכנה',
    registeredLabel: 'אזרחים רשומים',
    activeVotesLabel: 'הצבעות פעילות',
    municipalitiesLabel: 'רשויות על הלוח',
    fundLabel: 'בקרן האזרחית',
    growthMore: '% מצביעים יותר מהשבוע שעבר',
    growthLess: '% מצביעים פחות מהשבוע שעבר',
  },
  en: {
    sectionAriaLabel: 'The pulse - network figures',
    pending: 'pending',
    registeredLabel: 'Registered citizens',
    activeVotesLabel: 'Active votes',
    municipalitiesLabel: 'Municipalities on the board',
    fundLabel: 'In the civic fund',
    growthMore: '% more voters than last week',
    growthLess: '% fewer voters than last week',
  },
};

interface PulseStripProps {
  locale: Locale;
  /** National registration count; null = figure unavailable. */
  registered: number | null;
  activeVotes: number;
  municipalitiesLive: number;
  /** Total ILS in the civic fund; null = figure unavailable (never fake 0). */
  totalRaisedIls: number | null;
  /** Week-over-week growth (-1..n); null/0 hides the arrow. */
  weeklyGrowth: number | null;
}

interface CounterCellProps {
  label: string;
  value: number | null;
  href?: string;
  /** Rendered before the number (e.g. the ₪ glyph). */
  unit?: string;
  locale?: Locale;
}

/**
 * One counter between ink column rules. Missing figures print `-` with a
 * mono `בהכנה` note - never a fake zero for money (spec §3.2).
 */
function CounterCell({ label, value, href, unit, locale = 'he' }: CounterCellProps) {
  const t = COPY[locale];
  const body = (
    <>
      <span className={styles.value}>
        {value === null ? (
          <span className={styles.dash} aria-label={t.pending}>
            -
          </span>
        ) : (
          <>
            {unit ? <span className={styles.unit}>{unit}</span> : null}
            <PulseCounter value={value} className={styles.num} />
          </>
        )}
      </span>
      <span className={styles.label}>{label}</span>
      {value === null ? <span className={styles.pending}>{t.pending}</span> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`${styles.cell} ${styles.cellLink}`}>
        {body}
      </Link>
    );
  }
  return <div className={styles.cell}>{body}</div>;
}

/**
 * S2 - הדופק. Four mono counters, no boxes: data breathes between ink column
 * rules (density-6 discipline). Proof-of-life before any pitch.
 */
export function PulseStrip({
  locale,
  registered,
  activeVotes,
  municipalitiesLive,
  totalRaisedIls,
  weeklyGrowth,
}: PulseStripProps) {
  const t = COPY[locale];
  const growthPct =
    weeklyGrowth !== null && weeklyGrowth !== 0
      ? Math.round(Math.abs(weeklyGrowth) * 100)
      : null;

  return (
    <section id="pulse" className={styles.strip} aria-label={t.sectionAriaLabel}>
      <div className={styles.inner}>
        <div className={styles.grid}>
          <CounterCell label={t.registeredLabel} value={registered} locale={locale} />
          <CounterCell
            label={t.activeVotesLabel}
            value={activeVotes}
            href={`${localePrefix(locale)}/votes`}
            locale={locale}
          />
          <CounterCell label={t.municipalitiesLabel} value={municipalitiesLive} locale={locale} />
          <CounterCell
            label={t.fundLabel}
            value={totalRaisedIls === null ? null : Math.round(totalRaisedIls)}
            unit="₪"
            href={`${localePrefix(locale)}/treasury`}
            locale={locale}
          />
        </div>

        {growthPct !== null && weeklyGrowth !== null ? (
          <p className={styles.growth}>
            <span aria-hidden className={styles.growthArrow}>
              {weeklyGrowth > 0 ? '↑' : '↓'}
            </span>
            {growthPct}{weeklyGrowth > 0 ? t.growthMore : t.growthLess}
          </p>
        ) : null}
      </div>
    </section>
  );
}
