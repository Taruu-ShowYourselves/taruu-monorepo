'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/providers/AuthProvider';
import { CREATE_VOTE_COST, formatCurrency } from '@sync/shared';
import styles from './page.module.css';

export default function CreateVotePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [duration, setDuration] = useState(7); // days

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
  };

  const validateStep1 = () => {
    if (!title.trim()) {
      setError('יש להזין כותרת');
      return false;
    }
    if (title.length < 10) {
      setError('הכותרת חייבת להכיל לפחות 10 תווים');
      return false;
    }
    if (!description.trim()) {
      setError('יש להזין תיאור');
      return false;
    }
    if (description.length < 30) {
      setError('התיאור חייב להכיל לפחות 30 תווים');
      return false;
    }
    setError('');
    return true;
  };

  const validateStep2 = () => {
    const filledOptions = options.filter((o) => o.trim());
    if (filledOptions.length < 2) {
      setError('יש להזין לפחות 2 אפשרויות');
      return false;
    }
    setError('');
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
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

    setSubmitting(true);
    setError('');

    try {
      // Create Green Invoice payment session
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'vote_creation',
          voteTitle: title,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment');
      }

      const data = await response.json();

      // Redirect to Green Invoice payment page
      if (data.payment?.paymentUrl) {
        // Store vote creation data in sessionStorage before redirect
        sessionStorage.setItem('pendingVote', JSON.stringify({
          title,
          description,
          options: options.filter((o) => o.trim()),
          duration,
          paymentId: data.payment.id,
          orderId: data.payment.orderId,
        }));

        window.location.href = data.payment.paymentUrl;
      } else {
        throw new Error('No payment URL received');
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'שגיאה ביצירת ההצבעה');
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>טוען...</p>
      </div>
    );
  }

  return (
    <>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          {/* Header */}
          <motion.div
            className={styles.header}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <button className={styles.backButton} onClick={() => router.back()}>
              <span className={styles.backArrow}>←</span>
              חזרה
            </button>
            <div>
              <h1>יצירת הצבעה חדשה</h1>
              <p>שלב {step} מתוך 3</p>
            </div>
          </motion.div>

          {/* Progress bar */}
          <div className={styles.progressContainer}>
            <div className={styles.progressBar}>
              <motion.div
                className={styles.progressFill}
                initial={{ width: '33%' }}
                animate={{ width: `${(step / 3) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className={styles.steps}>
              <span className={step >= 1 ? styles.activeStep : ''}>פרטים</span>
              <span className={step >= 2 ? styles.activeStep : ''}>אפשרויות</span>
              <span className={step >= 3 ? styles.activeStep : ''}>תשלום</span>
            </div>
          </div>

          {/* Form */}
          <motion.div
            className={styles.formCard}
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            {step === 1 && (
              <>
                <h2>פרטי ההצבעה</h2>

                <div className={styles.formGroup}>
                  <label>כותרת *</label>
                  <input
                    type="text"
                    placeholder="למשל: הקמת גן שעשועים חדש"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={100}
                  />
                  <span className={styles.charCount}>{title.length}/100</span>
                </div>

                <div className={styles.formGroup}>
                  <label>תיאור *</label>
                  <textarea
                    placeholder="תארו את הנושא בפירוט..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={500}
                    rows={5}
                  />
                  <span className={styles.charCount}>{description.length}/500</span>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h2>אפשרויות להצבעה</h2>
                <p className={styles.hint}>הוסיפו 2-5 אפשרויות שהמצביעים יוכלו לבחור ביניהן</p>

                <div className={styles.optionsList}>
                  {options.map((option, index) => (
                    <div key={index} className={styles.optionRow}>
                      <input
                        type="text"
                        placeholder={`אפשרות ${index + 1}`}
                        value={option}
                        onChange={(e) => updateOption(index, e.target.value)}
                        maxLength={100}
                      />
                      {options.length > 2 && (
                        <button
                          className={styles.removeButton}
                          onClick={() => removeOption(index)}
                          type="button"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {options.length < 5 && (
                  <button className={styles.addButton} onClick={addOption} type="button">
                    + הוספת אפשרות
                  </button>
                )}
              </>
            )}

            {step === 3 && (
              <>
                <h2>סיכום ותשלום</h2>

                {/* Summary */}
                <div className={styles.summary}>
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <div className={styles.summaryOptions}>
                    <strong>אפשרויות:</strong>
                    <ul>
                      {options.filter((o) => o.trim()).map((option, index) => (
                        <li key={index}>{option}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Duration Selection */}
                <div className={styles.formGroup}>
                  <label>משך ההצבעה</label>
                  <div className={styles.durationOptions}>
                    {[3, 7, 14, 30].map((days) => (
                      <button
                        key={days}
                        className={`${styles.durationButton} ${duration === days ? styles.selected : ''}`}
                        onClick={() => setDuration(days)}
                        type="button"
                      >
                        {days} ימים
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment Info */}
                <div className={styles.paymentInfo}>
                  <div className={styles.paymentRow}>
                    <span>עלות יצירת הצבעה</span>
                    <strong>{formatCurrency(CREATE_VOTE_COST)}</strong>
                  </div>
                  <p className={styles.paymentNote}>תשלום מאובטח דרך Green Invoice</p>
                </div>
              </>
            )}

            {/* Error */}
            {error && <p className={styles.error}>{error}</p>}

            {/* Actions */}
            <div className={styles.actions}>
              {step > 1 && (
                <Button variant="ghost" onClick={handleBack}>
                  חזרה
                </Button>
              )}
              <Button
                onClick={step < 3 ? handleNext : handleSubmit}
                disabled={submitting}
              >
                {submitting
                  ? 'מעבד תשלום...'
                  : step < 3
                    ? 'המשך'
                    : `שלם ${formatCurrency(CREATE_VOTE_COST)} וצור הצבעה`}
              </Button>
            </div>
          </motion.div>
        </div>
      </main>
      <Footer />
    </>
  );
}
