'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import styles from './page.module.css';

const MUNICIPALITIES = [
  'תל אביב-יפו',
  'ירושלים',
  'חיפה',
  'ראשון לציון',
  'פתח תקווה',
  'אשדוד',
  'נתניה',
  'באר שבע',
  'בני ברק',
  'חולון',
  'רמת גן',
  'אשקלון',
  'רחובות',
  'בת ים',
  'הרצליה',
  'כפר סבא',
  'מודיעין-מכבים-רעות',
  'רעננה',
  'לוד',
  'רמלה',
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedMunicipality, setSelectedMunicipality] = useState<string | null>(null);
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
        body: JSON.stringify({ municipality: selectedMunicipality }),
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
        <div className={styles.spinner} />
        <p>טוען...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Progress */}
        <div className={styles.progress}>
          <div className={styles.progressBar}>
            <motion.div
              className={styles.progressFill}
              initial={{ width: 0 }}
              animate={{ width: `${(step / 2) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <span className={styles.progressText}>שלב {step} מתוך 2</span>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              className={styles.step}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
            >
              <div className={styles.stepIcon}>👋</div>
              <h1>ברוכים הבאים לתַּרְאוּ!</h1>
              <p>
                שלום {user?.firstName || 'שם'},<br />
                אנחנו שמחים שהצטרפתם. בואו נגדיר את הפרופיל שלכם כדי שתוכלו להתחיל להצביע.
              </p>

              <div className={styles.features}>
                <div className={styles.feature}>
                  <span className={styles.featureIcon}>🗳️</span>
                  <div>
                    <strong>הצביעו על נושאים מקומיים</strong>
                    <p>השפיעו על ההחלטות בקהילה שלכם</p>
                  </div>
                </div>
                <div className={styles.feature}>
                  <span className={styles.featureIcon}>🔒</span>
                  <div>
                    <strong>הצבעות מאובטחות</strong>
                    <p>כל הצבעה נשמרת ומאומתת</p>
                  </div>
                </div>
                <div className={styles.feature}>
                  <span className={styles.featureIcon}>📊</span>
                  <div>
                    <strong>עקבו אחרי התוצאות</strong>
                    <p>תמונה ברורה לאורך זמן</p>
                  </div>
                </div>
              </div>

              <Button onClick={() => setStep(2)} size="large">
                בואו נתחיל
              </Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              className={styles.step}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
            >
              <div className={styles.stepIcon}>📍</div>
              <h1>באיזו רשות אתם גרים?</h1>
              <p>בחרו את הרשות המקומית שלכם כדי לראות הצבעות רלוונטיות</p>

              <div className={styles.searchContainer}>
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="חיפוש רשות..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className={styles.municipalityGrid}>
                {filteredMunicipalities.map((municipality) => (
                  <button
                    key={municipality}
                    className={`${styles.municipalityButton} ${
                      selectedMunicipality === municipality ? styles.selected : ''
                    }`}
                    onClick={() => setSelectedMunicipality(municipality)}
                  >
                    {municipality}
                    {selectedMunicipality === municipality && (
                      <span className={styles.checkmark}>✓</span>
                    )}
                  </button>
                ))}
              </div>

              <div className={styles.stepActions}>
                <button className={styles.backButton} onClick={() => setStep(1)}>
                  חזרה
                </button>
                <Button
                  onClick={handleComplete}
                  disabled={!selectedMunicipality || loading}
                  size="large"
                >
                  {loading ? 'שומר...' : 'סיום והתחלה'}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
