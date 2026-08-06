'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { NewsButton, Segmented, TallyBar } from '@/components/press';
import { useReducedMotion, useVotingGate } from '@/hooks';
import { resolveLocationState } from '@/lib/locationStatus';
import { MunicipalityLink } from '@/components/uikit/municipality-link';
import { CertificateCard, type Certificate } from '@/components/certificate/CertificateCard';
import {
  getIdentityLevelLabel,
  getIdentityLevelDescription,
  GPS_SCORE_WEIGHT,
  IDENTITY_SCORE_WEIGHTS,
} from '@sync/shared';
import { voterGate } from '@/lib/verification';
import { PressLoader } from '@/components/press/PressMachine';
import type { Locale } from '@/lib/i18n';
import { localePrefix } from '@/lib/i18n';
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

interface DashboardCopy {
  tabs: { value: DashboardTab; label: string }[];
  loading: string;
  voteTitleFallback: string;
  voteOptionFallback: string;
  mastheadKicker: string;
  helloPrefix: string;
  nameFallback: string;
  /** Includes its trailing glyph - direction-semantic, mirrored between RTL and LTR. */
  setLocation: string;
  editionPrefix: string;
  verifiedBadge: string;
  /** Includes its trailing glyph - direction-semantic, mirrored between RTL and LTR. */
  verifyLocation: string;
  verifyKicker: string;
  verifyNotStarted: string;
  /** In-progress line composes `${verifyInProgressPrefix}${done}/${total}${verifyInProgressSuffix}`. */
  verifyInProgressPrefix: string;
  verifyInProgressSuffix: string;
  verifyFailed: string;
  verifyStartCta: string;
  verifyStatusCta: string;
  identityKicker: string;
  /** Includes its trailing glyph - direction-semantic, mirrored between RTL and LTR. */
  improveScore: string;
  /** The scored steps to a ballot, printed in running order like desk tiles. */
  stepsKicker: string;
  stepGoogle: string;
  stepGoogleMeta: string;
  stepResidency: string;
  stepResidencyMeta: string;
  stepSocial: string;
  stepSocialMeta: string;
  stepPointsSuffix: string;
  stepDone: string;
  stepOpen: string;
  /** Gate line composes `${gateHavePrefix}${total}${gateNeedMid}${required}${gateNeedSuffix}`. */
  gateHavePrefix: string;
  gateNeedMid: string;
  gateNeedSuffix: string;
  gateClearedLine: string;
  gateCta: string;
  totalVotesLabel: string;
  activeVotesLabel: string;
  createdVotesLabel: string;
  communityKicker: string;
  registeredLabel: string;
  /** City breakdown composes `${registeredInCityPrefix}${n}${registeredInCityMid}${city}`. */
  registeredInCityPrefix: string;
  registeredInCityMid: string;
  cityFallbackYours: string;
  municipalityWithheld: string;
  registeredTotalMeta: string;
  statLoadError: string;
  fundStatLabel: string;
  fundStatNote: string;
  bagsStatLabel: string;
  bagsStatNote: string;
  activeInCityPrefix: string;
  cityFallbackYour: string;
  cityLineSingle: string;
  /** Plural line composes `${n}${cityLinePluralSuffix}`. */
  cityLinePluralSuffix: string;
  allVotesCta: string;
  viewActiveVotes: string;
  createVote: string;
  sectionsAria: string;
  historyKicker: string;
  historyEmpty: string;
  startVoting: string;
  /** Includes the leading '▍' mark. */
  recordChoicePrefix: string;
  statusActive: string;
  statusEnded: string;
  certsKicker: string;
  certsEmpty: string;
  toActiveVotes: string;
  fundKicker: string;
  soonTitle: string;
  fundSoonText: string;
  newsKicker: string;
  newsSoonText: string;
  settingsKicker: string;
  settingsProfile: string;
  settingsProfileMeta: string;
  settingsMunicipality: string;
  settingsMunicipalityFallback: string;
  settingsNotifications: string;
  settingsNotificationsMeta: string;
  settingsAccounts: string;
  settingsAccountsMeta: string;
  /** Direction-semantic arrow glyph, mirrored between RTL and LTR. */
  arrow: string;
  /** BCP 47 tag for the edition date, vote dates and grouped figures. */
  dateLocale: string;
}

