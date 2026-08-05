'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { NewsButton } from '@/components/press/NewsButton';
import { PressInput } from '@/components/press/PressInput/PressInput';
import { Stepper } from '@/components/press/Stepper/Stepper';
import { MUNICIPALITIES } from '@sync/shared';
import { cn } from '@/lib/cn';
import { PressLoader } from '@/components/press/PressMachine';
import styles from './page.module.css';

const STEPS = [
  { label: 'פתיחה' },
  { label: 'הרשות שלכם' },
  { label: 'שביעות רצון' },
];

const RATING_LABELS: Record<number, string> = {
  1: 'גרוע מאוד',
  2: 'גרוע',
  3: 'סביר',
  4: 'טוב',
  5: 'מצוין',
};

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedMunicipality, setSelectedMunicipality] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/sign-up');
    }
  }, [isLoading, isAuthenticated, router]);

  const filteredMunicipalities = MUNICIPALITIES.filter((m) =>
    m.includes(searchQuery)
  );

  const handleComplete = async () => {
    if (!selectedMunicipality) return;

    setLoading(true);
    try {
      // Save municipality to backend
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          municipality: selectedMunicipality,
          ...(rating !== null ? { municipalityRating: rating } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save profile');
      }

      router.push('/dashboard');
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <PressLoader />
        <p>טוען…</p>
      </div>
    );
  }

  return (
    <div className={styles.field}>
      <div className={styles.desk}>
        <span className={styles.wordmark}>תַּרְאוּ</span>

        <Stepper steps={STEPS} current={step - 1} className={styles.stepper} />

        {step === 1 && (
          <section className={styles.step}>
            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              קליטת חבר · ONBOARDING
            </span>
            <h1 className={styles.title}>
              ברוכים הבאים, <span className={styles.red}>{user?.firstName || 'חבר'}.</span>
            </h1>
            <p className={styles.standfirst}>
              הגדרת הפרופיל אורכת שלושה שלבים קצרים. בסופם אפשר להצביע.
            </p>

            <div className={styles.rule} aria-hidden />

            <ul className={styles.briefs}>
              <li className={styles.brief}>
                <span className={styles.briefNum}>01</span>
                <div>
                  <span className={styles.briefKicker}>הצביעו</span>
                  <p className={styles.briefText}>
                    השפיעו על ההחלטות המקומיות בקהילה שלכם.
                  </p>
                </div>
              </li>
              <li className={styles.brief}>
                <span className={styles.briefNum}>02</span>
                <div>
                  <span className={styles.briefKicker}>מאומת</span>
                  <p className={styles.briefText}>
                    כל הצבעה נשמרת, נחתמת ומאומתת.
                  </p>
                </div>
              </li>
              <li className={styles.brief}>
                <span className={styles.briefNum}>03</span>
                <div>
                  <span className={styles.briefKicker}>שקוף</span>
                  <p className={styles.briefText}>
                    תמונת מצב ברורה לאורך זמן, פתוחה לכולם.
                  </p>
                </div>
              </li>
            </ul>

            <div className={styles.actions}>
              <NewsButton
                variant="red"
                size="lg"
                className={styles.primaryBtn}
                onClick={() => setStep(2)}
                trailing={<span aria-hidden>←</span>}
              >
                לשלב הראשון
              </NewsButton>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className={styles.step}>
            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              בחירת רשות · LOCALE
            </span>
            <h1 className={styles.title}>
              איפה אתם <span className={styles.red}>גרים?</span>
            </h1>
            <p className={styles.standfirst}>
              בחרו את הרשות המקומית שלכם כדי לראות הצבעות רלוונטיות.
            </p>

            <div className={styles.rule} aria-hidden />

            <PressInput
              type="text"
              label="הרשות שלכם"
              placeholder="בחרו עיר / מועצה"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.search}
            />

            <ul className={styles.muniList} role="listbox" aria-label="רשות מקומית">
              {filteredMunicipalities.map((municipality) => {
                const selected = selectedMunicipality === municipality;
                return (
                  <li key={municipality}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`${styles.muniBtn} ${selected ? styles.selected : ''}`}
                      onClick={() => setSelectedMunicipality(municipality)}
                    >
                      <span className={styles.muniMark} aria-hidden>
                        {selected ? '✓' : '○'}
                      </span>
                      <span className={styles.muniName}>{municipality}</span>
                    </button>
                  </li>
                );
              })}
              {filteredMunicipalities.length === 0 && (
                <li className={styles.muniEmpty}>לא נמצאה רשות תואמת.</li>
              )}
            </ul>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.backBtn}
                onClick={() => setStep(1)}
              >
                → חזרה
              </button>
              <NewsButton
                variant="red"
                size="lg"
                className={styles.primaryBtn}
                onClick={() => setStep(3)}
                disabled={!selectedMunicipality}
                trailing={<span aria-hidden>←</span>}
              >
                המשך
              </NewsButton>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className={styles.step}>
            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              שביעות רצון · BASELINE
            </span>
            <h1 className={styles.title}>
              כמה אתם מרוצים <span className={styles.red}>מהרשות שלכם?</span>
            </h1>
            <p className={styles.standfirst}>
              דירוג אחד, מ-1 עד 5. זו נקודת הפתיחה למדידת שביעות הרצון של
              התושבים ב{selectedMunicipality} לאורך זמן.
            </p>

            <div className={styles.rule} aria-hidden />

            <div
              role="radiogroup"
              aria-label="דירוג שביעות רצון מהרשות"
              className="flex flex-row-reverse justify-between gap-2"
              dir="ltr"
            >
              {[1, 2, 3, 4, 5].map((value) => {
                const selected = rating === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${value} · ${RATING_LABELS[value]}`}
                    onClick={() => setRating(value)}
                    className={cn(
                      'flex flex-1 cursor-pointer flex-col items-center gap-2 border-2 border-ink bg-paper-box px-2 py-4 transition-colors',
                      'hover:bg-paper focus-visible:outline-2 focus-visible:outline-red',
                      selected && 'border-red bg-ink text-paper'
                    )}
                  >
                    <span className="font-mono text-3xl font-black leading-none tabular-nums">
                      {value}
                    </span>
                    <span
                      className={cn(
                        'font-mono text-xs tracking-wider',
                        selected ? 'text-paper' : 'text-ink-soft'
                      )}
                    >
                      {RATING_LABELS[value]}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.backBtn}
                onClick={() => setStep(2)}
              >
                → חזרה
              </button>
              <NewsButton
                variant="red"
                size="lg"
                className={styles.primaryBtn}
                onClick={handleComplete}
                disabled={loading}
                trailing={<span aria-hidden>←</span>}
              >
                {loading ? 'שומר…' : rating === null ? 'דילוג וסיום' : 'סיום והתחלה'}
              </NewsButton>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
