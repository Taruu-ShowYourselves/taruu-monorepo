'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import {
  NewsButton,
  PressInput,
  Segmented,
  Stepper,
  Receipt,
} from '@/components/press';
import { useAuth } from '@/providers/AuthProvider';
import { startVoteCreationCheckout } from '@/services/payments/createVoteCheckout';
import { paymentsEnabled } from '@/lib/payments-flag';
import { CREATE_VOTE_COST, formatCurrency } from '@sync/shared';
import styles from './page.module.css';

// ---------------------------------------------------------------------------
// Microcopy (locked press system)
// ---------------------------------------------------------------------------
const MSG_REQUIRED = 'צריך למלא את השדה הזה כדי להמשיך.';
const MSG_GENERAL = 'משהו השתבש אצלנו, לא אצלכם. נסו שוב בעוד רגע.';

// Press wizard is 4 editorial steps; the underlying validation stays 3-staged
// (details → options → payment) - duration lives on the payment plate.
const STEP_LABELS = [
  { label: 'נושא' },
  { label: 'אפשרויות' },
  { label: 'משך' },
  { label: 'תשלום' },
];

const DURATIONS = [
  { value: '3', label: '3 ימים' },
  { value: '7', label: '7 ימים' },
  { value: '14', label: '14 יום' },
  { value: '30', label: '30 יום' },
];

const STEP_COUNT = STEP_LABELS.length;

/**
 * Vote creation is the ₪50 paid action, so it is closed while payments are off.
 * Read once at module scope: NEXT_PUBLIC_PAYMENTS_ENABLED is inlined at build
 * time, so it cannot change under a running client.
 *
 * Participation is FREE and entirely unaffected - residents keep voting.
 */
const PAYMENTS_OPEN = paymentsEnabled();

/** Coming-soon copy. States a condition, never a date, and asks for nothing. */
const SOON_KICKER = 'בקרוב · COMING SOON';
const SOON_LEAD = 'אנחנו משלימים את הסדרת התשלומים מול ספק הסליקה. עד שזה יושלם אי אפשר לפתוח הצבעה חדשה.';
const SOON_FREE_NOTE = 'ההשתתפות בהצבעות פתוחה וחינמית: אפשר להצביע כבר עכשיו בכל הצבעה פעילה בעיר שלכם.';
const SOON_NO_CHARGE = 'לא נגבה מכם דבר, ולא נפתח לכם תשלום, עד שהיצירה תיפתח כאן במלואה.';