const COPY: Record<Locale, DashboardCopy> = {
  he: {
    tabs: [
      { value: 'history', label: 'הצבעות' },
      { value: 'certificates', label: 'תעודות' },
      { value: 'fund', label: 'הקרן · בקרוב' },
      { value: 'news', label: 'חדשות' },
      { value: 'settings', label: 'הגדרות' },
    ],
    loading: 'טוען את הגיליון…',
    voteTitleFallback: 'הצבעה',
    voteOptionFallback: 'בעד',
    mastheadKicker: 'הגיליון האישי שלכם · YOUR LEDGER',
    helloPrefix: 'שלום, ',
    nameFallback: 'משתמש',
    setLocation: 'הגדר מיקום ←',
    editionPrefix: 'מהדורה · ',
    verifiedBadge: '✓ מאומת',
    verifyLocation: 'אמת את המיקום ←',
    verifyKicker: 'אימות תושבות · נדרש כדי להצביע',
    verifyNotStarted: 'התחילו את תהליך אימות התושבות כדי שהקול שלכם ייספר.',
    verifyInProgressPrefix: 'בתהליך: ',
    verifyInProgressSuffix: ' צ׳ק-אינים הושלמו.',
    verifyFailed: 'האימות נכשל. אפשר לנסות שוב.',
    verifyStartCta: 'התחילו אימות',
    verifyStatusCta: 'צפו בסטטוס',
    identityKicker: 'ציון זהות',
    improveScore: 'הוסיפו חשבונות לשיפור הציון ←',
    stepsKicker: 'הדרך לקלפי · THE ROUTE TO A BALLOT',
    stepGoogle: 'חשבון Google',
    stepGoogleMeta: 'האימות הראשוני, נרשם בהתחברות',
    stepResidency: 'אימות תושבוּת GPS',
    stepResidencyMeta: 'הצ׳ק-אין הראשון פותח את הקלפי',
    stepSocial: 'פייסבוק ואינסטגרם',
    stepSocialMeta: '10 נקודות לכל חשבון מקושר',
    stepPointsSuffix: ' נק׳',
    stepDone: 'הושלם',
    stepOpen: 'פתוח',
    gateHavePrefix: 'יש לכם ',
    gateNeedMid: ' מתוך ',
    gateNeedSuffix: ' הנקודות הדרושות להצבעה.',
    gateClearedLine: 'הגעתם לסף. אתם רשאים להצביע.',
    gateCta: 'להשלמת האימות ←',
    totalVotesLabel: 'סה״כ הצבעות',
    activeVotesLabel: 'פעילות',
    createdVotesLabel: 'שיצרתם',
    communityKicker: 'המספרים של הקהילה · COMMUNITY',
    registeredLabel: 'נרשמו לפלטפורמה',
    registeredInCityPrefix: 'מתוכם ',
    registeredInCityMid: ' ב',
    cityFallbackYours: 'עיר שלכם',
    municipalityWithheld: 'הפילוח העירוני ייחשף כשיצטרפו עוד תושבים',
    registeredTotalMeta: 'סך כל הנרשמים',
    statLoadError: 'לא הצלחנו לטעון את הנתון כרגע.',
    fundStatLabel: 'הקרן הקהילתית',
    fundStatNote: 'תיפתח עם ההצבעה הראשונה.',
    bagsStatLabel: 'שווי התיקים',
    bagsStatNote: 'מדד ההשקעה הקהילתית יעלה בהמשך.',
    activeInCityPrefix: 'פעיל ב',
    cityFallbackYour: 'עיר שלך',
    cityLineSingle: 'הצבעה אחת פתוחה מחכה לקול שלכם.',
    cityLinePluralSuffix: ' הצבעות פתוחות מחכות לקול שלכם.',
    allVotesCta: 'לכל ההצבעות',
    viewActiveVotes: 'צפייה בהצבעות פעילות',
    createVote: 'יצירת הצבעה חדשה',
    sectionsAria: 'מדורי הגיליון',
    historyKicker: 'ההצבעות האחרונות שלכם · SETTLED RECORD',
    historyEmpty: 'עוד לא הצבעתם. הצבעות שתשתתפו בהן יירשמו כאן.',
    startVoting: 'התחילו להצביע',
    recordChoicePrefix: '▍ הצבעתם: ',
    statusActive: '● פעיל',
    statusEnded: '□ הסתיים',
    certsKicker: 'התעודות שלכם · CIVIC CERTIFICATES',
    certsEmpty:
      'עוד אין לכם תעודות. תעודה אזרחית מונפקת אוטומטית כשהצבעה שהשתתפתם בה מסתיימת, כרישום חתום של ההשתתפות.',
    toActiveVotes: 'להצבעות הפעילות',
    fundKicker: 'הקרן הקהילתית · TREASURY',
    soonTitle: 'בקרוב',
    fundSoonText: 'הקרן הקהילתית תיפתח עם ההצבעה הראשונה. עד אז אין מה להציג כאן.',
    newsKicker: 'חדשות ועדכונים · NEWS',
    newsSoonText: 'עדכונים מהקהילה ומהפעילות המקומית יופיעו כאן בהמשך.',
    settingsKicker: 'הגדרות · SETTINGS',
    settingsProfile: 'פרופיל אישי',
    settingsProfileMeta: 'שם, טלפון, תמונה',
    settingsMunicipality: 'רשות מקומית',
    settingsMunicipalityFallback: 'לא נבחרה',
    settingsNotifications: 'התראות',
    settingsNotificationsMeta: 'דוא״ל, פוש, עדכוני הצבעות',
    settingsAccounts: 'חשבונות מקושרים',
    settingsAccountsMeta: 'שיפור ציון הזהות',
    arrow: '←',
    dateLocale: 'he-IL',
  },
  en: {
    tabs: [
      { value: 'history', label: 'Votes' },
      { value: 'certificates', label: 'Certificates' },
      { value: 'fund', label: 'The fund · soon' },
      { value: 'news', label: 'News' },
      { value: 'settings', label: 'Settings' },
    ],
    loading: 'Loading your edition…',
    voteTitleFallback: 'Vote',
    voteOptionFallback: 'In favor',
    mastheadKicker: 'YOUR LEDGER',
    helloPrefix: 'Hello, ',
    nameFallback: 'reader',
    setLocation: 'Set location →',
    editionPrefix: 'Edition · ',
    verifiedBadge: '✓ Verified',
    verifyLocation: 'Verify location →',
    verifyKicker: 'Residency verification · Required to vote',
    verifyNotStarted: 'Start the residency verification process so your voice is counted.',
    verifyInProgressPrefix: 'In progress: ',
    verifyInProgressSuffix: ' check-ins completed.',
    verifyFailed: 'Verification failed. You can try again.',
    verifyStartCta: 'Start verification',
    verifyStatusCta: 'View status',
    identityKicker: 'Identity score',
    improveScore: 'Add accounts to improve the score →',
    stepsKicker: 'The route to a ballot',
    stepGoogle: 'Google account',
    stepGoogleMeta: 'The first proof, recorded at sign-in',
    stepResidency: 'GPS residency check',
    stepResidencyMeta: 'The first check-in opens the ballot',
    stepSocial: 'Facebook and Instagram',
    stepSocialMeta: '10 points per linked account',
    stepPointsSuffix: ' pts',
    stepDone: 'Done',
    stepOpen: 'Open',
    gateHavePrefix: 'You hold ',
    gateNeedMid: ' of the ',
    gateNeedSuffix: ' points a ballot requires.',
    gateClearedLine: 'You have cleared the threshold. You may vote.',
    gateCta: 'Finish verification →',
    totalVotesLabel: 'Total votes',
    activeVotesLabel: 'Active',
    createdVotesLabel: 'Created by you',
    communityKicker: 'The community in figures · COMMUNITY',
    registeredLabel: 'Registered on the platform',
    registeredInCityPrefix: 'Including ',
    registeredInCityMid: ' in ',
    cityFallbackYours: 'your city',
    municipalityWithheld: 'The municipal breakdown will be revealed as more residents join',
    registeredTotalMeta: 'All registrants',
    statLoadError: 'We could not load this figure right now.',
    fundStatLabel: 'The community fund',
    fundStatNote: 'Opens with the first vote.',
    bagsStatLabel: 'Portfolio value',
    bagsStatNote: 'The community investment index arrives later.',
    activeInCityPrefix: 'Active in ',
    cityFallbackYour: 'your city',
    cityLineSingle: 'One open vote is waiting for your voice.',
    cityLinePluralSuffix: ' open votes are waiting for your voice.',
    allVotesCta: 'All votes',
    viewActiveVotes: 'View active votes',
    createVote: 'Create a new vote',
    sectionsAria: 'Ledger sections',
    historyKicker: 'Your recent votes · SETTLED RECORD',
    historyEmpty: 'You have not voted yet. Votes you take part in will be recorded here.',
    startVoting: 'Start voting',
    recordChoicePrefix: '▍ You voted: ',
    statusActive: '● Active',
    statusEnded: '□ Ended',
    certsKicker: 'CIVIC CERTIFICATES',
    certsEmpty:
      'You have no certificates yet. A civic certificate is issued automatically when a vote you took part in ends, as a signed record of your participation.',
    toActiveVotes: 'To the active votes',
    fundKicker: 'The community fund · TREASURY',
    soonTitle: 'Coming soon',
    fundSoonText: 'The community fund opens with the first vote. Until then there is nothing to show here.',
    newsKicker: 'News and updates',
    newsSoonText: 'Updates from the community and from local activity will appear here.',
    settingsKicker: 'SETTINGS',
    settingsProfile: 'Personal profile',
    settingsProfileMeta: 'Name, phone, photo',
    settingsMunicipality: 'Municipality',
    settingsMunicipalityFallback: 'Not selected',
    settingsNotifications: 'Notifications',
    settingsNotificationsMeta: 'Email, push, vote updates',
    settingsAccounts: 'Linked accounts',
    settingsAccountsMeta: 'Improve your identity score',
    arrow: '→',
    dateLocale: 'en-GB',
  },
};

