'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import styles from './page.module.css';

export default function VerificationPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/sign-in?redirect=/verification');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>טוען...</p>
      </div>
    );
  }

  const verificationStatus = user?.verificationStatus;
  const phase = verificationStatus?.phase || 'not_started';
  const checkInsCompleted = verificationStatus?.checkInsCompleted || 0;
  const checkInsTotal = verificationStatus?.checkInsTotal || 0;

  return (
    <>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <motion.div
            className={styles.header}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1>אימות תושבות</h1>
            <p>
              אמתו את מיקומכם במשך 21 יום כדי להשתתף בהצבעות מקומיות
            </p>
          </motion.div>

          {phase === 'not_started' && (
            <motion.div
              className={styles.card}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className={styles.cardIcon}>📍</div>
              <h2>התחילו את תהליך האימות</h2>
              <p>
                תהליך האימות נמשך 21 יום ודורש 5-7 צ׳ק-אינים במיקום שלכם.
                תקבלו התראות בזמנים אקראיים לביצוע צ׳ק-אין.
              </p>

              <div className={styles.steps}>
                <div className={styles.step}>
                  <span className={styles.stepNumber}>1</span>
                  <div>
                    <strong>התחילו את התהליך</strong>
                    <p>לחצו על הכפתור למטה להתחלה</p>
                  </div>
                </div>
                <div className={styles.step}>
                  <span className={styles.stepNumber}>2</span>
                  <div>
                    <strong>קבלו התראות</strong>
                    <p>תקבלו 5-7 התראות בזמנים אקראיים</p>
                  </div>
                </div>
                <div className={styles.step}>
                  <span className={styles.stepNumber}>3</span>
                  <div>
                    <strong>בצעו צ׳ק-אין</strong>
                    <p>אשרו את המיקום שלכם באפליקציה</p>
                  </div>
                </div>
                <div className={styles.step}>
                  <span className={styles.stepNumber}>4</span>
                  <div>
                    <strong>השלימו את האימות</strong>
                    <p>לאחר 21 יום תוכלו להצביע</p>
                  </div>
                </div>
              </div>

              <Button size="lg" onClick={() => alert('Coming soon - use mobile app')}>
                התחל אימות
              </Button>
              <p className={styles.mobileNote}>
                לחוויה הטובה ביותר, השתמשו באפליקציה במכשיר הנייד
              </p>
            </motion.div>
          )}

          {phase === 'in_progress' && (
            <motion.div
              className={styles.card}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className={styles.cardIcon}>🔄</div>
              <h2>האימות בתהליך</h2>

              <div className={styles.progressSection}>
                <div className={styles.progressHeader}>
                  <span>התקדמות</span>
                  <span>{checkInsCompleted}/{checkInsTotal} צ׳ק-אינים</span>
                </div>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{
                      width: `${checkInsTotal > 0 ? (checkInsCompleted / checkInsTotal) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div className={styles.statusInfo}>
                <div className={styles.statusItem}>
                  <span className={styles.statusLabel}>ימים שנותרו</span>
                  <span className={styles.statusValue}>
                    {verificationStatus?.startedAt
                      ? Math.max(0, 21 - Math.floor((Date.now() - new Date(verificationStatus.startedAt).getTime()) / (1000 * 60 * 60 * 24)))
                      : 21}
                  </span>
                </div>
                <div className={styles.statusItem}>
                  <span className={styles.statusLabel}>צ׳ק-אינים נותרו</span>
                  <span className={styles.statusValue}>
                    {checkInsTotal - checkInsCompleted}
                  </span>
                </div>
              </div>

              <p className={styles.mobileNote}>
                המתינו להתראה הבאה באפליקציה לביצוע צ׳ק-אין
              </p>
            </motion.div>
          )}

          {phase === 'completed' && (
            <motion.div
              className={styles.card}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className={styles.cardIcon}>✅</div>
              <h2>האימות הושלם בהצלחה!</h2>
              <p>
                כל הכבוד! סיימתם את תהליך אימות התושבות ועכשיו תוכלו להצביע
                על נושאים מקומיים בקהילה שלכם.
              </p>
              <Button onClick={() => router.push('/votes')}>
                צפו בהצבעות פעילות
              </Button>
            </motion.div>
          )}

          {phase === 'failed' && (
            <motion.div
              className={styles.card}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className={styles.cardIcon}>❌</div>
              <h2>האימות נכשל</h2>
              <p>
                לצערנו, תהליך האימות לא הושלם בהצלחה. זה יכול לקרות אם
                פספסתם יותר מדי צ׳ק-אינים או אם המיקום שלכם לא היה ברשות
                הנבחרת.
              </p>
              <Button onClick={() => alert('Coming soon')}>
                התחל מחדש
              </Button>
            </motion.div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
