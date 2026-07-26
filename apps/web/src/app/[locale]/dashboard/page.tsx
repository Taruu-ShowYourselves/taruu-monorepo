'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { NewsButton, Segmented, TallyBar } from '@/components/press';
import { useReducedMotion } from '@/hooks';
import { resolveLocationState } from '@/lib/locationStatus';
import { CertificateCard, type Certificate } from '@/components/certificate/CertificateCard';
import {
  getIdentityLevelLabel,
  getIdentityLevelDescription,
} from '@sync/shared';
import styles from './page.module.css';

interface DashboardStats {
  totalVotes: number;
  activeVotes: number;
  votesCreated: number;
}

interface RecentVote {
  id: string;
  title: string;
  status: 'active' | 'ended';
  votedAt: string;
  option: string;
}

interface RegistrationStats {
  registeredTotal: number;
  registeredInMunicipality: number | null;
  municipalityWithheld: boolean;
}

type DashboardTab =
  | 'history'
  | 'certificates'
  | 'fund'
  | 'news'
  | 'settings';

const TABS: { value: DashboardTab; label: string }[] = [
  { value: 'history', label: 'הצבעות' },
  { value: 'certificates', label: 'תעודות' },
  { value: 'fund', label: 'הקרן · בקרוב' },
  { value: 'news', label: 'חדשות' },
  { value: 'settings', label: 'הגדרות' },
];

/**
 * Placeholder for a statistic that does not exist yet.
 *
 * The community fund and the Issue Coin ("bags") valuation are not implemented
 * in the MVP. Keeping the card in the layout preserves the information
 * architecture, but it is deliberately UI-ONLY: it calls no endpoint and holds
 * no number. Showing ₪0 here would be indistinguishable from a real empty fund,
 * which is exactly the kind of fake figure this dashboard must never print.
 */
