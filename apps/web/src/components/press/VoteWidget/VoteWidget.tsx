'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { NewsButton } from '@/components/press/NewsButton';
import { TallyBar } from './TallyBar';
import styles from './VoteWidget.module.css';

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
  /** Arena the vote belongs to - rendered as a card between header and question. */
  municipality?: string;
  /** Where the municipality card leads (profile page). Card is static without it. */
  municipalityHref?: string;
  question: string;
  options: Option[];
  totalLabel: string;
  /** Vote-page destination for the CTA. */
  href: string;
  /**
   * Editorial issue number shown after the place (· גיליון NN). Optional -
   * omitted for votes that have none; front-page placements pass one
   * explicitly to keep the broadsheet flavor.
   */
  issueNo?: string;
  /** Fired when an option is tapped - lets live wrappers pause rotation. */
  onSelectOption?: (id: string) => void;
}

/**
 * The participation control surface - a live ballot rendered as press
 * furniture. Interactive selection + animated tallies; this is the styling/
 * surface, not the full multi-step flow.
 */
export function VoteWidget({
  kicker = 'הצבעה חיה',
  place,
  municipality,
  municipalityHref,
  question,
  options,
  totalLabel,
  href,
  issueNo,
  onSelectOption,
}: VoteWidgetProps) {
  const [selected, setSelected] = useState<string | null>(null);

  // Preview micro-interaction: tapping an option recomputes the tally with
  // your +1 so the bars move. Honest framing: the ballot itself is signed on
  // the vote page.
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
          {place && issueNo ? ' · ' : ''}
          {issueNo ? `גיליון ${issueNo}` : ''}
        </span>
      </header>

      {municipality ? (
        municipalityHref ? (
          <Link href={municipalityHref} className={styles.muniCard}>
            <span className={styles.muniName}>{municipality}</span>
            <span className={styles.muniMore}>לכל ההצבעות ←</span>
          </Link>
        ) : (
          <span className={styles.muniCard}>
            <span className={styles.muniName}>{municipality}</span>
          </span>
        )
      ) : null}

      <h3 className={styles.question}>{question}</h3>

      <ul className={styles.options}>
        {view.map((o) => {
          const isSel = selected === o.id;
          return (
            <li key={o.id}>
              <button
                type="button"
                className={`${styles.option} ${isSel ? styles.optionSel : ''}`}
                onClick={() => {
                  setSelected(o.id);
                  onSelectOption?.(o.id);
                }}
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
          הבחירה כאן היא תצוגה. הקול נחתם בעמוד ההצבעה עצמו.
        </p>
      ) : null}

      <div className={styles.actions}>
        <NewsButton
          href={href}
          variant="red"
          size="lg"
          trailing={<span aria-hidden>←</span>}
        >
          {selected ? 'המשיכו להצבעה' : 'הצביעו · VOTE'}
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
