'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { NewsButton, Stepper, SealCard } from '@/components/press';
import styles from './page.module.css';

/* ------------------------------ reassurance data --------------------------- */

const LEDGER_ITEMS = [
  { mark: '✕', tone: 'red' as const, text: 'לא שומרים מיקום' },
  { mark: '✕', tone: 'red' as const, text: 'לא משתפים מיקום עם אף גורם' },
  { mark: '✕', tone: 'red' as const, text: 'לא עוקבים אחריכם בין הצבעה להצבעה' },
  { mark: '✓', tone: 'ink' as const, text: 'בדיקה חד-פעמית ברגע ההצבעה בלבד' },
  { mark: '✓', tone: 'ink' as const, text: 'מוודאים רק שאתם בתחום הרשות' },
  { mark: '✓', tone: 'ink' as const, text: 'כל קול בשכונה הוא של תושב אמיתי' },
];

/* Press flow steps — maps to the existing verification phases. */
const STEPS = [
  { label: 'זהות' },
  { label: 'נוכחות' },
  { label: 'אישור' },
];

/** Map the existing phase model onto the 3-step press flow index. */
function phaseToStep(phase: string): number {
  switch (phase) {
    case 'not_started':
      return 0;
    case 'in_progress':
      return 1;
    case 'completed':
      return 2;
    case 'failed':
      return 1;
    default:
      return 0;
  }
}

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
      <div className="np-page">
        <Header />
        <main className={styles.main}>
          <div className={styles.container} aria-busy="true" aria-label="טוען">
            <div className={styles.skeletonContainer}>
              <div className={styles.skeletonHeader}>
                <div className={`${styles.skelLine} ${styles.skelKicker}`} />
                <div className={`${styles.skelLine} ${styles.skelTitle}`} />
                <div className={`${styles.skelLine} ${styles.skelLead}`} />
                <div className={`${styles.skelLine} ${styles.skelLeadShort}`} />
              </div>
              <div className={styles.skelStepper} />
              <div className={styles.skeletonGrid}>
                <div className={styles.skelPanel} />
                <div className={styles.skelLedger} />
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const verificationStatus = user?.verificationStatus;
  const phase = verificationStatus?.phase || 'not_started';
  const checkInsCompleted = verificationStatus?.checkInsCompleted || 0;
  const checkInsTotal = verificationStatus?.checkInsTotal || 0;
  const currentStep = phaseToStep(phase);

  const daysRemaining = verificationStatus?.startedAt
    ? Math.max(
        0,
        21 -
          Math.floor(
            (Date.now() - new Date(verificationStatus.startedAt).getTime()) /
              (1000 * 60 * 60 * 24)
          )
      )
    : 21;

  const progressPct = checkInsTotal > 0 ? (checkInsCompleted / checkInsTotal) * 100 : 0;

  return (
    <div className="np-page">
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          {/* Dateline + masthead-ear meta */}
          <div className={styles.dateline}>
            <span className={styles.datelineTick} aria-hidden />
            <span>אימות תושב · VERIFICATION</span>
            <span className={styles.datelineSep} aria-hidden>■</span>
            <span>פרוצדורה חד-פעמית</span>
          </div>

          <div className="np-rule-heavy" aria-hidden />

          {/* Lead: reassurance-first headline + standfirst */}
          <header className={styles.lead}>
            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              שקיפות · פרטיות · אמון
            </span>
            <h1 className={styles.heading}>
              מאמתים שאתם מכאן —{' '}
              <span className={styles.headingAccent}>לא עוקבים אחריכם.</span>
            </h1>
            <p className={styles.lead_p}>
              בדיקת מיקום חד-פעמית ברגע ההצבעה מוודאת שאתם תושבי הרשות. לא שומרים
              מסלולים, לא משתפים מיקום, לא עוקבים. זה מה שמבטיח שכל קול בשכונה הוא
              של תושב אמיתי.
            </p>
          </header>

          {/* The press procedure: stepper */}
          <Stepper steps={STEPS} current={currentStep} className={styles.stepper} />

          {/* Two-column spread: state panel + reassurance ledger sidebar */}
          <div className={styles.spread}>
            <section className={styles.panelCol}>
              {phase === 'not_started' && (
                <article className={styles.panel}>
                  <header className={styles.panelHead}>
                    <span className={styles.panelTag}>שלב 1 · זהות</span>
                    <h2 className={styles.panelTitle}>פתחו את פרוצדורת האימות</h2>
                  </header>
                  <p className={styles.panelText}>
                    תהליך האימות נמשך 21 יום ודורש 5-7 צ׳ק-אינים במיקום שלכם.
                    תקבלו התראות בזמנים אקראיים לביצוע צ׳ק-אין.
                  </p>

                  <ol className={styles.steps}>
                    {[
                      { n: 1, title: 'פתחו את התהליך', note: 'לחצו על הכפתור למטה להתחלה' },
                      { n: 2, title: 'קבלו התראות', note: 'תקבלו 5-7 התראות בזמנים אקראיים' },
                      { n: 3, title: 'בצעו צ׳ק-אין', note: 'אשרו את המיקום שלכם באפליקציה' },
                      { n: 4, title: 'השלימו את האימות', note: 'לאחר 21 יום תוכלו להצביע' },
                    ].map((step) => (
                      <li key={step.n} className={styles.step}>
                        <span className={styles.stepNumber}>{String(step.n).padStart(2, '0')}</span>
                        <span className={styles.stepBody}>
                          <span className={styles.stepTitle}>{step.title}</span>
                          <span className={styles.stepNote}>{step.note}</span>
                        </span>
                      </li>
                    ))}
                  </ol>

                  <div className={styles.gpsBox}>
                    <NewsButton
                      variant="red"
                      size="lg"
                      onClick={() => alert('Coming soon - use mobile app')}
                      trailing={<span aria-hidden>←</span>}
                    >
                      אמתו נוכחות
                    </NewsButton>
                    <span className={styles.gpsNote}>
                      בדיקה חד-פעמית. לא שומרים מיקום.
                    </span>
                  </div>

                  <p className={styles.mobileNote}>
                    <span aria-hidden className={styles.mobileGlyph}>▍</span>
                    לחוויה הטובה ביותר, השתמשו באפליקציה במכשיר הנייד
                  </p>
                </article>
              )}

              {phase === 'in_progress' && (
                <article className={styles.panel}>
                  <header className={styles.panelHead}>
                    <span className={styles.panelTag}>שלב 2 · נוכחות</span>
                    <h2 className={styles.panelTitle}>האימות בתהליך</h2>
                  </header>

                  <div className={styles.progress}>
                    <div className={styles.progressHeader}>
                      <span>התקדמות</span>
                      <span>
                        {checkInsCompleted}/{checkInsTotal} צ׳ק-אינים
                      </span>
                    </div>
                    <div
                      className={styles.progressBar}
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={checkInsTotal}
                      aria-valuenow={checkInsCompleted}
                    >
                      <div
                        className={styles.progressFill}
                        style={{ inlineSize: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  <div className={styles.statusInfo}>
                    <div className={styles.statusItem}>
                      <span className={styles.statusLabel}>ימים שנותרו</span>
                      <span className={styles.statusValue}>{daysRemaining}</span>
                    </div>
                    <div className={styles.statusItem}>
                      <span className={styles.statusLabel}>צ׳ק-אינים נותרו</span>
                      <span className={styles.statusValue}>
                        {checkInsTotal - checkInsCompleted}
                      </span>
                    </div>
                  </div>

                  <p className={styles.mobileNote}>
                    <span aria-hidden className={styles.mobileGlyph}>▍</span>
                    המתינו להתראה הבאה באפליקציה לביצוע צ׳ק-אין
                  </p>
                </article>
              )}

              {phase === 'completed' && (
                <article className={styles.panel}>
                  <header className={styles.panelHead}>
                    <span className={styles.panelTag}>שלב 3 · אישור</span>
                    <h2 className={styles.panelTitle}>האימות הושלם בהצלחה</h2>
                  </header>

                  <SealCard
                    hash="מאומת · תושב/ת קריית טבעון"
                    status="sealed"
                    meta={[
                      { label: 'סטטוס', value: 'מאומת' },
                      { label: 'רשות', value: 'קריית טבעון' },
                      { label: 'צ׳ק-אינים', value: `${checkInsCompleted}/${checkInsTotal || checkInsCompleted}` },
                    ]}
                    className={styles.seal}
                  />

                  <p className={styles.panelText}>
                    כל הכבוד! סיימתם את תהליך אימות התושבות ועכשיו תוכלו להצביע
                    על נושאים מקומיים בקהילה שלכם.
                  </p>

                  <div className={styles.gpsBox}>
                    <NewsButton
                      variant="ink"
                      size="lg"
                      onClick={() => router.push('/votes')}
                      trailing={<span aria-hidden>←</span>}
                    >
                      צפו בהצבעות פעילות
                    </NewsButton>
                  </div>
                </article>
              )}

              {phase === 'failed' && (
                <article className={styles.panel}>
                  <header className={styles.panelHead}>
                    <span className={`${styles.panelTag} ${styles.panelTagFail}`}>
                      ✕ לא הושלם
                    </span>
                    <h2 className={styles.panelTitle}>האימות נכשל</h2>
                  </header>
                  <p className={styles.panelText}>
                    משהו השתבש אצלנו, לא אצלכם. זה יכול לקרות אם פספסתם יותר מדי
                    צ׳ק-אינים או אם המיקום שלכם לא היה ברשות הנבחרת. נסו שוב בעוד
                    רגע.
                  </p>
                  <div className={styles.gpsBox}>
                    <NewsButton
                      variant="red"
                      size="lg"
                      onClick={() => alert('Coming soon')}
                      trailing={<span aria-hidden>←</span>}
                    >
                      התחילו מחדש
                    </NewsButton>
                  </div>
                </article>
              )}
            </section>

            {/* Reassurance ledger — "מה אנחנו לא עושים" */}
            <aside className={styles.ledgerCol}>
              <div className={styles.ledger}>
                <h2 className={styles.ledgerTitle}>מה אנחנו לא עושים</h2>
                <ul className={styles.ledgerList}>
                  {LEDGER_ITEMS.map((item) => (
                    <li
                      key={item.text}
                      className={`${styles.ledgerItem} ${
                        item.tone === 'red' ? styles.ledgerItemRed : styles.ledgerItemInk
                      }`}
                    >
                      <span className={styles.ledgerMark} aria-hidden>
                        {item.mark}
                      </span>
                      <span className={styles.ledgerText}>{item.text}</span>
                    </li>
                  ))}
                </ul>
                <p className={styles.ledgerFoot}>
                  <span aria-hidden className={styles.mobileGlyph}>▍</span>
                  פרטיות לפי תכן · חתום בבלוקצ׳יין
                </p>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
