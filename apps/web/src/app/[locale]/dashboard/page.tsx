'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import {
  getIdentityLevelLabel,
  getIdentityLevelDescription,
} from '@sync/shared';
import styles from './page.module.css';

interface DashboardStats {
  totalVotes: number;
  activeVotes: number;
  tokensEarned: number;
  votesCreated: number;
}

interface RecentVote {
  id: string;
  title: string;
  status: 'active' | 'ended';
  votedAt: string;
  option: string;
}

// Mock data - will be replaced with API
const mockStats: DashboardStats = {
  totalVotes: 12,
  activeVotes: 3,
  tokensEarned: 62,
  votesCreated: 1,
};

const mockRecentVotes: RecentVote[] = [
  {
    id: '1',
    title: 'הקמת גן שעשועים חדש ברובע הצפוני',
    status: 'active',
    votedAt: '2024-12-18',
    option: 'בעד',
  },
  {
    id: '2',
    title: 'שיפוץ מתחם הספורט העירוני',
    status: 'ended',
    votedAt: '2024-12-15',
    option: 'בעד עם שינויים',
  },
  {
    id: '3',
    title: 'הוספת קווי אוטובוס בשעות הערב',
    status: 'ended',
    votedAt: '2024-12-10',
    option: 'בעד',
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentVotes, setRecentVotes] = useState<RecentVote[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/sign-in?redirect=/dashboard');
      return;
    }

    // Fetch dashboard data
    const fetchData = async () => {
      // TODO: Replace with actual API calls
      await new Promise((resolve) => setTimeout(resolve, 500));
      setStats(mockStats);
      setRecentVotes(mockRecentVotes);
      setDataLoading(false);
    };

    if (isAuthenticated) {
      fetchData();
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || dataLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>טוען...</p>
      </div>
    );
  }

  // Get identity level info
  const identityLevel = user?.identityScore?.level || 'basic';
  const identityTotal = user?.identityScore?.total || 0;
  const verificationPhase = user?.verificationStatus?.phase || 'not_started';

  return (
    <>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          {/* Welcome Section */}
          <motion.div
            className={styles.welcome}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1>שלום, {user?.firstName || 'משתמש'}!</h1>
            <p>ברוכים הבאים לוח הבקרה שלכם</p>
          </motion.div>

          {/* Verification Status Banner */}
          {verificationPhase !== 'completed' && (
            <motion.div
              className={styles.verificationBanner}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
            >
              <div className={styles.bannerContent}>
                <span className={styles.bannerIcon}>📍</span>
                <div className={styles.bannerText}>
                  <strong>אימות מיקום</strong>
                  <p>
                    {verificationPhase === 'not_started'
                      ? 'התחילו את תהליך אימות התושבות כדי להצביע'
                      : verificationPhase === 'in_progress'
                        ? `בתהליך - ${user?.verificationStatus?.checkInsCompleted || 0}/${user?.verificationStatus?.checkInsTotal || 0} צ׳ק-אינים`
                        : 'האימות נכשל - נסו שוב'}
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => router.push('/verification')}
              >
                {verificationPhase === 'not_started' ? 'התחל אימות' : 'צפה בסטטוס'}
              </Button>
            </motion.div>
          )}

          {/* Identity Score Card */}
          <motion.div
            className={styles.identityCard}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className={styles.identityHeader}>
              <h2>ציון זהות</h2>
              <span className={`${styles.identityBadge} ${styles[identityLevel]}`}>
                {getIdentityLevelLabel(identityLevel)}
              </span>
            </div>
            <div className={styles.identityProgress}>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${identityTotal}%` }}
                />
              </div>
              <span className={styles.progressText}>{identityTotal}/100</span>
            </div>
            <p className={styles.identityDescription}>
              {getIdentityLevelDescription(identityLevel)}
            </p>
            {identityTotal < 100 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/settings/social-connections')}
              >
                הוסף חשבונות לשיפור הציון
              </Button>
            )}
          </motion.div>

          {/* Stats Grid */}
          <motion.div
            className={styles.statsGrid}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <div className={styles.statCard}>
              <div className={styles.statIcon}>🗳️</div>
              <div className={styles.statValue}>{stats?.totalVotes || 0}</div>
              <div className={styles.statLabel}>סה״כ הצבעות</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>⚡</div>
              <div className={styles.statValue}>{stats?.activeVotes || 0}</div>
              <div className={styles.statLabel}>הצבעות פעילות</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>🪙</div>
              <div className={styles.statValue}>{user?.syncTokenBalance || stats?.tokensEarned || 0}</div>
              <div className={styles.statLabel}>טוקנים SYNC</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>✨</div>
              <div className={styles.statValue}>{stats?.votesCreated || 0}</div>
              <div className={styles.statLabel}>הצבעות שיצרתם</div>
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            className={styles.quickActions}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h2>פעולות מהירות</h2>
            <div className={styles.actionButtons}>
              <Button onClick={() => router.push('/votes')}>
                צפייה בהצבעות פעילות
              </Button>
              <Button variant="secondary" onClick={() => router.push('/votes/create')}>
                יצירת הצבעה חדשה (₪200)
              </Button>
            </div>
          </motion.div>

          {/* Recent Votes */}
          <motion.div
            className={styles.recentVotes}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <h2>ההצבעות האחרונות שלכם</h2>
            {recentVotes.length === 0 ? (
              <div className={styles.emptyState}>
                <p>עדיין לא הצבעתם</p>
                <Button onClick={() => router.push('/votes')}>
                  התחילו להצביע
                </Button>
              </div>
            ) : (
              <div className={styles.votesList}>
                {recentVotes.map((vote, index) => (
                  <motion.div
                    key={vote.id}
                    className={styles.voteItem}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.4 + index * 0.1 }}
                    onClick={() => router.push(`/votes/${vote.id}`)}
                  >
                    <div className={styles.voteInfo}>
                      <h3>{vote.title}</h3>
                      <div className={styles.voteMeta}>
                        <span className={styles.voteOption}>הצבעתם: {vote.option}</span>
                        <span className={styles.voteDate}>{vote.votedAt}</span>
                      </div>
                    </div>
                    <div className={`${styles.voteStatus} ${styles[vote.status]}`}>
                      {vote.status === 'active' ? 'פעיל' : 'הסתיים'}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Token Balance Card */}
          <motion.div
            className={styles.tokenCard}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <div className={styles.tokenInfo}>
              <h2>יתרת טוקנים SYNC</h2>
              <div className={styles.tokenBalance}>{user?.syncTokenBalance || 0}</div>
              <p>כל הצבעה מזכה בטוקנים לפי ההשקעה. ₪3 = 3 SYNC. טוקנים משמשים לפעולות בפלטפורמה.</p>
            </div>
            <div className={styles.tokenActions}>
              <Button variant="secondary" size="sm">
                היסטוריית טוקנים
              </Button>
            </div>
          </motion.div>
        </div>
      </main>
      <Footer />
    </>
  );
}
