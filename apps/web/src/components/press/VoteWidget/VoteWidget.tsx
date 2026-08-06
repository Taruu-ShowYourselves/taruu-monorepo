'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import { NewsButton } from '@/components/press/NewsButton';
import { TallyBar } from './TallyBar';
import styles from './VoteWidget.module.css';

interface VoteWidgetCopy {
  kicker: string;
  ariaLabel: string;
  issueOf: (issueNo: string) => string;
  muniMore: string;
  yourVote: string;
  countOf: (count: number) => string;
  previewNote: string;
  ctaContinue: string;
  ctaVote: string;
  arrow: string;
  metaVerified: string;
  metaSigned: string;
  metaForgeryProof: string;
}

const COPY: Record<Locale, VoteWidgetCopy> = {
  he: {
    kicker: 'הצבעה חיה',
    ariaLabel: 'הצבעה חיה',
    issueOf: (issueNo) => `גיליון ${issueNo}`,
    muniMore: 'לכל ההצבעות ←',
    yourVote: '+ הקול שלך',
    countOf: (count) => `${count.toLocaleString('he-IL')} קולות`,
    previewNote: 'הבחירה כאן היא תצוגה. הקול נחתם בעמוד ההצבעה עצמו.',
    ctaContinue: 'המשיכו להצבעה',
    ctaVote: 'הצביעו · VOTE',
    arrow: '←',
    metaVerified: 'מאומת · זהות + GPS',
    metaSigned: 'חתום בבלוקצ׳יין',
    metaForgeryProof: 'בלתי ניתן לזיוף',
  },
  en: {
    kicker: 'Live vote',
    ariaLabel: 'Live vote',
    issueOf: (issueNo) => `Issue ${issueNo}`,
    muniMore: 'All votes →',
    yourVote: '+ your vote',
    countOf: (count) => `${count.toLocaleString('en-US')} votes`,
    previewNote: 'The choice here is a preview. The ballot is signed on the vote page itself.',
    ctaContinue: 'Continue to the vote',
    ctaVote: 'VOTE',
    arrow: '→',
    metaVerified: 'Verified · identity + GPS',
    metaSigned: 'Signed on the blockchain',
    metaForgeryProof: 'Tamper-proof',
  },
};

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
  locale?: Locale;
}

/**
 * The participation control surface - a live ballot rendered as press
 * furniture. Interactive selection + animated tallies; this is the styling/
 * surface, not the full multi-step flow.
 */
export function VoteWidget({
  kicker,
  place,
  municipality,
  municipalityHref,
  question,
  options,
  totalLabel,
  href,
  issueNo,
  onSelectOption,
  locale = 'he',
}: VoteWidgetProps) {
  const t = COPY[locale];
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
    <section className={styles.widget} aria-label={t.ariaLabel}>
      <header className={styles.head}>
        <span className={styles.kicker}>
          <span className={styles.live} aria-hidden />
          {kicker ?? t.kicker}
        </span>
        <span className={styles.place}>
          {place}
          {place && issueNo ? ' · ' : ''}
          {issueNo ? t.issueOf(issueNo) : ''}
        </span>
      </header>

      {municipality ? (
        municipalityHref ? (
          <Link href={municipalityHref} className={styles.muniCard}>
            <span className={styles.muniName}>{municipality}</span>
            <span className={styles.muniMore}>{t.muniMore}</span>
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
                  {isSel ? <span className={styles.you}>{t.yourVote}</span> : null}
                  <span className={styles.pct}>{o.pct}%</span>
                </span>
                <TallyBar pct={o.pct} selected={isSel} />
                <span className={styles.count}>{t.countOf(o.count)}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {selected ? (
        <p className={styles.prompt} role="status">
          <span aria-hidden>✓ </span>
          {t.previewNote}
        </p>
      ) : null}

      <div className={styles.actions}>
        <NewsButton
          href={href}
          variant="red"
          size="lg"
          trailing={<span aria-hidden>{t.arrow}</span>}
        >
          {selected ? t.ctaContinue : t.ctaVote}
        </NewsButton>
        <span className={styles.total}>{totalLabel}</span>
      </div>

      <footer className={styles.meta}>
        <span>{t.metaVerified}</span>
        <span className={styles.sep} aria-hidden>■</span>
        <span>{t.metaSigned}</span>
        <span className={styles.sep} aria-hidden>■</span>
        <span>{t.metaForgeryProof}</span>
      </footer>
    </section>
  );
}
