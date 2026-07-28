'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { NewsButton } from '@/components/press/NewsButton';
import { TallyBar } from './TallyBar';
import styles from './VoteWidget.module.css';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';

interface Option {
  id: string;
  label: string;
  pct: number;
  count: number;
}

interface VoteWidgetProps {
  kicker?: string;
  /** Plain string or a node (e.g. MunicipalityLink) shown in the header. */
  place?: ReactNode;
  question?: string;
  options?: Option[];
  totalLabel?: string;
  /** WhatsApp / participate destination */
  href?: string;
  /**
   * Editorial issue number shown after the place (· גיליון NN). Optional —
   * omitted for real votes that have none; front-page/demo placements pass one
   * explicitly to keep the broadsheet flavor.
   */
  issueNo?: string;
}

const DEFAULT_OPTIONS: Option[] = [
  { id: 'for', label: 'בעד — להוסיף מעבר חצייה מואר', pct: 72, count: 1247 },
  { id: 'against', label: 'נגד — להשאיר כמו שהוא', pct: 19, count: 329 },
  { id: 'abstain', label: 'נמנע', pct: 9, count: 156 },
];

/**
 * The participation control surface — a live ballot rendered as press
 * furniture. Interactive selection + animated tallies; this is the styling/
 * surface, not the full multi-step flow.
 */
export function VoteWidget({
  kicker = 'הצבעה חיה',
  place = 'ישראל',
  question = 'גינת השכונה ברחוב הרצל — מה עושים?',
  options = DEFAULT_OPTIONS,
  totalLabel = '1,732 קולות מאומתים',
  href = WHATSAPP_FOUNDERS_LINK,
  issueNo,
}: VoteWidgetProps) {
  const [selected, setSelected] = useState<string | null>(null);

  // Real micro-interaction: tapping an option casts a sample ballot — the
  // tally recomputes with your +1 so the bars actually move. Honest framing:
  // it's a demo; to make the vote count you join the founders' group.
  const view = useMemo(() => {
    if (!selected) return options;
    const bumped = options.map((o) => ({
      ...o,
      count: o.id === selected ? o.count + 1 : o.count,
    }));
    const total = bumped.reduce((sum, o) => sum + o.count, 0) || 1;
    return bumped.map((o) => ({ ...o, pct: Math.round((o.count / total) * 100) }));
  }, [selected, options]);

  return (
    <section className={styles.widget} aria-label="הצבעה חיה">
      <header className={styles.head}>
        <span className={styles.kicker}>
          <span className={styles.live} aria-hidden />
          {kicker}
        </span>
        <span className={styles.place}>
          {place}
          {issueNo ? ` · גיליון ${issueNo}` : ''}
        </span>
      </header>

      <h3 className={styles.question}>{question}</h3>

      <ul className={styles.options}>
        {view.map((o) => {
          const isSel = selected === o.id;
          return (
            <li key={o.id}>
              <button
                type="button"
                className={`${styles.option} ${isSel ? styles.optionSel : ''}`}
                onClick={() => setSelected(o.id)}
                aria-pressed={isSel}
              >
                <span className={styles.optionTop}>
                  <span className={styles.mark} aria-hidden>{isSel ? '■' : '□'}</span>
                  <span className={styles.optionLabel}>{o.label}</span>
                  {isSel ? <span className={styles.you}>+ הקול שלך</span> : null}
                  <span className={styles.pct}>{o.pct}%</span>
                </span>
                <TallyBar pct={o.pct} selected={isSel} />
                <span className={styles.count}>{o.count.toLocaleString('he-IL')} קולות</span>
              </button>
            </li>
          );
        })}
      </ul>

      {selected ? (
        <p className={styles.prompt} role="status">
          <span aria-hidden>✓ </span>
          זו הצבעת הדגמה. כדי שהקול יספור באמת — הצטרפו לקבוצת המייסדים.
        </p>
      ) : null}

      <div className={styles.actions}>
        <NewsButton
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          variant="red"
          size="lg"
          trailing={<span aria-hidden>←</span>}
        >
          {selected ? 'שיספור באמת · קבוצת המייסדים' : 'הצביעו · VOTE'}
        </NewsButton>
        <span className={styles.total}>{totalLabel}</span>
      </div>

      <footer className={styles.meta}>
        <span>מאומת · זהות + GPS</span>
        <span className={styles.sep} aria-hidden>■</span>
        <span>חתום בבלוקצ׳יין</span>
        <span className={styles.sep} aria-hidden>■</span>
        <span>בלתי ניתן לזיוף</span>
      </footer>
    </section>
  );
}
