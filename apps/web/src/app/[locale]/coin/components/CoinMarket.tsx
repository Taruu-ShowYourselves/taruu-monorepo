'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { NewsButton, Segmented } from '@/components/press';
import { useReducedMotion } from '@/hooks';
import type { Locale } from '@/lib/i18n';
import { WHATSAPP_LINK, formatCurrency, formatNumber, formatPercent } from './format';
import styles from '../page.module.css';

const EASE = [0.2, 0, 0, 1] as const;

interface TrendingCoin {
  voteId: string;
  voteTitle: string;
  municipality: string;
  priceChange24h: number;
  volume24h: number;
  totalRaised: number;
  tokenMint?: string;
  imageUrl?: string | null;
  createdAt?: string;
}

interface CoinMarketProps {
  locale?: Locale;
}

type MunicipalityFilter = string;

/** Build a token symbol/name pair for display (API trending has no symbol field). */
function deriveSymbol(coin: TrendingCoin): string {
  if (coin.tokenMint) return `${coin.tokenMint.slice(0, 4).toUpperCase()}`;
  return coin.voteId.slice(0, 4).toUpperCase();
}

export function CoinMarket({ locale = 'he' }: CoinMarketProps) {
  const reduced = useReducedMotion();
  const [coins, setCoins] = useState<TrendingCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [muni, setMuni] = useState<MunicipalityFilter>('all');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/bags/trending?limit=50');
        if (!res.ok) throw new Error('bad status');
        const data = await res.json();
        if (!cancelled) setCoins(Array.isArray(data.coins) ? data.coins : []);
      } catch {
        if (!cancelled) setError('לא הצלחנו לטעון את שוק ה-BAGS כרגע.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const municipalities = useMemo(() => {
    const set = new Set<string>();
    coins.forEach((c) => c.municipality && set.add(c.municipality));
    return Array.from(set);
  }, [coins]);

  const filtered = useMemo(
    () => (muni === 'all' ? coins : coins.filter((c) => c.municipality === muni)),
    [coins, muni]
  );

  const topRaised = useMemo(
    () => filtered.reduce((max, c) => Math.max(max, c.totalRaised || 0), 0),
    [filtered]
  );

  const segments = useMemo(
    () => [
      { value: 'all', label: 'הכול' },
      ...municipalities.map((m) => ({ value: m, label: m })),
    ],
    [municipalities]
  );

  return (
    <section className={styles.page}>
      {/* Masthead-style header */}
      <header className={styles.head}>
        <span className={styles.kicker}>
          <span aria-hidden className={styles.kickerTick} />
          מטבע ההצבעה · BAGS.FM
        </span>
        <h1 className={styles.headline}>
          להשקיע בהחלטה של <span className={styles.red}>הרוב.</span>
        </h1>
        <p className={styles.standfirst}>
          כל הצבעה מקבלת BAG משלה ב-bags.fm — מטבע ממים מבוסס בלוקצ׳יין, ממותג סביב
          הפלטפורמה, שמאפשר לאנשים מבחוץ להשקיע בתנועה הכלכלית של ההצבעה, בדיוק כמו במניה,
          ולתמוך בביצוע החלטת הרוב. ככל שה-BAG גדל, לנושא יש יותר משאבים אמיתיים מאחוריו.
          כל מספר מאומת, שקוף וחתום בבלוקצ׳יין.
        </p>
      </header>

      {/* Municipality filter */}
      {!loading && !error && municipalities.length > 0 ? (
        <div className={styles.filterBar}>
          <span className={styles.filterLabel}>סינון לפי רשות</span>
          <Segmented
            segments={segments}
            value={muni}
            onChange={setMuni}
            variant="red"
            aria-label="סינון לפי רשות"
            className={styles.segmented}
          />
        </div>
      ) : null}

      {/* States */}
      {loading ? <MarketSkeleton /> : null}
      {!loading && error ? <ErrorState message={error} /> : null}
      {!loading && !error && filtered.length === 0 ? <EmptyState /> : null}

      {/* Market table */}
      {!loading && !error && filtered.length > 0 ? (
        <div className={styles.market} role="table" aria-label="שוק ה-BAGS">
          {/* Header row (desktop only) */}
          <div className={styles.colHead} role="row" aria-hidden>
            <span className={styles.chToken}>BAG / הצבעה</span>
            <span className={styles.chMuni}>רשות</span>
            <span className={styles.chRaised}>גויס · ₪</span>
            <span className={styles.chChange}>24ש׳</span>
            <span className={styles.chVol}>מחזור 24ש׳</span>
          </div>

          <ul className={styles.rows}>
            {filtered.map((coin, i) => {
              const pctOfTop = topRaised > 0 ? (coin.totalRaised / topRaised) * 100 : 0;
              const up = coin.priceChange24h >= 0;
              return (
                <li key={coin.voteId} role="row">
                  <Link className={styles.row} href={`/${locale}/coin/${coin.voteId}`}>
                    {/* Token + issue */}
                    <span className={styles.cToken}>
                      <span className={styles.rank}>{String(i + 1).padStart(2, '0')}</span>
                      <span className={styles.tokenBlock}>
                        <span className={styles.symbol}>{deriveSymbol(coin)}</span>
                        <span className={styles.issue}>{coin.voteTitle}</span>
                      </span>
                    </span>

                    {/* Municipality */}
                    <span className={styles.cMuni}>
                      <span className={styles.muniMobileLabel}>רשות</span>
                      {coin.municipality || '—'}
                    </span>

                    {/* Raised + tally bar */}
                    <span className={styles.cRaised}>
                      <span className={styles.raisedNum}>{formatCurrency(coin.totalRaised)}</span>
                      <span className={styles.tallyTrack} aria-hidden>
                        <motion.span
                          className={styles.tallyFill}
                          initial={reduced ? false : { width: 0 }}
                          whileInView={{ width: `${Math.max(2, pctOfTop)}%` }}
                          viewport={{ once: true, margin: '-40px' }}
                          transition={{ duration: reduced ? 0 : 0.7, ease: EASE }}
                        />
                      </span>
                    </span>

                    {/* 24h change */}
                    <span className={styles.cChange}>
                      <span className={styles.changeMobileLabel}>24ש׳</span>
                      <span className={up ? styles.up : styles.down}>
                        {up ? '↗' : '↘'} {formatPercent(coin.priceChange24h)}
                      </span>
                    </span>

                    {/* Volume */}
                    <span className={styles.cVol}>
                      <span className={styles.volMobileLabel}>מחזור 24ש׳</span>
                      {formatCurrency(coin.volume24h)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

/* ---------- States ---------- */

function MarketSkeleton() {
  return (
    <div className={styles.market} aria-busy="true" aria-label="טוען">
      <ul className={styles.rows}>
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i}>
            <div className={`${styles.row} ${styles.skelRow}`}>
              <span className={styles.cToken}>
                <span className={`${styles.skel} ${styles.skelRank}`} />
                <span className={styles.tokenBlock}>
                  <span className={`${styles.skel} ${styles.skelSym}`} />
                  <span className={`${styles.skel} ${styles.skelLine}`} />
                </span>
              </span>
              <span className={`${styles.skel} ${styles.skelSm}`} />
              <span className={`${styles.skel} ${styles.skelMd}`} />
              <span className={`${styles.skel} ${styles.skelSm}`} />
              <span className={`${styles.skel} ${styles.skelSm}`} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className={styles.notice}>
      <span className={styles.noticeGlyph} aria-hidden>
        ✕
      </span>
      <p className={styles.noticeText}>{message}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyGlyph} aria-hidden>
        ▍
      </span>
      <h2 className={styles.emptyTitle}>עוד לא נפתחו BAGS.</h2>
      <p className={styles.emptyText}>
        ה-BAG הראשון ייפתח ב-bags.fm עם ההצבעה הראשונה — הצטרפו לקבוצת המייסדים ותהיו
        שם כשזה קורה.
      </p>
      <NewsButton
        href={WHATSAPP_LINK}
        target="_blank"
        rel="noopener noreferrer"
        variant="red"
        size="lg"
        trailing={<span aria-hidden>←</span>}
      >
        קבוצת המייסדים
      </NewsButton>
    </div>
  );
}
