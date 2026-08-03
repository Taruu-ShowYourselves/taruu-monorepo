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
import { PROPOSAL_STATUS_LABELS_HE } from '@/components/space-admin/proposalStatusLabels';
import { useAuth } from '@/providers/AuthProvider';
import styles from './page.module.css';

// ---------------------------------------------------------------------------
// Microcopy (locked press system)
// ---------------------------------------------------------------------------
const MSG_REQUIRED = 'צריך למלא את השדה הזה כדי להמשיך.';
const MSG_GENERAL = 'משהו השתבש אצלנו, לא אצלכם. נסו שוב בעוד רגע.';

// Press wizard is 4 editorial steps; the underlying validation stays 3-staged
// (details → options → submission) — duration lives on the final plate.
const STEP_LABELS = [
  { label: 'נושא' },
  { label: 'אפשרויות' },
  { label: 'משך' },
  { label: 'הגשה' },
];

const DURATIONS = [
  { value: '3', label: '3 ימים' },
  { value: '7', label: '7 ימים' },
  { value: '14', label: '14 יום' },
  { value: '30', label: '30 יום' },
];

const STEP_COUNT = STEP_LABELS.length;

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

  // Success surface — gated on the id the server returned for the proposal.
  const [submittedVoteId, setSubmittedVoteId] = useState<string | null>(null);

  // Form state — unchanged
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
      // Duration always has a value — straight through to payment.
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

    try {
      // Submission is free and posts the proposal directly. There is no
      // checkout here and no draft stashed anywhere: the row exists the moment
      // the server answers, and the ₪50 obligation is created only if a space
      // admin approves it (issue #75). Nothing is retried — there is no
      // webhook to wait for.
      const now = new Date();
      const end = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);
      const res = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          options: filledOptions.map((label) => ({ label })),
          startDate: now.toISOString(),
          endDate: end.toISOString(),
        }),
      });

      if (!res.ok) {
        setError(MSG_GENERAL);
        setSubmitting(false);
        return;
      }

      const data = await res.json();
      setSubmittedVoteId(String(data.vote?.id ?? ''));
      setSubmitting(false);
    } catch (err: unknown) {
      console.error('Proposal submission failed:', err);
      setError(MSG_GENERAL);
      setSubmitting(false);
    }
  };

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

  // ----- Submitted surface ------------------------------------------------
  // Gated on the id the server returned, not on a hash: at submission nothing
  // has been signed and no chain record exists, so there is no seal to render.
  if (submittedVoteId !== null) {
    return (
      <>
        <Header />
        <main className={styles.main}>
          <div className={styles.container}>
            <header className={styles.head}>
              <span className={styles.kicker}>
                <span aria-hidden className={styles.kickerTick} />
                הוגש · SUBMITTED
              </span>
              <h1 className={styles.headline}>
                ההצעה שלכם <span className={styles.red}>נשלחה לבדיקה.</span>
              </h1>
              <p className={styles.standfirst}>
                מנהל/ת המרחב יבדקו את ההצעה. ההגשה לא חויבה — דמי יצירה של ₪50
                ייווצרו רק אם ההצעה תאושר ותתפרסם.
              </p>
            </header>

            <div className={styles.successGrid}>
              <Receipt
                kicker="קבלה · RECEIPT"
                title={title}
                rows={[
                  { label: 'משך הצבעה', value: `${duration} ימים` },
                  { label: 'אפשרויות', value: String(filledOptions.length) },
                  {
                    label: 'סטטוס',
                    value: PROPOSAL_STATUS_LABELS_HE.in_review,
                    strong: true,
                  },
                ]}
                footer="תַּרְאוּ · כל הארץ · המהדורה הקהילתית"
              />
            </div>

            <div className={styles.actionBar}>
              <NewsButton
                variant="red"
                size="lg"
                onClick={() => router.push('/votes')}
                trailing={<span aria-hidden>←</span>}
              >
                לכל ההצבעות
              </NewsButton>
            </div>
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
    ? 'שולחים את ההצעה…'
    : step < STEP_COUNT
      ? 'המשך'
      : 'שלחו את ההצעה לבדיקה';

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
              הציעו נושא, נסחו את האפשרויות, וקבעו את משך ההצבעה. ההגשה ללא
              תשלום — ההצעה עוברת לבדיקה, ורק אחרי אישור היא מתפרסמת ונחתמת
              בבלוקצ׳יין.
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
                <span className={styles.plateKicker}>FIG. 4 · הגשה</span>
                <Receipt
                  kicker="סיכום · SUBMISSION"
                  title={title || 'הצבעה חדשה'}
                  rows={[
                    { label: 'משך הצבעה', value: `${duration} ימים` },
                    { label: 'אפשרויות', value: String(filledOptions.length) },
                    { label: 'עלות הגשה', value: 'ללא תשלום', strong: true },
                    { label: 'דמי יצירה', value: '₪50 — רק אם ההצעה תאושר' },
                  ]}
                  footer="ההגשה עוברת לבדיקת מנהל/ת המרחב לפני פרסום."
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
