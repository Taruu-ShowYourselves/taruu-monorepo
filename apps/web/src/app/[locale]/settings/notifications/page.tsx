'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { NewsButton } from '@/components/press/NewsButton';
import { Segmented } from '@/components/press/Segmented/Segmented';
import type { NotificationSettings, UserProfile } from '@sync/shared';
import { PressLoader } from '@/components/press/PressMachine';
import styles from './page.module.css';

const REDIRECT = '/sign-in?redirect=/settings/notifications';

const DEFAULT_SETTINGS: NotificationSettings = {
  newVotes: true,
  voteEnding: true,
  voteResults: true,
  marketing: false,
};

const TOGGLE_STATE = [
  { value: 'on' as const, label: 'פעיל' },
  { value: 'off' as const, label: 'כבוי' },
];

interface NotificationRow {
  key: keyof NotificationSettings;
  label: string;
  description: string;
}

const ROWS: NotificationRow[] = [
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
];

function NotificationsContent() {
  const router = useRouter();
  const { isAuthenticated, isLoading, refreshSession } = useAuth();

  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(REDIRECT);
      return;
    }

    const fetchData = async () => {
      try {
        const response = await fetch('/api/user/profile');
        if (response.ok) {
          const { profile: p } = (await response.json()) as { profile: UserProfile };
          setSettings({ ...DEFAULT_SETTINGS, ...(p.notificationSettings ?? {}) });
        } else {
          setErrorMessage('שגיאה בטעינת ההגדרות');
        }
      } catch {
        setErrorMessage('שגיאה בטעינת ההגדרות');
      } finally {
        setDataLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchData();
    }
  }, [isLoading, isAuthenticated, router]);

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
        setSuccessMessage('העדפות ההתראות נשמרו.');
        await refreshSession();
      } else {
        const err = await response.json().catch(() => ({}));
        setErrorMessage(err.error || 'שגיאה בשמירה');
      }
    } catch {
      setErrorMessage('שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || dataLoading) {
    return (
      <div className={styles.loadingContainer}>
        <PressLoader />
        <p>טוען…</p>
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
              התראות · NOTIFICATIONS
            </span>
            <h1 className={styles.title}>
              מה ש<span className={styles.red}>חשוב לכם.</span>
            </h1>
            <p className={styles.standfirst}>
              בחרו אילו עדכונים תרצו לקבל. תוכלו לשנות זאת בכל עת.
            </p>
          </header>

          {successMessage && (
            <div className={`${styles.message} ${styles.success}`} role="status">
              <span aria-hidden className={styles.msgGlyph}>
                ✓
              </span>
              <p>{successMessage}</p>
              <button onClick={() => setSuccessMessage(null)} aria-label="סגור">
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
              <button onClick={() => setErrorMessage(null)} aria-label="סגור">
                ✕
              </button>
            </div>
          )}

          <section className={styles.formCard}>
            <ul className={styles.rows}>
              {ROWS.map((row) => (
                <li key={row.key} className={styles.row}>
                  <div className={styles.rowText}>
                    <h2 className={styles.rowTitle}>{row.label}</h2>
                    <p className={styles.rowDescription}>{row.description}</p>
                  </div>
                  <Segmented
                    segments={TOGGLE_STATE}
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
                {saving ? 'שומר…' : 'שמירת העדפות'}
              </NewsButton>
            </div>
          </section>

          <div className={styles.backLink}>
            <NewsButton
              variant="outline"
              size="md"
              onClick={() => router.push('/dashboard')}
              trailing={<span aria-hidden>←</span>}
            >
              חזרה ללוח הבקרה
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
  return (
    <SuspenseWrapper
      fallback={
        <div className={styles.loadingContainer}>
          <PressLoader />
          <p>טוען…</p>
        </div>
      }
    >
      <NotificationsContent />
    </SuspenseWrapper>
  );
}
