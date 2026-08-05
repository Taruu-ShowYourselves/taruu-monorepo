'use client';

import { useEffect, useState } from 'react';
import type { Locale } from '@/lib/i18n';
import { BagsRow, type TrendingBag } from './BagsRow';
import styles from './MoneyDesk.module.css';

type BagsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; bags: TrendingBag[] };

interface BagsListProps {
  locale: Locale;
}

/**
 * The one client fetch on /explore: top-5 trending BAGS - genuinely
 * market-live data. Failure degrades to an inline error line inside the
 * glass panel; the rest of the page is untouched (CoinMarket pattern).
 */
export function BagsList({ locale }: BagsListProps) {
  const [state, setState] = useState<BagsState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/bags/trending?limit=5');
        if (!res.ok) throw new Error('bad status');
        const data = (await res.json()) as { coins?: TrendingBag[] };
        if (!cancelled) {
          setState({
            status: 'ready',
            bags: Array.isArray(data.coins) ? data.coins : [],
          });
        }
      } catch {
        if (!cancelled) setState({ status: 'error' });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <ul className={styles.bagList} aria-busy="true" aria-label="טוען את שוק ה-BAGS">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className={styles.bagItem}>
            <div className={styles.bagSkelRow}>
              <span className={`${styles.skel} ${styles.skelRank}`} />
              <span className={`${styles.skel} ${styles.skelSym}`} />
              <span className={`${styles.skel} ${styles.skelTitle}`} />
              <span className={`${styles.skel} ${styles.skelNum}`} />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (state.status === 'error') {
    return (
      <p className={styles.bagNotice} role="status">
        <span aria-hidden className={styles.bagNoticeGlyph}>
          ✕
        </span>
        לא הצלחנו לטעון את שוק ה-BAGS כרגע.
      </p>
    );
  }

  if (state.bags.length === 0) {
    return (
      <p className={styles.bagNotice} role="status">
        <span aria-hidden className={styles.bagNoticeGlyph}>
          ▍
        </span>
        עוד לא נפתחו BAGS. הראשון ייפתח עם ההצבעה הראשונה, ב-04.08.
      </p>
    );
  }

  const topRaised = state.bags.reduce(
    (max, bag) => Math.max(max, bag.totalRaised || 0),
    0
  );

  return (
    <ul className={styles.bagList} aria-label="חמשת ה-BAGS המובילים">
      {state.bags.map((bag, i) => (
        <BagsRow
          key={bag.voteId}
          bag={bag}
          rank={i + 1}
          pctOfTop={topRaised > 0 ? (bag.totalRaised / topRaised) * 100 : 0}
          locale={locale}
        />
      ))}
    </ul>
  );
}
