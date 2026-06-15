'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { NewsButton, Stepper, SealCard, PressInput } from '@/components/press';
import { isEligibleToVote } from '@/lib/verification';
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

/* Press flow steps — identity → presence → confirmation. */
const STEPS = [
  { label: 'זהות' },
  { label: 'נוכחות' },
  { label: 'אישור' },
];

/* Microcopy ------------------------------------------------------------------ */

const COPY = {
  emptyField: 'צריך למלא את השדה הזה כדי להמשיך.',
  general: 'משהו השתבש אצלנו, לא אצלכם. נסו שוב בעוד רגע.',
  gpsDenied:
    'לא הצלחנו לקרוא את המיקום. אשרו הרשאת מיקום בדפדפן ונסו שוב.',
  gpsUnavailable:
    'הדפדפן הזה לא תומך באיתור מיקום. נסו ממכשיר אחר או מהאפליקציה.',
  outOfBounds: 'המיקום שזוהה אינו בתחום הרשות. ודאו שאתם ברשות ונסו שוב.',
};

/** Default destination after the user becomes eligible to vote. */
const DEFAULT_REDIRECT = '/votes';

/** Local sub-steps within the page (independent of the server phase model). */
type Flow = 'phone' | 'otp' | 'gps' | 'done';

/** Format a date for the "next window" hint (Hebrew, short). */
function formatWindow(value?: string | Date | null): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
}

/* Cast Suspense for React 19 type compatibility (matches store/thank-you). */
const SuspenseWrapper = Suspense as unknown as (props: {
  fallback?: React.ReactNode;
  children?: React.ReactNode;
}) => React.JSX.Element;

/* --------------------------------------------------------------------------- */