function ComingSoonStat({ label, note }: { label: string; note: string }) {
  return (
    <div className={`${styles.statCard} ${styles.statCardSoon}`}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statSoon}>
        <span aria-hidden className={styles.statSoonMark}>●</span>
        בקרוב
      </span>
      <span className={styles.statMeta}>{note}</span>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentVotes, setRecentVotes] = useState<RecentVote[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationStats | null>(null);
  const [activeInCity, setActiveInCity] = useState<{ id: string; title: string }[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [tab, setTab] = useState<DashboardTab>('history');

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
        setStats({ totalVotes: 0, activeVotes: 0, votesCreated: 0 });
        setRecentVotes([]);
      } finally {
        setDataLoading(false);
      }
    };

    // NOTE: the MVP is free, so this dashboard deliberately fetches no billing,
    // token or personal-contribution data. GET /api/user/treasury-contributions
    // is intentionally retained server-side (with its SQL-enforced ownership)
    // for when the fund opens — it is simply not called from here.

    // Community registration figures — public aggregate counts, no per-user
    // data. Left null on failure so the panel can say so instead of showing a
    // zero that reads as "nobody registered".
    const fetchRegistrations = async () => {
      const municipality = user?.municipality;
      const query = municipality
        ? `?municipality=${encodeURIComponent(municipality)}`
        : '';
      try {
        const res = await fetch(`/api/stats/registrations${query}`);
        if (!res.ok) return;
        const data = await res.json();
        const s = data.stats;
        if (!s || typeof s.registeredTotal !== 'number') return;
        setRegistrations({
          registeredTotal: s.registeredTotal,
          registeredInMunicipality:
            typeof s.registeredInMunicipality === 'number'
              ? s.registeredInMunicipality
              : null,
          municipalityWithheld: Boolean(s.municipalityWithheld),
        });
      } catch (error) {
        console.error('Error fetching registration stats:', error);
      }
    };

    // Civic certificates (NFTs) — auto-issued on resolution, view-only.
    const fetchCertificates = async () => {
      try {
        const res = await fetch('/api/user/nfts');
        if (!res.ok) return;
        const data = await res.json();
        setCertificates((data.nfts || []) as Certificate[]);
      } catch (error) {
        console.error('Error fetching certificates:', error);
      }
    };

    // Retention hook: open votes in the reader's own city, waiting for a ballot.
    const fetchActiveInCity = async () => {
      const municipality = user?.municipality;
      if (!municipality) return;
      try {
        const res = await fetch(
          `/api/votes?municipality=${encodeURIComponent(municipality)}&status=active`
        );
        if (!res.ok) return;
        const data = await res.json();
        const votes = ((data.votes || []) as { id: string; title: string }[]).map(
          (v) => ({ id: v.id, title: v.title })
        );
        setActiveInCity(votes);
      } catch (error) {
        console.error('Error fetching active city votes:', error);
      }
    };

    if (isAuthenticated) {
      fetchData();
      fetchCertificates();
      fetchActiveInCity();
      fetchRegistrations();
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
  const locationState = resolveLocationState(user?.municipality, isVerified);

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
              {/* Location. Never falls back to a default town — see
                  resolveLocationState. Each state carries its own way forward. */}
              {locationState === 'unset' ? (
                <button
                  type="button"
                  className={styles.metaCta}
                  onClick={() => router.push('/settings/municipality')}
                >
                  הגדר מיקום ←
                </button>
              ) : (
                <span>{user?.municipality}</span>
              )}
              <span className={styles.sep} aria-hidden>■</span>
              <span>מהדורה · {issueNo}</span>
              <span className={styles.sep} aria-hidden>■</span>
              <span>{today}</span>
              {/* Verification slot. Omitted while the town is unset, because
                  residency cannot be verified before a town is chosen — the
                  "הגדר מיקום" CTA above is the real next step, and a second
                  competing CTA would only split it. */}
              {locationState === 'verified' && (
                <>
                  <span className={styles.sep} aria-hidden>■</span>
                  <span className={styles.badgeOk}>✓ מאומת</span>
                </>
              )}
              {locationState === 'unverified' && (
                <>
                  <span className={styles.sep} aria-hidden>■</span>
                  <button
                    type="button"
                    className={styles.metaCta}
                    onClick={() => router.push('/verification')}
                  >
                    אמת את המיקום ←
                  </button>
                </>
              )}
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
            </div>
          </motion.section>

          {/* ===== Community statistics ===== */}
          <motion.section className={styles.statsBand} {...reveal(0.09)}>
            <span className={styles.boxKicker}>
              <span aria-hidden className={styles.kickerTick} />
              המספרים של הקהילה · COMMUNITY
            </span>

            <div className={styles.statsGrid}>
              {/* Registered residents — real figures, never fabricated. */}
              <div className={styles.statCard}>
                <span className={styles.statLabel}>נרשמו לפלטפורמה</span>
                {registrations ? (
                  <>
                    <span className={styles.statNum}>
                      {registrations.registeredTotal.toLocaleString('he-IL')}
                    </span>
                    <span className={styles.statMeta}>
                      {registrations.registeredInMunicipality !== null
                        ? `מתוכם ${registrations.registeredInMunicipality.toLocaleString('he-IL')} ב${user?.municipality || 'עיר שלכם'}`
                        : registrations.municipalityWithheld
                          ? 'הפילוח העירוני ייחשף כשיצטרפו עוד תושבים'
                          : 'סך כל הנרשמים'}
                    </span>
                  </>
                ) : (
                  <span className={styles.statMeta}>לא הצלחנו לטעון את הנתון כרגע.</span>
                )}
              </div>

              {/* Community fund + Issue Coins are not live in the MVP. Render an
                  honest placeholder rather than a zero or an invented figure —
                  no endpoint is called for these cards on purpose. */}
              <ComingSoonStat
                label="הקרן הקהילתית"
                note="תיפתח עם ההצבעה הראשונה."
              />
              <ComingSoonStat
                label="שווי התיקים"
                note="מדד ההשקעה הקהילתית יעלה בהמשך."
              />
            </div>
          </motion.section>

          {/* ===== Quick actions strip ===== */}
          {activeInCity.length > 0 && (
            <motion.section className={styles.cityCallout} {...reveal(0.1)}>
              <div className={styles.cityMain}>
                <span className={styles.cityKicker}>
                  <span aria-hidden className={styles.kickerTick} />
                  פעיל ב{user?.municipality || 'עיר שלך'} · {activeInCity.length}
                </span>
                <p className={styles.cityLine}>
                  {activeInCity.length === 1
                    ? 'הצבעה אחת פתוחה מחכה לקול שלכם.'
                    : `${activeInCity.length} הצבעות פתוחות מחכות לקול שלכם.`}
                </p>
                <ul className={styles.cityList}>
                  {activeInCity.slice(0, 3).map((v) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        className={styles.cityItem}
                        onClick={() => router.push(`/votes/${v.id}`)}
                      >
                        <span aria-hidden>▍</span> {v.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <NewsButton variant="red" size="md" onClick={() => router.push('/votes')}>
                לכל ההצבעות
              </NewsButton>
            </motion.section>
          )}

          <motion.section className={styles.actionsStrip} {...reveal(0.12)}>
            <NewsButton variant="ink" size="md" onClick={() => router.push('/votes')}>
              צפייה בהצבעות פעילות
            </NewsButton>
            <NewsButton
              variant="outline"
              size="md"
              onClick={() => router.push('/votes/create')}
            >
              יצירת הצבעה חדשה
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

            {/* --- CERTIFICATES --- */}
            {tab === 'certificates' && (
              <div className={styles.panel}>
                <span className={styles.panelKicker}>
                  <span aria-hidden className={styles.kickerTick} />
                  התעודות שלכם · CIVIC CERTIFICATES
                </span>
                {certificates.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p className={styles.emptyText}>
                      תעודה אזרחית מונפקת אוטומטית בכל פעם שהצבעה שהשתתפתם בה
                      מסתיימת — שיא חתום של ההשתתפות שלכם. עוד אין לכם תעודות.
                    </p>
                    <NewsButton variant="red" size="md" onClick={() => router.push('/votes')}>
                      להצבעות הפעילות
                    </NewsButton>
                  </div>
                ) : (
                  <div className={styles.certGrid}>
                    {certificates.map((cert) => (
                      <CertificateCard key={cert.id} cert={cert} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* --- COMMUNITY FUND --- */}
            {/* UI-only. The fund is not live in the MVP, so the reader's
                contribution ledger is deliberately NOT fetched or rendered
                here — no totals, no rows, no zero balance. */}
            {tab === 'fund' && (
              <div className={styles.panel}>
                <span className={styles.panelKicker}>
                  <span aria-hidden className={styles.kickerTick} />
                  הקרן הקהילתית · TREASURY
                </span>
                <div className={styles.newsSoon}>
                  <span aria-hidden className={styles.newsSoonMark}>●</span>
                  <h3 className={styles.newsSoonTitle}>בקרוב</h3>
                  <p className={styles.newsSoonText}>
                    הקרן הקהילתית תיפתח עם ההצבעה הראשונה. עד אז אין מה להציג כאן.
                  </p>
                </div>
              </div>
            )}

            {/* --- SETTINGS --- */}
            {/* --- NEWS --- */}
            {/* UI-only. There is deliberately no news backend, API, table or
                sample article behind this: an empty promise is honest, an
                invented headline is not. */}
            {tab === 'news' && (
              <div className={styles.panel}>
                <span className={styles.panelKicker}>
                  <span aria-hidden className={styles.kickerTick} />
                  חדשות ועדכונים · NEWS
                </span>
                <div className={styles.newsSoon}>
                  <span aria-hidden className={styles.newsSoonMark}>●</span>
                  <h3 className={styles.newsSoonTitle}>בקרוב</h3>
                  <p className={styles.newsSoonText}>
                    עדכונים מהקהילה ומהפעילות המקומית יופיעו כאן בהמשך.
                  </p>
                </div>
              </div>
            )}

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

        </div>
      </main>
      <Footer />
    </>
  );
}
