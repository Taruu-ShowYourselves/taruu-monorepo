'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import styles from './LiveDashboard.module.css';

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

export function LiveDashboard() {
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
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('he-IL').format(num);
  };

  const formatPercent = (num: number) => {
    const sign = num >= 0 ? '+' : '';
    return `${sign}${(num * 100).toFixed(0)}%`;
  };

  return (
    <section className={styles.dashboard}>
      <div className={styles.container}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className={styles.titleRow}>
            <h2 className={styles.title}>רשת תַּרְאוּ - חי</h2>
            <div className={styles.liveIndicator}>
              <span className={styles.liveDot} />
              <span>Live</span>
            </div>
          </div>
          <p className={styles.subtitle}>נתונים בזמן אמת מכל הרשויות המקומיות</p>
        </motion.div>

        {loading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <span>טוען נתונים...</span>
          </div>
        ) : error ? (
          <div className={styles.error}>{error}</div>
        ) : (
          <>
            {/* Network Stats */}
            <motion.div
              className={styles.statsGrid}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className={styles.statCard}>
                <span className={styles.statValue}>
                  {stats ? formatCurrency(stats.totalRaised) : '₪0'}
                </span>
                <span className={styles.statLabel}>סה״כ גויס</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>
                  {stats ? formatNumber(stats.activeVotes) : '0'}
                </span>
                <span className={styles.statLabel}>הצבעות פעילות</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>
                  {stats ? formatNumber(stats.totalVoters) : '0'}
                </span>
                <span className={styles.statLabel}>מצביעים</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>
                  {stats ? formatNumber(stats.municipalities) : '0'}
                </span>
                <span className={styles.statLabel}>רשויות מקומיות</span>
              </div>
            </motion.div>

            {/* Trending Issue Coins */}
            {coins.length > 0 && (
              <motion.div
                className={styles.trendingSection}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <h3 className={styles.sectionTitle}>Issue Coins מובילים</h3>
                <div className={styles.coinsList}>
                  {coins.map((coin, index) => (
                    <motion.div
                      key={coin.voteId}
                      className={styles.coinCard}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: 0.1 * index }}
                    >
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
                          <span>🏛️</span>
                        )}
                      </div>
                      <div className={styles.coinInfo}>
                        <span className={styles.coinTitle}>{coin.voteTitle}</span>
                        <span className={styles.coinMunicipality}>
                          {coin.municipality}
                        </span>
                      </div>
                      <div className={styles.coinStats}>
                        <span
                          className={`${styles.coinChange} ${
                            coin.priceChange24h >= 0
                              ? styles.positive
                              : styles.negative
                          }`}
                        >
                          {formatPercent(coin.priceChange24h)}
                        </span>
                        <span className={styles.coinRaised}>
                          {formatCurrency(coin.totalRaised)}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