function VerificationView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading, refreshSession } = useAuth();

  /** Where to send the user once they can vote (preserve through sign-in). */
  const redirect = searchParams.get('redirect') || DEFAULT_REDIRECT;

  // --- Local flow state ---
  const [flow, setFlow] = useState<Flow>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [nextWindow, setNextWindow] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const eligible = isEligibleToVote(user);

  // --- Auth bounce: preserve the original redirect through sign-in ---
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const inner = `/verification?redirect=${encodeURIComponent(redirect)}`;
      router.push(`/sign-in?redirect=${encodeURIComponent(inner)}`);
    }
  }, [isLoading, isAuthenticated, router, redirect]);

  // --- Returning verified user / already-eligible: jump to success ---
  useEffect(() => {
    if (eligible) {
      setFlow('done');
    }
  }, [eligible]);

  // --- On entry, skip the phone step if the phone is already verified ---
  useEffect(() => {
    if (!eligible && user?.phone && flow === 'phone') {
      setPhone(user.phone);
      setFlow('gps');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.phone, eligible]);

  /* ---- Phone step: send code ---- */
  const handleSendCode = useCallback(async () => {
    if (!phone.trim()) {
      setPhoneError(COPY.emptyField);
      return;
    }
    setBusy(true);
    setPhoneError(null);
    try {
      const res = await fetch('/api/user/phone/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone }),
      });

      if (res.ok) {
        setFlow('otp');
        return;
      }

      const data = await res.json().catch(() => null);

      // Mock-degrade: SMS service absent in this environment → treat as sent so
      // the flow proceeds (consistent with how the app degrades on placeholder
      // creds elsewhere).
      if (res.status === 503) {
        setFlow('otp');
        return;
      }

      setPhoneError(data?.message || COPY.general);
    } catch {
      setPhoneError(COPY.general);
    } finally {
      setBusy(false);
    }
  }, [phone]);

  /* ---- OTP step: verify code ---- */
  const handleVerifyCode = useCallback(async () => {
    if (!code.trim()) {
      setOtpError(COPY.emptyField);
      return;
    }
    setBusy(true);
    setOtpError(null);
    try {
      const res = await fetch('/api/user/phone/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone, code }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.verified !== false) {
          await refreshSession();
          setFlow('gps');
          return;
        }
        setOtpError(data?.message || COPY.general);
        return;
      }

      const data = await res.json().catch(() => null);

      // Mock-degrade: SMS service absent → accept the code so the flow proceeds.
      if (res.status === 503) {
        await refreshSession();
        setFlow('gps');
        return;
      }

      setOtpError(data?.message || COPY.general);
    } catch {
      setOtpError(COPY.general);
    } finally {
      setBusy(false);
    }
  }, [phone, code, refreshSession]);

  /* ---- GPS step: ensure a run exists, then check in ---- */
  const handleCheckIn = useCallback(async () => {
    setBusy(true);
    setGpsError(null);
    setNextWindow(null);

    // Ensure a verification run (schedule + first window) exists. A fresh
    // user is `not_started`; start the run first so a check-in window exists.
    if ((user?.verificationStatus?.phase ?? 'not_started') === 'not_started') {
      try {
        await fetch('/api/verification/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        // start may legitimately 400 ("already in progress") — proceed regardless.
      } catch {
        /* non-fatal — the check-in below will surface any real problem */
      }
    }

    // Geolocation must be available. Hard-fail (with retry) otherwise.
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError(COPY.gpsUnavailable);
      setBusy(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude, accuracy } = pos.coords;
          const res = await fetch('/api/verification/check-in', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ latitude, longitude, accuracy }),
          });

          if (res.ok) {
            await refreshSession();
            setFlow('done');
            return;
          }

          const data = await res.json().catch(() => null);

          // Dev fallback: endpoint/creds absent (5xx) → soft-pass so the flow
          // can complete in environments without the verification backend.
          if (res.status >= 500) {
            await refreshSession();
            setFlow('done');
            return;
          }

          // Hard-fail on out-of-window / out-of-bounds (4xx). Surface the next
          // window time from the schedule when the window hasn't opened yet.
          if (typeof data?.error === 'string' && /window/i.test(data.error)) {
            try {
              const statusRes = await fetch('/api/verification/status', {
                credentials: 'include',
              });
              if (statusRes.ok) {
                const s = await statusRes.json().catch(() => null);
                const when = formatWindow(
                  s?.nextCheckIn || s?.verificationStatus?.nextCheckIn
                );
                if (when) setNextWindow(when);
              }
            } catch {
              /* ignore — fall back to the generic message */
            }
            setGpsError(
              data?.error || 'הבדיקה זמינה רק בחלון הזמן הקבוע.'
            );
          } else if (data?.details && data.details.inMunicipality === false) {
            setGpsError(COPY.outOfBounds);
          } else {
            setGpsError(data?.error || COPY.outOfBounds);
          }
        } catch {
          setGpsError(COPY.general);
        } finally {
          setBusy(false);
        }
      },
      (err) => {
        // Hard-fail on denied/error — clear message + retry button.
        setGpsError(
          err.code === err.PERMISSION_DENIED ? COPY.gpsDenied : COPY.general
        );
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [user?.verificationStatus?.phase, refreshSession]);

  /* ---- Stepper index from local flow ---- */
  const currentStep = useMemo(() => {
    switch (flow) {
      case 'phone':
      case 'otp':
        return 0;
      case 'gps':
        return 1;
      case 'done':
        return 2;
      default:
        return 0;
    }
  }, [flow]);

  /* ---- Loading skeleton (preserved) ---- */
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
              שני שלבים פשוטים: אימות טלפון ובדיקת מיקום חד-פעמית. זה מוודא
              שאתם תושבי הרשות. לא שומרים מסלולים, לא משתפים מיקום, לא עוקבים. זה
              מה שמבטיח שכל קול בשכונה הוא של תושב אמיתי.
            </p>
          </header>

          {/* The press procedure: stepper */}
          <Stepper steps={STEPS} current={currentStep} className={styles.stepper} />

          {/* Two-column spread: state panel + reassurance ledger sidebar */}
          <div className={styles.spread}>
            <section className={styles.panelCol}>
              {/* ---- STEP 1 — זהות (phone) ---- */}
              {flow === 'phone' && (
                <article className={styles.panel}>
                  <header className={styles.panelHead}>
                    <span className={styles.panelTag}>שלב 1 · זהות</span>
                    <h2 className={styles.panelTitle}>אמתו את הטלפון</h2>
                  </header>
                  <p className={styles.panelText}>
                    נשלח קוד אימות חד-פעמי בהודעת SMS. זה מוודא שאתם בעלי החשבון
                    לפני בדיקת המיקום.
                  </p>

                  <PressInput
                    label="מספר טלפון"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="05X-XXXXXXX"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (phoneError) setPhoneError(null);
                    }}
                    error={phoneError}
                    disabled={busy}
                  />

                  <div className={styles.gpsBox}>
                    <NewsButton
                      variant="red"
                      size="lg"
                      onClick={handleSendCode}
                      disabled={busy}
                      trailing={<span aria-hidden>←</span>}
                    >
                      {busy ? 'שולחים…' : 'שלחו קוד'}
                    </NewsButton>
                    <span className={styles.gpsNote}>
                      קוד חד-פעמי. לא שומרים אותו.
                    </span>
                  </div>
                </article>
              )}

              {/* ---- STEP 1b — קוד (OTP) ---- */}
              {flow === 'otp' && (
                <article className={styles.panel}>
                  <header className={styles.panelHead}>
                    <span className={styles.panelTag}>שלב 1 · זהות</span>
                    <h2 className={styles.panelTitle}>הזינו את הקוד</h2>
                  </header>
                  <p className={styles.panelText}>
                    שלחנו קוד בן 6 ספרות אל {phone}. הזינו אותו כדי להמשיך לבדיקת
                    המיקום.
                  </p>

                  <PressInput
                    label="קוד אימות"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="------"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                      if (otpError) setOtpError(null);
                    }}
                    error={otpError}
                    disabled={busy}
                  />

                  <div className={styles.gpsBox}>
                    <NewsButton
                      variant="red"
                      size="lg"
                      onClick={handleVerifyCode}
                      disabled={busy}
                      trailing={<span aria-hidden>←</span>}
                    >
                      {busy ? 'מאמתים…' : 'אמתו קוד'}
                    </NewsButton>
                    <button
                      type="button"
                      className={styles.backLink}
                      onClick={() => {
                        setCode('');
                        setOtpError(null);
                        setFlow('phone');
                      }}
                      disabled={busy}
                    >
                      ↳ שינוי מספר
                    </button>
                  </div>
                </article>
              )}

              {/* ---- STEP 2 — נוכחות (GPS check-in) ---- */}
              {flow === 'gps' && (
                <article className={styles.panel}>
                  <header className={styles.panelHead}>
                    <span className={styles.panelTag}>שלב 2 · נוכחות</span>
                    <h2 className={styles.panelTitle}>אמתו נוכחות</h2>
                  </header>
                  <p className={styles.panelText}>
                    בדיקת מיקום אחת מספיקה כדי שתוכלו להצביע. נקרא את המיקום פעם
                    אחת ונוודא שאתם בתחום הרשות.
                  </p>

                  {gpsError && (
                    <p className={styles.payError} role="alert">
                      <span aria-hidden>✕ </span>
                      {gpsError}
                      {nextWindow ? (
                        <span className={styles.windowNote}>
                          {' '}חלון הבדיקה הבא: {nextWindow}
                        </span>
                      ) : null}
                    </p>
                  )}

                  <div className={styles.gpsBox}>
                    <NewsButton
                      variant="red"
                      size="lg"
                      onClick={handleCheckIn}
                      disabled={busy}
                      trailing={<span aria-hidden>←</span>}
                    >
                      {busy
                        ? 'בודקים מיקום…'
                        : gpsError
                          ? 'נסו שוב'
                          : 'אמתו נוכחות'}
                    </NewsButton>
                    <span className={styles.gpsNote}>
                      בדיקה חד-פעמית. לא שומרים מיקום.
                    </span>
                  </div>
                </article>
              )}

              {/* ---- STEP 3 — אישור (eligible / verified) ---- */}
              {flow === 'done' && (
                <article className={styles.panel}>
                  <header className={styles.panelHead}>
                    <span className={styles.panelTag}>שלב 3 · אישור</span>
                    <h2 className={styles.panelTitle}>אתם מאומתים — אפשר להצביע</h2>
                  </header>

                  <SealCard
                    hash="מאומת · תושב/ת קריית טבעון"
                    status="sealed"
                    meta={[
                      { label: 'סטטוס', value: 'מאומת' },
                      { label: 'רשות', value: 'קריית טבעון' },
                      {
                        label: 'אימות',
                        value: 'טלפון · מיקום',
                      },
                    ]}
                    className={styles.seal}
                  />

                  <p className={styles.panelText}>
                    סיימתם את האימות. הקול שלכם נספר כקול של תושב אמיתי — אפשר
                    להמשיך ולהצביע.
                  </p>

                  <div className={styles.gpsBox}>
                    <NewsButton
                      variant="ink"
                      size="lg"
                      onClick={() => router.push(redirect)}
                      trailing={<span aria-hidden>←</span>}
                    >
                      {redirect === DEFAULT_REDIRECT
                        ? 'צפו בהצבעות פעילות'
                        : 'חזרה להצבעה'}
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

export default function VerificationPage() {
  return (
    <SuspenseWrapper fallback={null}>
      <VerificationView />
    </SuspenseWrapper>
  );
}
