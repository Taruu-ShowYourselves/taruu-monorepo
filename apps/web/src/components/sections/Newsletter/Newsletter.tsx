'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Heading, Text } from '@/components/ui/Typography';
import { AnimatedFadeInUp } from '@/components/animations';
import styles from './Newsletter.module.css';

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

// Rate limiting: track submissions per session
const RATE_LIMIT_MS = 60000; // 1 minute between submissions

export function Newsletter() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const lastSubmitRef = useRef<number>(0);
  const honeypotRef = useRef<HTMLInputElement>(null);

  const validateEmail = useCallback((email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Honeypot check - if filled, silently reject (bot detected)
    if (honeypotRef.current?.value) {
      setStatus('success'); // Fake success to not alert bots
      return;
    }

    // Rate limiting check
    const now = Date.now();
    if (now - lastSubmitRef.current < RATE_LIMIT_MS) {
      setStatus('error');
      setErrorMessage('נא להמתין לפני שליחה נוספת');
      return;
    }

    // Email validation
    if (!email.trim()) {
      setStatus('error');
      setErrorMessage('נא להזין כתובת אימייל');
      return;
    }

    if (!validateEmail(email)) {
      setStatus('error');
      setErrorMessage('נא להזין כתובת אימייל תקינה');
      return;
    }

    setStatus('submitting');
    setErrorMessage('');
    lastSubmitRef.current = now;

    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'שגיאה בהרשמה');
      }

      setStatus('success');
      setEmail('');
    } catch (error) {
      setStatus('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'שגיאה בהרשמה. נסו שוב מאוחר יותר.'
      );
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (status === 'error') {
      setStatus('idle');
      setErrorMessage('');
    }
  };

  return (
    <section className={styles.newsletter} aria-labelledby="newsletter-heading">
      <div className={styles.container}>
        {/* Background decoration */}
        <motion.div
          className={styles.backgroundGradient}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        />

        <div className={styles.content}>
          <AnimatedFadeInUp>
            <Heading level={2} align="center" id="newsletter-heading" className={styles.heading}>
              רוצים לדעת מתי זה קורה בקריית טבעון?
            </Heading>
          </AnimatedFadeInUp>

          <AnimatedFadeInUp delay={0.1}>
            <Text size="lg" color="secondary" align="center" className={styles.description}>
              נשלח עדכון לפני ההצבעה הבאה (23.01.26) ועוד עדכונים קצרים על פיילוטים מקומיים.
            </Text>
          </AnimatedFadeInUp>

          <AnimatedFadeInUp delay={0.2}>
            <AnimatePresence mode="wait">
              {status === 'success' ? (
                <motion.div
                  key="success"
                  className={styles.successMessage}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  role="status"
                  aria-live="polite"
                >
                  <svg
                    className={styles.successIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <Text size="lg" weight="medium" align="center">
                    נרשמתם בהצלחה! נשלח לכם עדכונים בקרוב.
                  </Text>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  className={styles.form}
                  onSubmit={handleSubmit}
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  noValidate
                >
                  {/* Honeypot field - hidden from users, visible to bots */}
                  <div className={styles.honeypot} aria-hidden="true">
                    <label htmlFor="website">Website</label>
                    <input
                      type="text"
                      id="website"
                      name="website"
                      ref={honeypotRef}
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <div className={styles.inputWrapper}>
                      <input
                        type="email"
                        id="newsletter-email"
                        name="email"
                        value={email}
                        onChange={handleEmailChange}
                        placeholder="האימייל שלכם"
                        className={styles.input}
                        aria-label="כתובת אימייל"
                        aria-invalid={status === 'error'}
                        aria-describedby={status === 'error' ? 'email-error' : undefined}
                        disabled={status === 'submitting'}
                        autoComplete="email"
                        dir="ltr"
                      />
                      <Button
                        type="submit"
                        isLoading={status === 'submitting'}
                        disabled={status === 'submitting'}
                        className={styles.submitButton}
                      >
                        הרשמה לעדכונים
                      </Button>
                    </div>

                    <AnimatePresence>
                      {status === 'error' && errorMessage && (
                        <motion.div
                          id="email-error"
                          className={styles.errorMessage}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          role="alert"
                        >
                          <svg
                            className={styles.errorIcon}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            aria-hidden="true"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          <Text size="sm" color="error">
                            {errorMessage}
                          </Text>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <Text size="sm" color="muted" align="center" className={styles.consent}>
                    בלחיצה על הרשמה אני מאשר/ת לקבל עדכונים. אפשר להסיר בכל עת.{' '}
                    <Link href="/privacy" className={styles.privacyLink}>
                      מדיניות פרטיות
                    </Link>
                  </Text>
                </motion.form>
              )}
            </AnimatePresence>
          </AnimatedFadeInUp>
        </div>
      </div>
    </section>
  );
}
