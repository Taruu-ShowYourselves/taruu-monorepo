'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { NewsButton } from '@/components/press/NewsButton';
import { Segmented } from '@/components/press/Segmented/Segmented';
import type { NotificationSettings, UserProfile } from '@sync/shared';
import { PressLoader } from '@/components/press/PressMachine';
import type { Locale } from '@/lib/i18n';
import { localePrefix } from '@/lib/i18n';
import styles from './page.module.css';

const DEFAULT_SETTINGS: NotificationSettings = {
  newVotes: true,
  voteEnding: true,
  voteResults: true,
  marketing: false,
};

interface NotificationRow {
  key: keyof NotificationSettings;
  label: string;
  description: string;
}

interface NotificationsCopy {
  loading: string;
  kicker: string;
  titleLead: string;
  titleRed: string;
  standfirst: string;
  dismissLabel: string;
  toggleSegments: { value: 'on' | 'off'; label: string }[];
  rows: NotificationRow[];
  loadError: string;
  saveSuccess: string;
  saveError: string;
  saving: string;
  save: string;
  backToDashboard: string;
  /** Direction-semantic back glyph: mirrored between RTL and LTR. */
  backArrow: string;
}

const COPY: Record<Locale, NotificationsCopy> = {
  he: {
    loading: 'טוען…',
    kicker: 'התראות · NOTIFICATIONS',
    titleLead: 'מה ש',
    titleRed: 'חשוב לכם.',
    standfirst: 'בחרו אילו עדכונים תרצו לקבל. תוכלו לשנות זאת בכל עת.',
    dismissLabel: 'סגור',
    toggleSegments: [
      { value: 'on', label: 'פעיל' },
      { value: 'off', label: 'כבוי' },
    ],
    rows: [
      {
        key: 'newVotes',
        label: 'הצבעות חדשות',
        description: 'התראה כשנפתחת הצבעה חדשה ברשות שלכם.',
      },
      {
        key: 'voteEnding',
        label: 'הצבעות שמסתיימות',
        description: 'תזכורת לפני שהצבעה שאתם עוקבים אחריה נסגרת.',
      },
      {
        key: 'voteResults',
        label: 'תוצאות הצבעה',
        description: 'עדכון כשמתפרסמות תוצאות של הצבעה שהשתתפתם בה.',
      },
      {
        key: 'marketing',
        label: 'עדכוני מוצר',
        description: 'הודעות על שינויים ותכונות חדשות בתַּרְאוּ.',
      },
    ],
    loadError: 'שגיאה בטעינת ההגדרות',
    saveSuccess: 'העדפות ההתראות נשמרו.',
    saveError: 'שגיאה בשמירה',
    saving: 'שומר…',
    save: 'שמירת העדפות',
    backToDashboard: 'חזרה ללוח הבקרה',
    backArrow: '←',
  },
  en: {
    loading: 'Loading…',
    kicker: 'NOTIFICATIONS',
    titleLead: 'What ',
    titleRed: 'matters to you.',
    standfirst: 'Choose which updates you would like to receive. You can change this at any time.',
    dismissLabel: 'Close',
    toggleSegments: [
      { value: 'on', label: 'On' },
      { value: 'off', label: 'Off' },
    ],
    rows: [
      {
        key: 'newVotes',
        label: 'New votes',
        description: 'An alert when a new vote opens in your municipality.',
      },
      {
        key: 'voteEnding',
        label: 'Votes closing soon',
        description: 'A reminder before a vote you follow closes.',
      },
      {
        key: 'voteResults',
        label: 'Vote results',
        description: 'An update when the results of a vote you took part in are published.',
      },
      {
        key: 'marketing',
        label: 'Product updates',
        description: 'News about changes and new features in Taruu.',
      },
    ],
    loadError: 'Error loading the settings',
    saveSuccess: 'Notification preferences saved.',
    saveError: 'Error saving',
    saving: 'Saving…',
    save: 'Save preferences',
    backToDashboard: 'Back to the dashboard',
    backArrow: '→',
  },
};