/**
 * Placeholder for a statistic that does not exist yet.
 *
 * The community fund and the Issue Coin ("bags") valuation are not implemented
 * in the MVP. Keeping the card in the layout preserves the information
 * architecture, but it is deliberately UI-ONLY: it calls no endpoint and holds
 * no number. Showing ₪0 here would be indistinguishable from a real empty fund,
 * which is exactly the kind of fake figure this dashboard must never print.
 */
interface ComingSoonStatCopy {
  soon: string;
}

const COMING_SOON_COPY: Record<Locale, ComingSoonStatCopy> = {
  he: { soon: 'בקרוב' },
  en: { soon: 'Coming soon' },
};

function ComingSoonStat({
  label,
  note,
  locale = 'he',
}: {
  label: string;
  note: string;
  locale?: Locale;
}) {
  const t = COMING_SOON_COPY[locale];
  return (
    <div className={`${styles.statCard} ${styles.statCardSoon}`}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statSoon}>
        <span aria-hidden className={styles.statSoonMark}>●</span>
        {t.soon}
      </span>
      <span className={styles.statMeta}>{note}</span>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  // Client component under `/[locale]`: the segment is the only locale source
  // here, and it is untyped at the params boundary. An unknown value falls back
  // to the default edition rather than rendering an undefined copy deck.
  const params = useParams<{ locale?: string }>();
  const locale: Locale = params?.locale === 'en' ? 'en' : 'he';
  const t = COPY[locale];
  const prefix = localePrefix(locale);
  const reduced = useReducedMotion();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentVotes, setRecentVotes] = useState<RecentVote[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationStats | null>(null);
  const [activeInCity, setActiveInCity] = useState<{ id: string; title: string }[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [tab, setTab] = useState<DashboardTab>('history');
  // Server truth for the ballot gate. The session profile carries the identity
  // points but not the residency evidence (a check-in lives in
  // `verification_runs`), so computing it here would print "40/80" at a
  // resident who has already checked in and may vote.
  const serverGate = useVotingGate(isAuthenticated);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(`${prefix}/sign-in?redirect=${prefix}/dashboard`);
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
              title: p.vote?.title || t.voteTitleFallback,
              status: (p.vote?.status === 'active' ? 'active' : 'ended') as 'active' | 'ended',
              votedAt: new Date(p.createdAt).toLocaleDateString(t.dateLocale),
              option: p.option?.text || t.voteOptionFallback,
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
    // for when the fund opens - it is simply not called from here.

    // Community registration figures - public aggregate counts, no per-user
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

    // Civic certificates (NFTs) - auto-issued on resolution, view-only.
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
        <PressLoader />
        <p className={styles.loadingText}>{t.loading}</p>
      </div>
    );
  }

  // Get identity level info
  const identityLevel = user?.identityScore?.level || 'basic';
  const identityTotal = user?.identityScore?.total || 0;
  const verificationPhase = user?.verificationStatus?.phase || 'not_started';
  const isVerified = verificationPhase === 'completed';

  // The ballot gate: the server's answer once it lands, the local reading of
  // the profile until then. The local one can only understate residency, so the
  // worst first paint is a figure that grows - never a ballot promised and then
  // withdrawn.
  const gate = serverGate ?? voterGate(user);
  const breakdown = user?.identityScore?.breakdown;
  const socialEarned =
    (breakdown?.facebook ?? 0) + (breakdown?.instagram ?? 0);
  const verificationSteps = [
    {
      label: t.stepGoogle,
      meta: t.stepGoogleMeta,
      worth: IDENTITY_SCORE_WEIGHTS.google,
      earned: breakdown?.google ?? 0,
      done: (breakdown?.google ?? 0) > 0,
    },
    {
      label: t.stepResidency,
      meta: t.stepResidencyMeta,
      worth: GPS_SCORE_WEIGHT,
      earned: gate.residencyPoints,
      done: gate.residencyPoints > 0,
    },
    {
      label: t.stepSocial,
      meta: t.stepSocialMeta,
      worth: IDENTITY_SCORE_WEIGHTS.facebook + IDENTITY_SCORE_WEIGHTS.instagram,
      earned: socialEarned,
      done: socialEarned > 0,
    },
  ];
  const locationState = resolveLocationState(user?.municipality, isVerified);

  // Real newspaper issue number: days since the paper's epoch - same for
  // every reader on a given day, counts up daily like a printed daily.
  const PAPER_EPOCH = Date.UTC(2025, 0, 1);
  const issueNo = Math.floor((Date.now() - PAPER_EPOCH) / 86_400_000);
  const today = new Date().toLocaleDateString(t.dateLocale);

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
      <main className={`${styles.main} np-desk`}>
        <div className={styles.container}>
          {/* The whole ledger sits on one lifted sheet; the main is the desk. */}
          <div className={`${styles.sheet} np-sheet`}>
          {/* ===== Masthead: personal edition ===== */}
          <motion.header className={styles.masthead} {...reveal(0)}>
            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              {t.mastheadKicker}
            </span>
            <h1 className={styles.title}>
              {t.helloPrefix}
              <span className={styles.red}>{user?.firstName || t.nameFallback}</span>.
            </h1>
            <div className={styles.editionMeta}>
              {/* Location. Never falls back to a default town - see
                  resolveLocationState. Each state carries its own way forward. */}
              {locationState === 'unset' ? (
                <button
                  type="button"
                  className={styles.metaCta}
                  onClick={() => router.push(`${prefix}/settings/municipality`)}
                >
                  {t.setLocation}
                </button>
              ) : (
                <MunicipalityLink name={user?.municipality} locale={locale} />
              )}
              <span className={styles.sep} aria-hidden>■</span>
              <span>
                {t.editionPrefix}
                {issueNo}
              </span>
              <span className={styles.sep} aria-hidden>■</span>
              <span>{today}</span>
              {/* Verification slot. Omitted while the town is unset, because
                  residency cannot be verified before a town is chosen - the
                  "הגדר מיקום" CTA above is the real next step, and a second
                  competing CTA would only split it. */}
              {locationState === 'verified' && (
                <>
                  <span className={styles.sep} aria-hidden>■</span>
                  <span className={styles.badgeOk}>{t.verifiedBadge}</span>
                </>
              )}
              {locationState === 'unverified' && (
                <>
                  <span className={styles.sep} aria-hidden>■</span>
                  <button
                    type="button"
                    className={styles.metaCta}
                    onClick={() => router.push(`${prefix}/verification`)}
                  >
                    {t.verifyLocation}
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
                  {t.verifyKicker}
                </span>
                <p className={styles.verifyBody}>
                  {verificationPhase === 'not_started'
                    ? t.verifyNotStarted
                    : verificationPhase === 'in_progress'
                      ? `${t.verifyInProgressPrefix}${user?.verificationStatus?.checkInsCompleted || 0}/${user?.verificationStatus?.checkInsTotal || 0}${t.verifyInProgressSuffix}`
                      : t.verifyFailed}
                </p>
              </div>
              <NewsButton
                variant="red"
                size="md"
                onClick={() => router.push(`${prefix}/verification`)}
                trailing={<span aria-hidden>{t.arrow}</span>}
              >
                {verificationPhase === 'not_started'
                  ? t.verifyStartCta
                  : t.verifyStatusCta}
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
                  {t.identityKicker}
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

              {/* The route to a ballot, as a numbered running order: which
                  step, what it is worth, whether it is done. Printed because
                  "ציון זהות 40" alone never said what 40 was short of. */}
              <div className={styles.stepsBlock}>
                <span className={styles.boxKicker}>
                  <span aria-hidden className={styles.kickerTick} />
                  {t.stepsKicker}
                </span>
                <ol className={styles.stepsList}>
                  {verificationSteps.map((step, i) => (
                    <li
                      key={step.label}
                      className={step.done ? styles.stepDone : styles.step}
                    >
                      <span aria-hidden className={styles.stepNum}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className={styles.stepText}>
                        <span className={styles.stepLabel}>{step.label}</span>
                        <span className={styles.stepMeta}>{step.meta}</span>
                      </span>
                      <span className={styles.stepPoints}>
                        {step.earned}/{step.worth}
                        {t.stepPointsSuffix}
                      </span>
                      <span className={styles.stepState}>
                        {step.done ? t.stepDone : t.stepOpen}
                      </span>
                    </li>
                  ))}
                </ol>
                <p className={gate.canVote ? styles.gateCleared : styles.gateShort}>
                  {gate.canVote
                    ? t.gateClearedLine
                    : `${t.gateHavePrefix}${gate.total}${t.gateNeedMid}${gate.required}${t.gateNeedSuffix}`}
                </p>
              </div>

              {!gate.canVote && (
                <button
                  type="button"
                  className={styles.inlineLink}
                  onClick={() => router.push(`${prefix}/verification`)}
                >
                  {t.gateCta}
                </button>
              )}
              {identityTotal < 100 && (
                <button
                  type="button"
                  className={styles.inlineLink}
                  onClick={() => router.push(`${prefix}/settings/social-connections`)}
                >
                  {t.improveScore}
                </button>
              )}
            </div>

            {/* Figures grid */}
            <div className={styles.figuresGrid}>
              <div className={styles.figureCell}>
                <span className={styles.figureNum}>{stats?.totalVotes || 0}</span>
                <span className={styles.figureLabel}>{t.totalVotesLabel}</span>
              </div>
              <div className={styles.figureCell}>
                <span className={styles.figureNum}>{stats?.activeVotes || 0}</span>
                <span className={styles.figureLabel}>{t.activeVotesLabel}</span>
              </div>
              <div className={styles.figureCell}>
                <span className={styles.figureNum}>{stats?.votesCreated || 0}</span>
                <span className={styles.figureLabel}>{t.createdVotesLabel}</span>
              </div>
            </div>
          </motion.section>

          {/* ===== Community statistics ===== */}
          <motion.section className={styles.statsBand} {...reveal(0.09)}>
            <span className={styles.boxKicker}>
              <span aria-hidden className={styles.kickerTick} />
              {t.communityKicker}
            </span>

            <div className={styles.statsGrid}>
              {/* Registered residents - real figures, never fabricated. */}
              <div className={styles.statCard}>
                <span className={styles.statLabel}>{t.registeredLabel}</span>
                {registrations ? (
                  <>
                    <span className={styles.statNum}>
                      {registrations.registeredTotal.toLocaleString(t.dateLocale)}
                    </span>
                    <span className={styles.statMeta}>
                      {registrations.registeredInMunicipality !== null
                        ? `${t.registeredInCityPrefix}${registrations.registeredInMunicipality.toLocaleString(t.dateLocale)}${t.registeredInCityMid}${user?.municipality || t.cityFallbackYours}`
                        : registrations.municipalityWithheld
                          ? t.municipalityWithheld
                          : t.registeredTotalMeta}
                    </span>
                  </>
                ) : (
                  <span className={styles.statMeta}>{t.statLoadError}</span>
                )}
              </div>

              {/* Community fund + Issue Coins are not live in the MVP. Render an
                  honest placeholder rather than a zero or an invented figure -
                  no endpoint is called for these cards on purpose. */}
              <ComingSoonStat
                label={t.fundStatLabel}
                note={t.fundStatNote}
                locale={locale}
              />
              <ComingSoonStat
                label={t.bagsStatLabel}
                note={t.bagsStatNote}
                locale={locale}
              />
            </div>
          </motion.section>

          {/* ===== Quick actions strip ===== */}
          {activeInCity.length > 0 && (
            <motion.section className={styles.cityCallout} {...reveal(0.1)}>
              <div className={styles.cityMain}>
                <span className={styles.cityKicker}>
                  <span aria-hidden className={styles.kickerTick} />
                  {t.activeInCityPrefix}
                  {user?.municipality || t.cityFallbackYour} · {activeInCity.length}
                </span>
                <p className={styles.cityLine}>
                  {activeInCity.length === 1
                    ? t.cityLineSingle
                    : `${activeInCity.length}${t.cityLinePluralSuffix}`}
                </p>
                <ul className={styles.cityList}>
                  {activeInCity.slice(0, 3).map((v) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        className={styles.cityItem}
                        onClick={() => router.push(`${prefix}/votes/${v.id}`)}
                      >
                        <span aria-hidden>▍</span> {v.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <NewsButton
                variant="red"
                size="md"
                onClick={() => router.push(`${prefix}/votes`)}
              >
                {t.allVotesCta}
              </NewsButton>
            </motion.section>
          )}

          <motion.section className={styles.actionsStrip} {...reveal(0.12)}>
            <NewsButton
              variant="ink"
              size="md"
              onClick={() => router.push(`${prefix}/votes`)}
            >
              {t.viewActiveVotes}
            </NewsButton>
            <NewsButton
              variant="outline"
              size="md"
              onClick={() => router.push(`${prefix}/votes/create`)}
            >
              {t.createVote}
            </NewsButton>
          </motion.section>

          {/* ===== Tabbed ledger sections ===== */}
          <motion.section className={styles.tabbed} {...reveal(0.16)}>
            <Segmented<DashboardTab>
              segments={t.tabs}
              value={tab}
              onChange={setTab}
              variant="ink"
              aria-label={t.sectionsAria}
            />

            {/* --- HISTORY --- */}
            {tab === 'history' && (
              <div className={styles.panel}>
                <span className={styles.panelKicker}>
                  <span aria-hidden className={styles.kickerTick} />
                  {t.historyKicker}
                </span>
                {recentVotes.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p className={styles.emptyText}>{t.historyEmpty}</p>
                    <NewsButton
                      variant="red"
                      size="md"
                      onClick={() => router.push(`${prefix}/votes`)}
                    >
                      {t.startVoting}
                    </NewsButton>
                  </div>
                ) : (
                  <ul className={styles.recordList}>
                    {recentVotes.map((vote) => (
                      <li
                        key={vote.id}
                        className={styles.record}
                        onClick={() => router.push(`${prefix}/votes/${vote.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            router.push(`${prefix}/votes/${vote.id}`);
                          }
                        }}
                      >
                        <div className={styles.recordMain}>
                          <h3 className={styles.recordTitle}>{vote.title}</h3>
                          <div className={styles.recordMeta}>
                            <span className={styles.recordChoice}>
                              {t.recordChoicePrefix}
                              {vote.option}
                            </span>
                            <span className={styles.recordDate}>{vote.votedAt}</span>
                          </div>
                        </div>
                        <span
                          className={`${styles.recordStatus} ${styles[vote.status]}`}
                        >
                          {vote.status === 'active' ? t.statusActive : t.statusEnded}
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
                  {t.certsKicker}
                </span>
                {certificates.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p className={styles.emptyText}>{t.certsEmpty}</p>
                    <NewsButton
                      variant="red"
                      size="md"
                      onClick={() => router.push(`${prefix}/votes`)}
                    >
                      {t.toActiveVotes}
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
                here - no totals, no rows, no zero balance. */}
            {tab === 'fund' && (
              <div className={styles.panel}>
                <span className={styles.panelKicker}>
                  <span aria-hidden className={styles.kickerTick} />
                  {t.fundKicker}
                </span>
                <div className={styles.newsSoon}>
                  <span aria-hidden className={styles.newsSoonMark}>●</span>
                  <h3 className={styles.newsSoonTitle}>{t.soonTitle}</h3>
                  <p className={styles.newsSoonText}>{t.fundSoonText}</p>
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
                  {t.newsKicker}
                </span>
                <div className={styles.newsSoon}>
                  <span aria-hidden className={styles.newsSoonMark}>●</span>
                  <h3 className={styles.newsSoonTitle}>{t.soonTitle}</h3>
                  <p className={styles.newsSoonText}>{t.newsSoonText}</p>
                </div>
              </div>
            )}

            {tab === 'settings' && (
              <div className={styles.panel}>
                <span className={styles.panelKicker}>
                  <span aria-hidden className={styles.kickerTick} />
                  {t.settingsKicker}
                </span>
                <ul className={styles.settingsList}>
                  {[
                    {
                      label: t.settingsProfile,
                      meta: t.settingsProfileMeta,
                      href: `${prefix}/settings/profile`,
                    },
                    {
                      label: t.settingsMunicipality,
                      meta: user?.municipality || t.settingsMunicipalityFallback,
                      href: `${prefix}/settings/municipality`,
                    },
                    {
                      label: t.settingsNotifications,
                      meta: t.settingsNotificationsMeta,
                      href: `${prefix}/settings/notifications`,
                    },
                    {
                      label: t.settingsAccounts,
                      meta: t.settingsAccountsMeta,
                      href: `${prefix}/settings/social-connections`,
                    },
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
                      <span className={styles.settingsArrow} aria-hidden>
                        {t.arrow}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
