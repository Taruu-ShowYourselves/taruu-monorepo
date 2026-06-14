'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import {
  NewsButton,
  Segmented,
  TallyBar,
  Receipt,
  PressInput,
} from '@/components/press';
import { useReducedMotion } from '@/hooks';
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

interface TokenTransaction {
  id: string;
  amount: number;
  reason: 'vote_participation' | 'vote_creation';
  txHash: string;
  timestamp: string;
}

interface TreasuryContribution {
  id: string;
  amountILS: number;
  voteId?: string | null;
  date: string;
}

type DashboardTab = 'history' | 'fund' | 'billing' | 'settings';

const TABS: { value: DashboardTab; label: string }[] = [
  { value: 'history', label: 'הצבעות' },
  { value: 'fund', label: 'הקרן' },
  { value: 'billing', label: 'חיובים' },
  { value: 'settings', label: 'הגדרות' },
];

/** Hebrew-formatted ₪ figure with grouping, tabular-safe. */
const ils = (n: number) => `₪${n.toLocaleString('he-IL')}`;

export default function DashboardPage() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentVotes, setRecentVotes] = useState<RecentVote[]>([]);
  const [tokenTxns, setTokenTxns] = useState<TokenTransaction[]>([]);
  const [contributions, setContributions] = useState<TreasuryContribution[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [tab, setTab] = useState<DashboardTab>('history');

  // Refund request sub-surface (no backend yet — graceful mock, app MOCK pattern)
  const [refundReason, setRefundReason] = useState('');
  const [refundState, setRefundState] = useState<'idle' | 'sent'>('idle');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/sign-in?redirect=/dashboard');
      return;
    }

    // Fetch dashboard data from API
    const fetchData = async () => {
      try {
        // Fetch stats and participations in parallel
        const [statsResponse, participationsResponse] = await Promise.all([
          fetch('/api/user/stats'),
          fetch('/api/user/participations'),
        ]);

        // Parse stats
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats({
            totalVotes: statsData.votesParticipated || 0,
            activeVotes: 0, // Will be calculated from participations
            tokensEarned: user?.syncTokenBalance || 0,
            votesCreated: statsData.votesCreated || 0,
          });
        }

        // Parse participations for recent votes
        if (participationsResponse.ok) {
          const participationsData = await participationsResponse.json();
          const participations = participationsData.participations || [];

          // Count active votes
          const activeCount = participations.filter(
            (p: any) => p.vote?.status === 'active'
          ).length;

          // Update stats with active count
          setStats((prev) => prev ? { ...prev, activeVotes: activeCount } : null);

          // Transform to RecentVote format (take last 5)
          const recentVotesData: RecentVote[] = participations
            .slice(0, 5)
            .map((p: any) => ({
              id: p.voteId,
              title: p.vote?.title || 'הצבעה',
              status: (p.vote?.status === 'active' ? 'active' : 'ended') as 'active' | 'ended',
              votedAt: new Date(p.createdAt).toLocaleDateString('he-IL'),
              option: p.option?.text || 'בעד',
            }));

          setRecentVotes(recentVotesData);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        // Set empty data on error
        setStats({ totalVotes: 0, activeVotes: 0, tokensEarned: 0, votesCreated: 0 });
        setRecentVotes([]);
      } finally {
        setDataLoading(false);
      }
    };

    // Billing (token transactions) — real endpoint, empty fallback on error.
    const fetchBilling = async () => {
      try {
        const res = await fetch('/api/user/tokens/transactions');
        if (!res.ok) return;
        const data = await res.json();
        const txns: TokenTransaction[] = (data.transactions || []).map((t: any) => ({
          id: t.id,
          amount: t.amount || 0,
          reason: t.reason === 'vote_creation' ? 'vote_creation' : 'vote_participation',
          txHash: t.txHash || '',
          timestamp: new Date(t.timestamp).toLocaleDateString('he-IL'),
        }));
        setTokenTxns(txns);
      } catch (error) {
        console.error('Error fetching billing history:', error);
      }
    };

    // Treasury contributions for the user's municipality — real endpoint,
    // filtered to the reader's own deposits, empty fallback on error.
    const fetchContributions = async () => {
      const municipality = user?.municipality;
      if (!municipality) return;
      try {
        const res = await fetch(
          `/api/treasury/${encodeURIComponent(municipality)}/transactions?type=deposit&limit=50`
        );
        if (!res.ok) return;
        const data = await res.json();
        const mine: TreasuryContribution[] = (data.transactions || [])
          .filter((t: any) => !user?.id || !t.userId || t.userId === user.id)
          .map((t: any) => ({
            id: t.id,
            amountILS: typeof t.amountILS === 'number' ? t.amountILS : 0,
            voteId: t.voteId,
            date: t.createdAt
              ? new Date(t.createdAt).toLocaleDateString('he-IL')
              : '',
          }));
        setContributions(mine);
      } catch (error) {
        console.error('Error fetching treasury contributions:', error);
      }
    };

    if (isAuthenticated) {
      fetchData();
      fetchBilling();
      fetchContributions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally omit user to prevent refetch on every user update; we only want to fetch once when authenticated
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || dataLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} aria-hidden />
        <p className={styles.loadingText}>טוען את הגיליון…</p>
      </div>
    );
  }

  // Get identity level info
  const identityLevel = user?.identityScore?.level || 'basic';
  const identityTotal = user?.identityScore?.total || 0;
  const verificationPhase = user?.verificationStatus?.phase || 'not_started';
  const isVerified = verificationPhase === 'completed';
  const tokenBalance = user?.syncTokenBalance || stats?.tokensEarned || 0;
  const fundTotal = contributions.reduce((s, c) => s + (c.amountILS || 0), 0);

  const issueNo = (user?.id || 'GUEST').slice(0, 6).toUpperCase();
  const today = new Date().toLocaleDateString('he-IL');

  const reveal = (delay = 0) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.22, ease: [0.2, 0, 0, 1] as const, delay },
        };

  const submitRefund = (e: React.FormEvent) => {
    e.preventDefault();
    // No refund endpoint exists yet — record intent locally (MOCK no-op).
    setRefundState('sent');
  };

  return (
    <>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          {/* ===== Masthead: personal edition ===== */}
          <motion.header className={styles.masthead} {...reveal(0)}>
            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              הגיליון האישי שלכם · YOUR LEDGER
            </span>
            <h1 className={styles.title}>
              שלום, <span className={styles.red}>{user?.firstName || 'משתמש'}</span>.
            </h1>
            <div className={styles.editionMeta}>
              <span>{user?.municipality || 'קריית טבעון'}</span>
              <span className={styles.sep} aria-hidden>■</span>
              <span>מהדורה · {issueNo}</span>
              <span className={styles.sep} aria-hidden>■</span>
              <span>{today}</span>
              <span className={styles.sep} aria-hidden>■</span>
              <span className={isVerified ? styles.badgeOk : styles.badgeWait}>
                {isVerified ? '✓ מאומת' : '○ לא מאומת'}
              </span>
            </div>
          </motion.header>

          {/* ===== Verification dispatch (only when incomplete) ===== */}
          {!isVerified && (
            <motion.section className={styles.verifyBox} {...reveal(0.04)}>
              <div className={styles.verifyText}>
                <span className={styles.boxKicker}>
                  <span aria-hidden className={styles.kickerTick} />
                  אימות תושבות · נדרש כדי להצביע
                </span>
                <p className={styles.verifyBody}>
                  {verificationPhase === 'not_started'
                    ? 'התחילו את תהליך אימות התושבות כדי שהקול שלכם ייספר.'
                    : verificationPhase === 'in_progress'
                      ? `בתהליך — ${user?.verificationStatus?.checkInsCompleted || 0}/${user?.verificationStatus?.checkInsTotal || 0} צ׳ק-אינים הושלמו.`
                      : 'האימות נכשל. אפשר לנסות שוב.'}
                </p>
              </div>
              <NewsButton
                variant="red"
                size="md"
                onClick={() => router.push('/verification')}
                trailing={<span aria-hidden>←</span>}
              >
                {verificationPhase === 'not_started' ? 'התחילו אימות' : 'צפו בסטטוס'}
              </NewsButton>
            </motion.section>
          )}

          {/* ===== Ledger band: identity + key figures ===== */}
          <motion.section className={styles.ledgerBand} {...reveal(0.08)}>
            {/* Identity ledger */}
            <div className={styles.identityBox}>
              <div className={styles.boxHead}>
                <span className={styles.boxKicker}>
                  <span aria-hidden className={styles.kickerTick} />
                  ציון זהות
                </span>
                <span className={`${styles.levelBadge} ${styles[identityLevel] || ''}`}>
                  {getIdentityLevelLabel(identityLevel)}
                </span>
              </div>
              <div className={styles.identityFigureRow}>
                <span className={styles.identityFigure}>{identityTotal}</span>
                <span className={styles.identityFigureMax}>/ 100</span>
              </div>
              <div className={styles.identityTally}>
                <TallyBar pct={Math.min(100, Math.max(0, identityTotal))} />
              </div>
              <p className={styles.boxBody}>{getIdentityLevelDescription(identityLevel)}</p>
              {identityTotal < 100 && (
                <button
                  type="button"
                  className={styles.inlineLink}
                  onClick={() => router.push('/settings/social-connections')}
                >
                  הוסיפו חשבונות לשיפור הציון ←
                </button>
              )}
            </div>

            {/* Figures grid */}
            <div className={styles.figuresGrid}>
              <div className={styles.figureCell}>
                <span className={styles.figureNum}>{stats?.totalVotes || 0}</span>
                <span className={styles.figureLabel}>סה״כ הצבעות</span>
              </div>
              <div className={styles.figureCell}>
                <span className={styles.figureNum}>{stats?.activeVotes || 0}</span>
                <span className={styles.figureLabel}>פעילות</span>
              </div>
              <div className={styles.figureCell}>
                <span className={styles.figureNum}>{stats?.votesCreated || 0}</span>
                <span className={styles.figureLabel}>שיצרתם</span>
              </div>
              <div className={`${styles.figureCell} ${styles.figureCellInk}`}>
                <span className={styles.figureNumRed}>{tokenBalance}</span>
                <span className={styles.figureLabelInverse}>טוקני SYNC</span>
              </div>
            </div>
          </motion.section>

          {/* ===== Quick actions strip ===== */}
          <motion.section className={styles.actionsStrip} {...reveal(0.12)}>
            <NewsButton variant="ink" size="md" onClick={() => router.push('/votes')}>
              צפייה בהצבעות פעילות
            </NewsButton>
            <NewsButton
              variant="outline"
              size="md"
              onClick={() => router.push('/votes/create')}
            >
              יצירת הצבעה חדשה · ₪200
            </NewsButton>
          </motion.section>

          {/* ===== Tabbed ledger sections ===== */}
          <motion.section className={styles.tabbed} {...reveal(0.16)}>
            <Segmented<DashboardTab>
              segments={TABS}
              value={tab}
              onChange={setTab}
              variant="ink"
              aria-label="מדורי הגיליון"
            />

            {/* --- HISTORY --- */}
            {tab === 'history' && (
              <div className={styles.panel}>
                <span className={styles.panelKicker}>
                  <span aria-hidden className={styles.kickerTick} />
                  ההצבעות האחרונות שלכם · SETTLED RECORD
                </span>
                {recentVotes.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p className={styles.emptyText}>
                      עוד לא הצבעתם. הנושא הראשון שלכם מחכה — בואו נתחיל.
                    </p>
                    <NewsButton variant="red" size="md" onClick={() => router.push('/votes')}>
                      התחילו להצביע
                    </NewsButton>
                  </div>
                ) : (
                  <ul className={styles.recordList}>
                    {recentVotes.map((vote) => (
                      <li
                        key={vote.id}
                        className={styles.record}
                        onClick={() => router.push(`/votes/${vote.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            router.push(`/votes/${vote.id}`);
                          }
                        }}
                      >
                        <div className={styles.recordMain}>
                          <h3 className={styles.recordTitle}>{vote.title}</h3>
                          <div className={styles.recordMeta}>
                            <span className={styles.recordChoice}>
                              ▍ הצבעתם: {vote.option}
                            </span>
                            <span className={styles.recordDate}>{vote.votedAt}</span>
                          </div>
                        </div>
                        <span
                          className={`${styles.recordStatus} ${styles[vote.status]}`}
                        >
                          {vote.status === 'active' ? '● פעיל' : '□ הסתיים'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* --- COMMUNITY FUND --- */}
            {tab === 'fund' && (
              <div className={styles.panel}>
                <span className={styles.panelKicker}>
                  <span aria-hidden className={styles.kickerTick} />
                  הקרן הקהילתית · TREASURY CONTRIBUTIONS
                </span>
                <div className={styles.fundTotalBox}>
                  <span className={styles.fundTotalK}>סך תרומתכם לקרן</span>
                  <span className={styles.fundTotalNum}>{ils(fundTotal)}</span>
                  <span className={styles.fundTotalMeta}>
                    כל ₪2 מדמי השתתפות מנותב לקרן הקהילתית
                  </span>
                </div>
                {contributions.length === 0 ? (
                  <p className={styles.emptyText}>
                    הקרן הקהילתית תתחיל להיבנות עם ההצבעה הראשונה. כל שקל יופיע כאן.
                  </p>
                ) : (
                  <ul className={styles.ledgerRows}>
                    {contributions.map((c) => (
                      <li key={c.id} className={styles.ledgerRow}>
                        <span className={styles.ledgerRowLabel}>
                          ▍ ניתוב לקרן{c.voteId ? ` · הצבעה ${c.voteId.slice(0, 6)}` : ''}
                        </span>
                        <span className={styles.ledgerLeader} aria-hidden />
                        <span className={styles.ledgerRowDate}>{c.date}</span>
                        <span className={styles.ledgerRowValue}>{ils(c.amountILS)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* --- BILLING --- */}
            {tab === 'billing' && (
              <div className={styles.panel}>
                <span className={styles.panelKicker}>
                  <span aria-hidden className={styles.kickerTick} />
                  היסטוריית חיובים · BILLING
                </span>
                {tokenTxns.length === 0 ? (
                  <p className={styles.emptyText}>
                    אין עדיין חיובים. החיוב הראשון יופיע כאן אחרי ההצבעה הראשונה.
                  </p>
                ) : (
                  <div className={styles.receiptStack}>
                    {tokenTxns.map((t) => {
                      const isCreate = t.reason === 'vote_creation';
                      const charge = isCreate ? 200 : 3;
                      return (
                        <Receipt
                          key={t.id}
                          kicker={`קבלה · ${t.timestamp}`}
                          rows={[
                            {
                              label: isCreate ? 'יצירת הצבעה' : 'השתתפות בהצבעה',
                              value: ils(charge),
                            },
                            { label: 'טוקני SYNC שהוטבעו', value: `${t.amount}` },
                            {
                              label: 'סטטוס',
                              value: '✓ שולם',
                            },
                            { label: 'סה״כ חויב', value: ils(charge), strong: true },
                          ]}
                          footer={
                            t.txHash
                              ? `חתום בבלוקצ׳יין · ${t.txHash.slice(0, 18)}…`
                              : 'חתום בבלוקצ׳יין'
                          }
                        />
                      );
                    })}
                  </div>
                )}

                {/* Refund request — MOCK (no backend endpoint yet) */}
                <div className={styles.refundBox}>
                  <span className={styles.boxKicker}>
                    <span aria-hidden className={styles.kickerTick} />
                    בקשת החזר · REFUND REQUEST
                  </span>
                  {refundState === 'sent' ? (
                    <p className={styles.refundOk}>
                      <span aria-hidden>✓ </span>
                      בקשת ההחזר נרשמה. נחזור אליכם במייל תוך 5 ימי עסקים.
                    </p>
                  ) : (
                    <form className={styles.refundForm} onSubmit={submitRefund}>
                      <PressInput
                        multiline
                        rows={3}
                        label="סיבת ההחזר"
                        placeholder="ספרו לנו מה קרה — נטפל בזה."
                        value={refundReason}
                        onChange={(e) => setRefundReason(e.target.value)}
                      />
                      <NewsButton
                        type="submit"
                        variant="ink"
                        size="md"
                        disabled={refundReason.trim().length === 0}
                      >
                        בקשת החזר
                      </NewsButton>
                    </form>
                  )}
                </div>
              </div>
            )}

            {/* --- SETTINGS --- */}
            {tab === 'settings' && (
              <div className={styles.panel}>
                <span className={styles.panelKicker}>
                  <span aria-hidden className={styles.kickerTick} />
                  הגדרות · SETTINGS
                </span>
                <ul className={styles.settingsList}>
                  {[
                    { label: 'פרופיל אישי', meta: 'שם, טלפון, תמונה', href: '/settings/profile' },
                    { label: 'רשות מקומית', meta: user?.municipality || '—', href: '/settings/municipality' },
                    { label: 'התראות', meta: 'דוא״ל, פוש, עדכוני הצבעות', href: '/settings/notifications' },
                    { label: 'חשבונות מקושרים', meta: 'שיפור ציון הזהות', href: '/settings/social-connections' },
                  ].map((s) => (
                    <li
                      key={s.href}
                      className={styles.settingsRow}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(s.href)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          router.push(s.href);
                        }
                      }}
                    >
                      <div className={styles.settingsText}>
                        <span className={styles.settingsLabel}>{s.label}</span>
                        <span className={styles.settingsMeta}>{s.meta}</span>
                      </div>
                      <span className={styles.settingsArrow} aria-hidden>←</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.section>

          {/* ===== Token ledger footer ===== */}
          <motion.section className={styles.tokenLedger} {...reveal(0.2)}>
            <div className={styles.tokenLeft}>
              <span className={styles.boxKickerInverse}>
                <span aria-hidden className={styles.kickerTickPaper} />
                יתרת טוקני SYNC
              </span>
              <span className={styles.tokenFigure}>{tokenBalance}</span>
              <p className={styles.tokenNote}>
                כל הצבעה מזכה בטוקנים לפי ההשקעה. ₪3 = 3 SYNC. טוקנים משמשים לפעולות
                בפלטפורמה.
              </p>
            </div>
            <div className={styles.tokenRight}>
              <NewsButton variant="red" size="md" onClick={() => setTab('billing')}>
                היסטוריית טוקנים
              </NewsButton>
            </div>
          </motion.section>
        </div>
      </main>
      <Footer />
    </>
  );
}