function NotificationsContent() {
  const params = useParams();
  const router = useRouter();
  const locale: Locale = params?.locale === 'en' ? 'en' : 'he';
  const t = COPY[locale];
  const { isAuthenticated, isLoading, refreshSession } = useAuth();

  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(
        `${localePrefix(locale)}/sign-in?redirect=${localePrefix(locale)}/settings/notifications`
      );
      return;
    }

    const fetchData = async () => {
      try {
        const response = await fetch('/api/user/profile');
        if (response.ok) {
          const { profile: p } = (await response.json()) as { profile: UserProfile };
          setSettings({ ...DEFAULT_SETTINGS, ...(p.notificationSettings ?? {}) });
        } else {
          setErrorMessage(t.loadError);
        }
      } catch {
        setErrorMessage(t.loadError);
      } finally {
        setDataLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchData();
    }
  }, [isLoading, isAuthenticated, router, locale, t.loadError]);

  const toggle = (key: keyof NotificationSettings, next: 'on' | 'off') => {
    setSettings((prev) => ({ ...prev, [key]: next === 'on' }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationSettings: settings }),
      });

      if (response.ok) {
        setSuccessMessage(t.saveSuccess);
        await refreshSession();
      } else {
        const err = await response.json().catch(() => ({}));
        setErrorMessage(err.error || t.saveError);
      }
    } catch {
      setErrorMessage(t.saveError);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || dataLoading) {
    return (
      <div className={styles.loadingContainer}>
        <PressLoader />
        <p>{t.loading}</p>
      </div>
    );
  }

  return (
    <>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <header className={styles.head}>
            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              {t.kicker}
            </span>
            <h1 className={styles.title}>
              {t.titleLead}<span className={styles.red}>{t.titleRed}</span>
            </h1>
            <p className={styles.standfirst}>{t.standfirst}</p>
          </header>

          {successMessage && (
            <div className={`${styles.message} ${styles.success}`} role="status">
              <span aria-hidden className={styles.msgGlyph}>
                ✓
              </span>
              <p>{successMessage}</p>
              <button onClick={() => setSuccessMessage(null)} aria-label={t.dismissLabel}>
                ✕
              </button>
            </div>
          )}

          {errorMessage && (
            <div className={`${styles.message} ${styles.error}`} role="alert">
              <span aria-hidden className={styles.msgGlyph}>
                ✕
              </span>
              <p>{errorMessage}</p>
              <button onClick={() => setErrorMessage(null)} aria-label={t.dismissLabel}>
                ✕
              </button>
            </div>
          )}

          <section className={styles.formCard}>
            <ul className={styles.rows}>
              {t.rows.map((row) => (
                <li key={row.key} className={styles.row}>
                  <div className={styles.rowText}>
                    <h2 className={styles.rowTitle}>{row.label}</h2>
                    <p className={styles.rowDescription}>{row.description}</p>
                  </div>
                  <Segmented
                    segments={t.toggleSegments}
                    value={settings[row.key] ? 'on' : 'off'}
                    onChange={(next) => toggle(row.key, next)}
                    variant="ink"
                    aria-label={row.label}
                    className={styles.toggle}
                  />
                </li>
              ))}
            </ul>

            <div className={styles.formActions}>
              <NewsButton variant="red" size="lg" onClick={handleSave} disabled={saving}>
                {saving ? t.saving : t.save}
              </NewsButton>
            </div>
          </section>

          <div className={styles.backLink}>
            <NewsButton
              variant="outline"
              size="md"
              onClick={() => router.push(`${localePrefix(locale)}/dashboard`)}
              trailing={<span aria-hidden>{t.backArrow}</span>}
            >
              {t.backToDashboard}
            </NewsButton>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

// Cast Suspense for React 19 type compatibility
const SuspenseWrapper = Suspense as any;

export default function NotificationsSettingsPage() {
  const params = useParams();
  const locale: Locale = params?.locale === 'en' ? 'en' : 'he';
  const t = COPY[locale];
  return (
    <SuspenseWrapper
      fallback={
        <div className={styles.loadingContainer}>
          <PressLoader />
          <p>{t.loading}</p>
        </div>
      }
    >
      <NotificationsContent />
    </SuspenseWrapper>
  );
}
