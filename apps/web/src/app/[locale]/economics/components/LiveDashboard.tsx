'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { MunicipalityLink } from '@/components/uikit/municipality-link';
import { useReducedMotion } from '@/hooks';
import type { Locale } from '@/lib/i18n';
import styles from './LiveDashboard.module.css';

const EASE = [0.2, 0, 0, 1] as const;

interface NetworkStats {
  totalRaised: number;
  activeVotes: number;
  totalVoters: number;
  municipalities: number;
  weeklyGrowth: number;
}

interface TrendingCoin {
  voteId: string;
  voteTitle: string;
  municipality: string;
  priceChange24h: number;
  volume24h: number;
  totalRaised: number;
  tokenMint?: string;
  imageUrl?: string | null;
}

interface DashboardCopy {
  kicker: string;
  headlineLead: string;
  headlineAccent: string;
  standfirst: string;
  loadError: string;
  preLaunchTitle: string;
  preLaunchBody: string;
  trendingTitle: string;
  statRaised: string;
  statActiveVotes: string;
  statVoters: string;
  statMunicipalities: string;
  /** BCP 47 tag for the currency and count formatting. */
  numberLocale: string;
}

const COPY: Record<Locale, DashboardCopy> = {
  he: {
    kicker: 'הדשבורד החי · LIVE',
    headlineLead: 'כל שקל בקרן',
    headlineAccent: 'גלוי בזמן אמת.',
    standfirst:
      'נתונים חיים מכל הרשויות המקומיות ברשת. שקיפות מלאה, בלי חדרים סגורים.',
    loadError: 'לא הצלחנו לטעון את הנתונים כרגע.',
    preLaunchTitle: 'הדשבורד החי ייפתח עם ההצבעה הראשונה.',
    preLaunchBody:
      'כשהקרן הקהילתית הראשונה תיפתח, כל גיוס, עסקה ומגמה יופיעו כאן בזמן אמת.',
    trendingTitle: 'BAGS מובילים ב-bags.fm',
    statRaised: 'סה״כ גויס לקרנות',
    statActiveVotes: 'הצבעות פעילות',
    statVoters: 'תושבים שהצביעו',
    statMunicipalities: 'רשויות מקומיות',
    numberLocale: 'he-IL',
  },
  en: {
    kicker: 'THE LIVE DASHBOARD · LIVE',
    headlineLead: 'Every shekel in the fund',
    headlineAccent: 'is visible in real time.',
    standfirst:
      'Live figures from every municipality on the network. Full transparency, no closed rooms.',
    loadError: 'We could not load the figures right now.',
    preLaunchTitle: 'The live dashboard opens with the first vote.',
    preLaunchBody:
      'When the first community fund opens, every raise, transaction and trend appears here in real time.',
    trendingTitle: 'Leading BAGS on bags.fm',
    statRaised: 'Total raised for funds',
    statActiveVotes: 'Active votes',
    statVoters: 'Residents who voted',
    statMunicipalities: 'Municipalities',
    numberLocale: 'en-GB',
  },
};

export function LiveDashboard({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  const reduced = useReducedMotion();
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [coins, setCoins] = useState<TrendingCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, coinsRes] = await Promise.all([
          fetch('/api/stats/network'),
          fetch('/api/bags/trending?limit=5'),
        ]);

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData.stats);
        }

        if (coinsRes.ok) {
          const coinsData = await coinsRes.json();
          setCoins(coinsData.coins || []);
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError(t.loadError);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [t.loadError]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(t.numberLocale, {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const formatNumber = (num: number) =>
    new Intl.NumberFormat(t.numberLocale).format(num);

  const formatPercent = (num: number) => {
    const sign = num >= 0 ? '+' : '';
    return `${sign}${(num * 100).toFixed(0)}%`;
  };

  // Pilot honesty: treat "no real activity yet" as a composed pre-launch state.
  const hasActivity = Boolean(stats && stats.totalVoters > 0) || coins.length > 0;

  const statCards = [
    { label: t.statRaised, value: stats ? formatCurrency(stats.totalRaised) : '₪0' },
    { label: t.statActiveVotes, value: stats ? formatNumber(stats.activeVotes) : '0' },
    { label: t.statVoters, value: stats ? formatNumber(stats.totalVoters) : '0' },
    {
      label: t.statMunicipalities,
      value: stats ? formatNumber(stats.municipalities) : '0',
    },
  ];

  return (
    <section className={styles.dashboard} aria-labelledby="dashboard-title">
      <div className={styles.inner}>
        <header className={styles.head}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerLive} />
            {t.kicker}
          </span>
          <h2 id="dashboard-title" className={styles.headline}>
            {t.headlineLead} <span className={styles.red}>{t.headlineAccent}</span>
          </h2>
          <p className={styles.standfirst}>{t.standfirst}</p>
        </header>

        {loading ? (
          <div className={styles.skeletonGrid} aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={styles.skeletonCard} />
            ))}
          </div>
        ) : error ? (
          <div className={styles.notice} role="status">
            <span className={styles.noticeGlyph} aria-hidden>✕</span>
            <p className={styles.noticeText}>{error}</p>
          </div>
        ) : !hasActivity ? (
          <div className={styles.notice} role="status">
            <span className={`${styles.noticeGlyph} ${styles.noticeGlyphLive}`} aria-hidden>●</span>
            <div className={styles.noticeBody}>
              <p className={styles.noticeTitle}>{t.preLaunchTitle}</p>
              <p className={styles.noticeText}>{t.preLaunchBody}</p>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.statsGrid}>
              {statCards.map((card, index) => (
                <motion.div
                  key={card.label}
                  className={styles.statCard}
                  initial={reduced ? false : { opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
                  whileInView={{ opacity: 1, clipPath: 'inset(0 0 0 0)' }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: reduced ? 0 : 0.32, ease: EASE, delay: reduced ? 0 : 0.06 * index }}
                >
                  <span className={styles.statValue}>{card.value}</span>
                  <span className={styles.statLabel}>{card.label}</span>
                </motion.div>
              ))}
            </div>

            {coins.length > 0 && (
              <div className={styles.trending}>
                <h3 className={styles.sectionTitle}>{t.trendingTitle}</h3>
                <div className={styles.coinsList}>
                  {coins.map((coin, index) => (
                    <motion.div
                      key={coin.voteId}
                      className={styles.coinRow}
                      initial={reduced ? false : { opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-30px' }}
                      transition={{ duration: reduced ? 0 : 0.28, ease: EASE, delay: reduced ? 0 : 0.06 * index }}
                    >
                      <span className={styles.coinNum} aria-hidden>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className={styles.coinIcon}>
                        {coin.imageUrl ? (
                          <Image
                            src={coin.imageUrl}
                            alt={coin.voteTitle}
                            width={40}
                            height={40}
                            unoptimized
                          />
                        ) : (
                          <span aria-hidden>□</span>
                        )}
                      </div>
                      <div className={styles.coinInfo}>
                        <span className={styles.coinTitle}>{coin.voteTitle}</span>
                        <MunicipalityLink
                          name={coin.municipality}
                          className={styles.coinMunicipality}
                          locale={locale}
                        />
                      </div>
                      <div className={styles.coinStats}>
                        <span
                          className={`${styles.coinChange} ${
                            coin.priceChange24h >= 0 ? styles.positive : styles.negative
                          }`}
                        >
                          {formatPercent(coin.priceChange24h)}
                        </span>
                        <span className={styles.coinRaised}>{formatCurrency(coin.totalRaised)}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
