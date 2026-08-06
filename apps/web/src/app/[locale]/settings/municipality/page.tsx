'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { NewsButton } from '@/components/press/NewsButton';
import { PressAutocomplete, MuiPressProvider } from '@/components/press/PressAutocomplete';
import { PressFormCard } from '@/components/press/PressForm';
import { PressAtmosphere } from '@/components/press/PressAtmosphere';
import { MUNICIPALITIES } from '@sync/shared';
import type { UserProfile } from '@sync/shared';
import { PressLoader } from '@/components/press/PressMachine';
import type { Locale } from '@/lib/i18n';
import { localePrefix } from '@/lib/i18n';
import styles from './page.module.css';

const MUNICIPALITY_OPTIONS = MUNICIPALITIES.map((m) => ({ value: m, label: m }));

interface MunicipalityCopy {
  loading: string;
  kicker: string;
  titleLead: string;
  titleRed: string;
  standfirst: string;
  dismissLabel: string;
  loadError: string;
  saveSuccess: string;
  saveError: string;
  fieldLabel: string;
  fieldPlaceholder: string;
  noOptions: string;
  saving: string;
  save: string;
  backToDashboard: string;
  /** Direction-semantic back glyph: mirrored between RTL and LTR. */
  backArrow: string;
}

const COPY: Record<Locale, MunicipalityCopy> = {
  he: {
    loading: 'טוען…',
    kicker: 'רשות מקומית · MUNICIPALITY',
    titleLead: 'הרשות',
    titleRed: 'שלכם.',
    standfirst: 'הרשות המקומית קובעת אילו הצבעות רלוונטיות עבורכם ואיפה קולכם נספר.',
    dismissLabel: 'סגור',
    loadError: 'שגיאה בטעינת הפרופיל',
    saveSuccess: 'הרשות המקומית עודכנה בהצלחה.',
    saveError: 'שגיאה בשמירה',
    fieldLabel: 'רשות מקומית',
    fieldPlaceholder: 'חפשו רשות…',
    noOptions: 'לא נמצאה רשות',
    saving: 'שומר…',
    save: 'שמירת שינויים',
    backToDashboard: 'חזרה ללוח הבקרה',
    backArrow: '←',
  },
  en: {
    loading: 'Loading…',
    kicker: 'MUNICIPALITY',
    titleLead: 'Your',
    titleRed: 'municipality.',
    standfirst:
      'Your municipality determines which votes are relevant to you and where your voice is counted.',
    dismissLabel: 'Close',
    loadError: 'Error loading the profile',
    saveSuccess: 'Municipality updated successfully.',
    saveError: 'Error saving',
    fieldLabel: 'Municipality',
    fieldPlaceholder: 'Search for a municipality…',
    noOptions: 'No municipality found',
    saving: 'Saving…',
    save: 'Save changes',
    backToDashboard: 'Back to the dashboard',
    backArrow: '→',
  },
};

function MunicipalityContent() {
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

  const [municipality, setMunicipality] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(
        `${localePrefix(locale)}/sign-in?redirect=${localePrefix(locale)}/settings/municipality`
      );
      return;
    }

    const fetchData = async () => {
      try {
        const response = await fetch('/api/user/profile');
        if (response.ok) {
          const { profile: p } = (await response.json()) as { profile: UserProfile };
          setProfile(p);
          setMunicipality(p.municipality ?? '');
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
    if (!municipality) return;
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ municipality }),
      });

      if (response.ok) {
        const { profile: p } = (await response.json()) as { profile: UserProfile };
        setProfile(p);
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

  const changed = municipality !== (profile?.municipality ?? '');

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

          <MuiPressProvider>
            <PressFormCard className={styles.formCard}>
              <div data-field>
                <PressAutocomplete
                  label={t.fieldLabel}
                  placeholder={t.fieldPlaceholder}
                  noOptionsText={t.noOptions}
                  options={MUNICIPALITY_OPTIONS}
                  value={municipality}
                  onChange={setMunicipality}
                  locale={locale}
                />
              </div>

              <div className={styles.formActions} data-field>
                <NewsButton
                  variant="red"
                  size="lg"
                  onClick={handleSave}
                  disabled={saving || !municipality || !changed}
                >
                  {saving ? t.saving : t.save}
                </NewsButton>
              </div>
            </PressFormCard>
          </MuiPressProvider>

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

export default function MunicipalitySettingsPage() {
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
      <MunicipalityContent />
    </SuspenseWrapper>
  );
}
