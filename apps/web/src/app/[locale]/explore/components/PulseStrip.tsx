import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import { PulseCounter } from './PulseCounter';
import styles from './PulseStrip.module.css';

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
}

/**
 * One counter between ink column rules. Missing figures print `-` with a
 * mono `בהכנה` note - never a fake zero for money (spec §3.2).
 */
function CounterCell({ label, value, href, unit }: CounterCellProps) {
  const body = (
    <>
      <span className={styles.value}>
        {value === null ? (
          <span className={styles.dash} aria-label="בהכנה">
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
      {value === null ? <span className={styles.pending}>בהכנה</span> : null}
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
  const growthPct =
    weeklyGrowth !== null && weeklyGrowth !== 0
      ? Math.round(Math.abs(weeklyGrowth) * 100)
      : null;

  return (
    <section id="pulse" className={styles.strip} aria-label="הדופק - נתוני הרשת">
      <div className={styles.inner}>
        <div className={styles.grid}>
          <CounterCell label="אזרחים רשומים" value={registered} />
          <CounterCell
            label="הצבעות פעילות"
            value={activeVotes}
            href={`/${locale}/votes`}
          />
          <CounterCell label="רשויות על הלוח" value={municipalitiesLive} />
          <CounterCell
            label="בקרן האזרחית"
            value={totalRaisedIls === null ? null : Math.round(totalRaisedIls)}
            unit="₪"
            href={`/${locale}/treasury`}
          />
        </div>

        {growthPct !== null && weeklyGrowth !== null ? (
          <p className={styles.growth}>
            <span aria-hidden className={styles.growthArrow}>
              {weeklyGrowth > 0 ? '↑' : '↓'}
            </span>
            {growthPct}% מצביעים {weeklyGrowth > 0 ? 'יותר' : 'פחות'} מהשבוע שעבר
          </p>
        ) : null}
      </div>
    </section>
  );
}
