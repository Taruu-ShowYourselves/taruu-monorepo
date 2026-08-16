'use client';

import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import { ShareBar } from './ShareBar';
import { formatIls } from './format';
import styles from './MoneyDesk.module.css';
import { localePrefix } from '@/lib/i18n';

export interface TrendingBag {
  voteId: string;
  voteTitle: string;
  municipality: string;
  totalRaised: number;
  tokenMint?: string;
}

/** Ticker symbol for display (the trending API carries no symbol field). */
function symbolOf(bag: TrendingBag): string {
  const seed = bag.tokenMint || bag.voteId;
  return seed.slice(0, 4).toUpperCase();
}

interface BagsRowProps {
  bag: TrendingBag;
  rank: number;
  /** Share of the top bag's raise, 0–100 - drives the share bar. */
  pctOfTop: number;
  locale: Locale;
}

/**
 * One trending-BAG ledger line: rank · symbol · issue · ₪ raised · share bar.
 * `priceChange24h`/`volume24h` are placeholder zeros in the API - deliberately
 * not printed (pilot-honesty rule; spec §1 note on #6).
 */
export function BagsRow({ bag, rank, pctOfTop, locale }: BagsRowProps) {
  return (
    <li className={styles.bagItem}>
      <Link href={`${localePrefix(locale)}/coin/${bag.voteId}`} className={styles.bagLink}>
        <span className={styles.bagRank} aria-hidden>
          {String(rank).padStart(2, '0')}
        </span>
        <span className={styles.bagSymbol}>{symbolOf(bag)}</span>
        <span className={styles.bagTitle}>{bag.voteTitle}</span>
        <span className={styles.bagRaised}>{formatIls(bag.totalRaised)}</span>
        <ShareBar pct={Math.max(2, pctOfTop)} className={styles.bagBar} />
      </Link>
    </li>
  );
}