export default function CreateVotePage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { isAuthenticated, isLoading, user } = useAuth();

  // 1-based step index preserved (1..4)
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Per-field validation errors (press inputs render their own ✕ rule)
  const [titleError, setTitleError] = useState('');
  const [descriptionError, setDescriptionError] = useState('');
  const [optionsError, setOptionsError] = useState('');

  // There is no in-page success surface. A vote exists only after Green Invoice
  // settles the fee and the return page finalises it against the server.

  // Form state - unchanged
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [duration, setDuration] = useState(7); // days

  const filledOptions = options.filter((o) => o.trim());

  const addOption = () => {
    if (options.length < 5) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
    if (optionsError) setOptionsError('');
  };

  const validateStep1 = () => {
    let ok = true;
    if (!title.trim()) {
      setTitleError(MSG_REQUIRED);
      ok = false;
    } else if (title.length < 10) {
      setTitleError('הכותרת חייבת להכיל לפחות 10 תווים.');
      ok = false;
    } else {
      setTitleError('');
    }

    if (!description.trim()) {
      setDescriptionError(MSG_REQUIRED);
      ok = false;
    } else if (description.length < 30) {
      setDescriptionError('התיאור חייב להכיל לפחות 30 תווים.');
      ok = false;
    } else {
      setDescriptionError('');
    }

    return ok;
  };

  const validateStep2 = () => {
    if (filledOptions.length < 2) {
      setOptionsError('צריך לפחות 2 אפשרויות כדי להמשיך.');
      return false;
    }
    setOptionsError('');
    return true;
  };

  const handleNext = () => {
    setError('');
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    } else if (step === 3) {
      // Duration always has a value - straight through to payment.
      setStep(4);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setError('');
    }
  };

  const handleSubmit = async () => {
    // Belt and braces. The wizard is not rendered at all while payments are off
    // (see the coming-soon return below), and /api/payments/create answers 503
    // regardless - but no code path may hand a resident a checkout we cannot
    // honour.
    if (!PAYMENTS_OPEN) return;

    if (!isAuthenticated) {
      router.push('/sign-in?redirect=/votes/create');
      return;
    }

    // Only a fully verified resident may raise a vote for their municipality.
    if (user?.verificationStatus?.phase !== 'completed') {
      router.push('/verification?redirect=/votes/create');
      return;
    }

    setSubmitting(true);
    setError('');

    // The only success path is a real Green Invoice checkout. A response that
    // issues no hosted-form URL leaves the resident on the form with their
    // draft intact and an honest error - it never renders a receipt, because
    // nothing was charged and no vote was created.
    const result = await startVoteCreationCheckout(
      { fetch: globalThis.fetch.bind(globalThis) },
      { voteTitle: title },
    );

    if (result.kind === 'error') {
      setError(result.message);
      setSubmitting(false);
      return;
    }

    // Persist the pending vote for post-payment finalisation - same key and
    // same shape the return page reads.
    const pendingVote = {
      title,
      description,
      options: filledOptions,
      duration,
      paymentId: result.payment.id,
      orderId: result.payment.orderId,
    };

    sessionStorage.setItem('pendingVote', JSON.stringify(pendingVote));
    window.location.href = result.payment.paymentUrl;
  };

  // ----- Payments closed: coming-soon plate ------------------------------
  // Returned BEFORE the auth skeleton on purpose - this state does not depend on
  // who is reading, and a resident should never watch a spinner resolve into a
  // form they cannot submit. No wizard, no price, no checkout, no signup.
  if (!PAYMENTS_OPEN) {
    return (
      <>
        <Header />
        <main className={styles.main}>
          <div className={styles.container}>
            <header className={styles.head}>
              <span className={styles.kicker}>
                <span aria-hidden className={styles.kickerTick} />
                טור הקוראים · יצירת הצבעה
              </span>
              <h1 className={styles.headline}>
                יצירת הצבעה <span className={styles.red}>עוד לא נפתחה.</span>
              </h1>
              <p className={styles.standfirst}>{SOON_LEAD}</p>
            </header>

            <div className={styles.plate}>
              <div className={styles.plateBody}>
                <span className={styles.plateKicker}>{SOON_KICKER}</span>
                <p className={styles.plateNote}>{SOON_FREE_NOTE}</p>
                <p className={styles.plateNote}>{SOON_NO_CHARGE}</p>
              </div>
            </div>

            <div className={styles.actionBar}>
              <NewsButton
                href="/votes"
                variant="red"
                size="lg"
                className={styles.primaryAction}
                trailing={<span aria-hidden>←</span>}
              >
                להצבעות הפעילות
              </NewsButton>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  // ----- Loading skeleton (press furniture) ------------------------------
  if (isLoading) {
    return (
      <>
        <Header />
        <main className={styles.main}>
          <div className={styles.container}>
            <span className={`${styles.shimmer} ${styles.skHead}`} />
            <span className={`${styles.shimmer} ${styles.skBar}`} />
            <span className={`${styles.shimmer} ${styles.skCard}`} />
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const stepTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.16, ease: [0.2, 0, 0, 1] as const };

  const primaryLabel = submitting
    ? 'מעבד תשלום…'
    : step < STEP_COUNT
      ? 'המשך'
      : `צרו הצבעה · ${formatCurrency(CREATE_VOTE_COST)}`;

  return (
    <>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          {/* Masthead-style header */}
          <header className={styles.head}>
            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              טור הקוראים · יצירת הצבעה
            </span>
            <h1 className={styles.headline}>
              כתבו את הכותרת <span className={styles.red}>של המחר.</span>
            </h1>
            <p className={styles.standfirst}>
              הציעו נושא, נסחו את האפשרויות, וקבעו את משך ההצבעה. ההצעה תיחתם
              בבלוקצ׳יין ותעלה לקלפי הקהילתית.
            </p>
          </header>

          {/* Press stepper */}
          <Stepper steps={STEP_LABELS} current={step - 1} className={styles.stepper} />

          {/* Step body */}
          <motion.div
            className={styles.plate}
            key={step}
            initial={reduceMotion ? false : { opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={stepTransition}
          >
            {step === 1 && (
              <div className={styles.plateBody}>
                <span className={styles.plateKicker}>FIG. 1 · הצעת נושא</span>
                <PressInput
                  label="כותרת ההצבעה"
                  placeholder="למשל: הקמת גן שעשועים חדש"
                  value={title}
                  maxLength={100}
                  error={titleError || null}
                  hint={`${title.length}/100`}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (titleError) setTitleError('');
                  }}
                />
                <PressInput
                  multiline
                  label="תיאור"
                  placeholder="תארו את הנושא בפירוט…"
                  value={description}
                  maxLength={500}
                  rows={5}
                  error={descriptionError || null}
                  hint={`${description.length}/500`}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (descriptionError) setDescriptionError('');
                  }}
                />
              </div>
            )}

            {step === 2 && (
              <div className={styles.plateBody}>
                <span className={styles.plateKicker}>FIG. 2 · אפשרויות</span>
                <p className={styles.plateNote}>
                  הוסיפו 2–5 אפשרויות שהמצביעים יבחרו ביניהן.
                </p>

                <div className={styles.optionsList}>
                  {options.map((option, index) => (
                    <div key={index} className={styles.optionRow}>
                      <span className={styles.optionNum} aria-hidden>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <PressInput
                        className={styles.optionInput}
                        placeholder={`אפשרות ${index + 1}`}
                        value={option}
                        maxLength={100}
                        aria-label={`אפשרות ${index + 1}`}
                        onChange={(e) => updateOption(index, e.target.value)}
                      />
                      {options.length > 2 && (
                        <button
                          className={styles.removeButton}
                          onClick={() => removeOption(index)}
                          type="button"
                          aria-label={`הסרת אפשרות ${index + 1}`}
                        >
                          <span aria-hidden>✕</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {optionsError && (
                  <p className={styles.error} role="alert">
                    <span aria-hidden>✕ </span>
                    {optionsError}
                  </p>
                )}

                {options.length < 5 && (
                  <button className={styles.addButton} onClick={addOption} type="button">
                    <span aria-hidden>＋</span> הוספת אפשרות
                  </button>
                )}
              </div>
            )}

            {step === 3 && (
              <div className={styles.plateBody}>
                <span className={styles.plateKicker}>FIG. 3 · משך ההצבעה</span>
                <p className={styles.plateNote}>
                  כמה זמן הקלפי תישאר פתוחה?
                </p>
                <Segmented
                  aria-label="משך ההצבעה"
                  variant="red"
                  segments={DURATIONS}
                  value={String(duration)}
                  onChange={(v) => setDuration(Number(v))}
                  className={styles.durationSeg}
                />

                <div className={styles.preview}>
                  <span className={styles.previewK}>תצוגה מקדימה</span>
                  <h2 className={styles.previewTitle}>{title || 'כותרת ההצבעה'}</h2>
                  <ul className={styles.previewList}>
                    {(filledOptions.length ? filledOptions : ['אפשרות 1', 'אפשרות 2']).map(
                      (o, i) => (
                        <li key={i} className={styles.previewItem}>
                          <span className={styles.previewBullet} aria-hidden>■</span>
                          {o}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className={styles.plateBody}>
                <span className={styles.plateKicker}>FIG. 4 · תשלום</span>
                <Receipt
                  kicker="קבלה · CREATE FEE"
                  title={title || 'הצבעה חדשה'}
                  rows={[
                    { label: 'משך הצבעה', value: `${duration} ימים` },
                    { label: 'אפשרויות', value: String(filledOptions.length) },
                    {
                      label: 'דמי יצירת הצבעה',
                      value: formatCurrency(CREATE_VOTE_COST),
                      strong: true,
                    },
                  ]}
                  footer="תשלום מאובטח · Green Invoice · חתום בבלוקצ׳יין"
                />
              </div>
            )}

            {/* General error (non-field) */}
            {error && (
              <p className={styles.error} role="alert">
                <span aria-hidden>✕ </span>
                {error}
              </p>
            )}
          </motion.div>

          {/* Sticky action bar */}
          <div className={styles.actionBar}>
            {step > 1 && (
              <NewsButton variant="outline" size="lg" onClick={handleBack} disabled={submitting}>
                חזרה
              </NewsButton>
            )}
            <NewsButton
              variant="red"
              size="lg"
              className={styles.primaryAction}
              onClick={step < STEP_COUNT ? handleNext : handleSubmit}
              disabled={submitting}
              trailing={step < STEP_COUNT ? <span aria-hidden>←</span> : undefined}
            >
              {primaryLabel}
            </NewsButton>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
