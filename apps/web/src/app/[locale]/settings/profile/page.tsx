'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { NewsButton } from '@/components/press/NewsButton';
import { PressInput } from '@/components/press/PressInput/PressInput';
import { PressFormCard } from '@/components/press/PressForm';
import { PressAtmosphere } from '@/components/press/PressAtmosphere';
import type { UserProfile } from '@sync/shared';
import { PressLoader } from '@/components/press/PressMachine';
import type { Locale } from '@/lib/i18n';
import { localePrefix } from '@/lib/i18n';
import styles from './page.module.css';

interface ProfileCopy {
  loading: string;
  kicker: string;
  titleLead: string;
  titleRed: string;
  standfirst: string;
  dismissLabel: string;
  loadError: string;
  saveSuccess: string;
  saveError: string;
  avatarTitle: string;
  avatarNote: string;
  firstNameLabel: string;
  lastNameLabel: string;
  phoneLabel: string;
  cityLabel: string;
  cityPlaceholder: string;
  cityHint: string;
  saving: string;
  save: string;
  backToDashboard: string;
  /** Direction-semantic back glyph: mirrored between RTL and LTR. */
  backArrow: string;
}

const COPY: Record<Locale, ProfileCopy> = {
  he: {
    loading: 'טוען…',
    kicker: 'פרופיל אישי · PROFILE',
    titleLead: 'הפרטים',
    titleRed: 'שלכם.',
    standfirst:
      'עדכנו את שמכם ופרטי הקשר. המדינה קבועה על ישראל (פיילוט במדינה אחת). העיר ניתנת לעריכה.',
    dismissLabel: 'סגור',
    loadError: 'שגיאה בטעינת הפרופיל',
    saveSuccess: 'הפרופיל עודכן בהצלחה.',
    saveError: 'שגיאה בשמירת הפרופיל',
    avatarTitle: 'תמונת הפרופיל',
    avatarNote: 'התמונה מסונכרנת מחשבון Google שלכם ואינה ניתנת לעריכה כאן.',
    firstNameLabel: 'שם פרטי',
    lastNameLabel: 'שם משפחה',
    phoneLabel: 'טלפון',
    cityLabel: 'עיר',
    cityPlaceholder: 'עיר מגורים',
    cityHint: 'ישראל · פיילוט במדינה אחת',
    saving: 'שומר…',
    save: 'שמירת שינויים',
    backToDashboard: 'חזרה ללוח הבקרה',
    backArrow: '←',
  },
  en: {
    loading: 'Loading…',
    kicker: 'Personal profile · PROFILE',
    titleLead: 'Your',
    titleRed: 'details.',
    standfirst:
      'Update your name and contact details. The country is fixed to Israel (a one-country pilot). The city can be edited.',
    dismissLabel: 'Close',
    loadError: 'Error loading the profile',
    saveSuccess: 'Profile updated successfully.',
    saveError: 'Error saving the profile',
    avatarTitle: 'Profile photo',
    avatarNote: 'The photo is synced from your Google account and cannot be edited here.',
    firstNameLabel: 'First name',
    lastNameLabel: 'Last name',
    phoneLabel: 'Phone',
    cityLabel: 'City',
    cityPlaceholder: 'City of residence',
    cityHint: 'Israel · one-country pilot',
    saving: 'Saving…',
    save: 'Save changes',
    backToDashboard: 'Back to the dashboard',
    backArrow: '→',
  },
};

function ProfileContent() {
  const params = useParams();
  const router = useRouter();
  const locale: Locale = params?.locale === 'en' ? 'en' : 'he';
  const t = COPY[locale];
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
      router.push(
        `${localePrefix(locale)}/sign-in?redirect=${localePrefix(locale)}/settings/profile`
      );
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
        setSuccessMessage(t.saveSuccess);
        await refreshSession();
      } else {
        const err = await response.json().catch(() => ({}));
        setErrorMessage(err.error || t.saveError);
        setShakeTick((tick) => tick + 1);
      }
    } catch {
      setErrorMessage(t.saveError);
      setShakeTick((tick) => tick + 1);
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
        <PressAtmosphere />
        <div className={styles.container}>
          <header className={styles.head}>
            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              {t.kicker}
            </span>
            <h1 className={styles.title}>
              {t.titleLead} <span className={styles.red}>{t.titleRed}</span>
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
              <h2 className={styles.avatarTitle}>{t.avatarTitle}</h2>
              <p className={styles.avatarNote}>{t.avatarNote}</p>
            </div>
          </section>

          {/* Form */}
          <PressFormCard className={styles.formCard} shakeSignal={shakeTick}>
            <div data-field>
              <PressInput
                type="text"
                label={t.firstNameLabel}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
              />
            </div>
            <div data-field>
              <PressInput
                type="text"
                label={t.lastNameLabel}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
              />
            </div>
            <div data-field>
              <PressInput
                type="tel"
                inputMode="tel"
                label={t.phoneLabel}
                placeholder="050-0000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
              />
            </div>
            <div data-field>
              <PressInput
                type="text"
                label={t.cityLabel}
                placeholder={t.cityPlaceholder}
                hint={t.cityHint}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                autoComplete="address-level2"
              />
            </div>

            <div className={styles.formActions} data-field>
              <NewsButton variant="red" size="lg" onClick={handleSave} disabled={saving}>
                {saving ? t.saving : t.save}
              </NewsButton>
            </div>
          </PressFormCard>

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

export default function ProfileSettingsPage() {
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
      <ProfileContent />
    </SuspenseWrapper>
  );
}
