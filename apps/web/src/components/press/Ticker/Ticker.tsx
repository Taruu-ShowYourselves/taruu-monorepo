'use client';

import type { Locale } from '@/lib/i18n';
import styles from './Ticker.module.css';

interface TickerProps {
  items?: string[];
  label?: string;
  locale?: Locale;
}

interface TickerCopy {
  ariaLabel: string;
  defaultItems: string[];
}

const COPY: Record<Locale, TickerCopy> = {
  he: {
    ariaLabel: 'עדכונים',
    defaultItems: [
      'ההצבעה פתוחה · כל קול נספר',
      'תוצאות נספרות בזמן אמת · גלוי לכולם',
      'כל קול חתום בבלוקצ׳יין · בלתי ניתן לזיוף',
      '₪2 מכל הצבעה נצברים לקרן הקהילתית',
      'מודדים · מאמתים · מנגישים',
    ],
  },
  en: {
    ariaLabel: 'Updates',
    defaultItems: [
      'Voting is open · every vote counts',
      'Results tallied in real time · visible to all',
      'Every vote signed on the blockchain · tamper-proof',
      '₪2 from every vote accrues to the community fund',
      'Measuring · verifying · making it accessible',
    ],
  },
};

/* The marquee wraps by shifting the track 50%, so the two halves must be
   pixel-identical (keep this even) and each half wider than any viewport -
   otherwise the wrap exposes a hole at the anchored edge. 4 runs per half
   covers ultrawide screens. */
const RUN_COUNT = 8;

/** Breaking-news ticker strip - ink bar, mono uppercase, marquee scroll. */
export function Ticker({ items, label = 'LIVE', locale = 'he' }: TickerProps) {
  const t = COPY[locale];
  const list = items ?? t.defaultItems;
  const row = Array.from({ length: RUN_COUNT }, () => list).flat();
  return (
    <div className={styles.ticker} role="marquee" aria-label={t.ariaLabel}>
      <span className={styles.flag}>
        <span className={styles.dot} aria-hidden />
        {label}
      </span>
      <div className={styles.viewport}>
        <div className={styles.track}>
          {row.map((it, i) => (
            // Repeats beyond the first run only fill the marquee - a screen
            // reader should hear each line once.
            <span key={i} className={styles.item} aria-hidden={i >= list.length || undefined}>
              <span className={styles.sep} aria-hidden>■</span>
              {it}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
