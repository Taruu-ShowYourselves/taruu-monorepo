'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { NewsButton } from '@/components/press/NewsButton';
import { PressInput } from '@/components/press/PressInput/PressInput';
import { PressFormCard } from '@/components/press/PressForm';
import { PressAtmosphere } from '@/components/press/PressAtmosphere';
import type { UserProfile } from '@sync/shared';
import { PressLoader } from '@/components/press/PressMachine';
import styles from './page.module.css';

const REDIRECT = '/sign-in?redirect=/settings/profile';

function ProfileContent() {
  const router = useRouter();
  const { isAuthenticated, isLoading, refreshSession } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shakeTick, setShakeTick] = useState(0);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');

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
          setProfile(p);
          setFirstName(p.firstName ?? '');
          setLastName(p.lastName ?? '');
          setPhone(p.phone ?? '');
          setCity(p.city ?? '');
        } else {
          setErrorMessage('שגיאה בטעינת הפרופיל');
        }
      } catch {
        setErrorMessage('שגיאה בטעינת הפרופיל');
      } finally {
        setDataLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchData();
    }
  }, [isLoading, isAuthenticated, router]);

  const handleSave = async () => {
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          city: city.trim(),
        }),
      });

      if (response.ok) {
        const { profile: p } = (await response.json()) as { profile: UserProfile };
        setProfile(p);
        setSuccessMessage('הפרופיל עודכן בהצלחה.');
        await refreshSession();
      } else {
        const err = await response.json().catch(() => ({}));
        setErrorMessage(err.error || 'שגיאה בשמירת הפרופיל');
        setShakeTick((t) => t + 1);
      }
    } catch {
      setErrorMessage('שגיאה בשמירת הפרופיל');
      setShakeTick((t) => t + 1);
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
        <PressAtmosphere />
        <div className={styles.container}>
          <header className={styles.head}>
            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              פרופיל אישי · PROFILE
            </span>
            <h1 className={styles.title}>
              הפרטים <span className={styles.red}>שלכם.</span>
            </h1>
            <p className={styles.standfirst}>
              עדכנו את שמכם ופרטי הקשר. המדינה קבועה על ישראל (פיילוט במדינה
              אחת). העיר ניתנת לעריכה.
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

          {/* Avatar - read-only, sourced from Google */}
          <section className={styles.avatarCard}>
            <span className={styles.avatarWrap} aria-hidden>
              {profile?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt="" className={styles.avatarImg} />
              ) : (
                <span className={styles.avatarFallback}>
                  {(firstName || profile?.email || '?').charAt(0).toUpperCase()}
                </span>
              )}
            </span>
            <div className={styles.avatarText}>
              <h2 className={styles.avatarTitle}>תמונת הפרופיל</h2>
              <p className={styles.avatarNote}>
                התמונה מסונכרנת מחשבון Google שלכם ואינה ניתנת לעריכה כאן.
              </p>
            </div>
          </section>

          {/* Form */}
          <PressFormCard className={styles.formCard} shakeSignal={shakeTick}>
            <div data-field>
              <PressInput
                type="text"
                label="שם פרטי"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
              />
            </div>
            <div data-field>
              <PressInput
                type="text"
                label="שם משפחה"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
              />
            </div>
            <div data-field>
              <PressInput
                type="tel"
                inputMode="tel"
                label="טלפון"
                placeholder="050-0000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
              />
            </div>
            <div data-field>
              <PressInput
                type="text"
                label="עיר"
                placeholder="עיר מגורים"
                hint="ישראל · פיילוט במדינה אחת"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                autoComplete="address-level2"
              />
            </div>

            <div className={styles.formActions} data-field>
              <NewsButton variant="red" size="lg" onClick={handleSave} disabled={saving}>
                {saving ? 'שומר…' : 'שמירת שינויים'}
              </NewsButton>
            </div>
          </PressFormCard>

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

export default function ProfileSettingsPage() {
  return (
    <SuspenseWrapper
      fallback={
        <div className={styles.loadingContainer}>
          <PressLoader />
          <p>טוען…</p>
        </div>
      }
    >
      <ProfileContent />
    </SuspenseWrapper>
  );
}
