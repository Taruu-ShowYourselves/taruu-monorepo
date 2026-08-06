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
      'נפתחים בכל הארץ, בבת אחת · 04.08.26',
      '1,247 קולות מאומתים נחתמו השבוע',
      'כל קול חתום בבלוקצ׳יין · בלתי ניתן לזיוף',
      '₪2 מכל הצבעה נצברים לקרן הקהילתית',
      'מודדים · מאמתים · מנגישים',
    ],
  },
  en: {
    ariaLabel: 'Updates',
    defaultItems: [
      'Opening across the country, all at once · 04.08.26',
      '1,247 verified votes signed this week',
      'Every vote signed on the blockchain · tamper-proof',
      '₪2 from every vote accrues to the community fund',
      'Measuring · verifying · making it accessible',
    ],
  },
};

/** Breaking-news ticker strip - ink bar, mono uppercase, marquee scroll. */
export function Ticker({ items, label = 'LIVE', locale = 'he' }: TickerProps) {
  const t = COPY[locale];
  const list = items ?? t.defaultItems;
  const row = [...list, ...list];
  return (
    <div className={styles.ticker} role="marquee" aria-label={t.ariaLabel}>
      <span className={styles.flag}>
        <span className={styles.dot} aria-hidden />
        {label}
      </span>
      <div className={styles.viewport}>
        <div className={styles.track}>
          {row.map((it, i) => (
            <span key={i} className={styles.item}>
              <span className={styles.sep} aria-hidden>■</span>
              {it}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
