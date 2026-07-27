'use client';

import styles from './Ticker.module.css';

interface TickerProps {
  items?: string[];
  label?: string;
}

const DEFAULT_ITEMS = [
  'הפיילוט נפתח בקריית טבעון · 23.01.26',
  '1,247 קולות מאומתים נחתמו השבוע',
  'כל קול חתום בבלוקצ׳יין — בלתי ניתן לזיוף',
  'ההשתתפות חופשית — כל קול נחתם ונספר',
  'מודדים · מאמתים · מנגישים',
];

/** Breaking-news ticker strip — ink bar, mono uppercase, marquee scroll. */
export function Ticker({ items = DEFAULT_ITEMS, label = 'LIVE' }: TickerProps) {
  const row = [...items, ...items];
  return (
    <div className={styles.ticker} role="marquee" aria-label="עדכונים">
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
