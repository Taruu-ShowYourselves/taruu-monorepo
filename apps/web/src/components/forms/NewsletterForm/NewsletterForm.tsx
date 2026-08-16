'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Typography';
import type { Locale } from '@/lib/i18n';
import styles from './NewsletterForm.module.css';

type FormStatus = 'idle' | 'loading' | 'success' | 'error';

interface NewsletterFormProps {
  source?: 'homepage_cta' | 'footer' | 'landing_page' | 'blog' | 'campaign' | 'other';
  sourcePage?: string;
  variant?: 'default' | 'compact' | 'inline';
  locale?: Locale;
}

export function NewsletterForm({
  source = 'homepage_cta',
  sourcePage,
  variant = 'default',
  locale = 'he',
}: NewsletterFormProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<FormStatus>('idle');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const t = {
    placeholder: 'your@email.com',
    submit: locale === 'en' ? 'Sign Up for Updates' : 'הירשמו לעדכונים',
    submitting: locale === 'en' ? 'Sending...' : 'שולח...',
    emailRequired: locale === 'en' ? 'Please enter an email address' : 'נא להזין כתובת אימייל',
    emailInvalid: locale === 'en' ? 'Invalid email address' : 'כתובת אימייל לא תקינה',
    errorGeneric: locale === 'en' ? 'An error occurred. Please try again later.' : 'אירעה שגיאה. אנא נסו שוב מאוחר יותר',
    successMessage: locale === 'en' ? 'Thanks! You\'ve successfully subscribed.' : 'תודה! נרשמת בהצלחה לניוזלטר',
    privacy: locale === 'en'
      ? 'By signing up you agree to receive updates from Taro. You can unsubscribe anytime.'
      : 'בהרשמה אתם מסכימים לקבל עדכונים מתארו. תוכלו לבטל בכל עת.',
    ariaLabel: locale === 'en' ? 'Email address' : 'כתובת אימייל',
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError(t.emailRequired);
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setError(t.emailInvalid);
      return;
    }

    setError('');
    setStatus('loading');

    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: trimmedEmail,
          source,
          locale,
          sourcePage: sourcePage || (typeof window !== 'undefined' ? window.location.pathname : undefined),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setStatus('success');
        setMessage(data.message || t.successMessage);
        setEmail('');
      } else {
        setStatus('error');
        setMessage(data.message);
      }
    } catch {
      setStatus('error');
      setMessage(t.errorGeneric);
    }
  };

  const isCompact = variant === 'compact' || variant === 'inline';
  const isValid = validateEmail(email.trim());
  const PARTICLES = [
    { x: -34, y: -20, d: 0 }, { x: 30, y: -26, d: 0.05 }, { x: -42, y: 8, d: 0.1 },
    { x: 40, y: 4, d: 0.08 }, { x: -18, y: -34, d: 0.12 }, { x: 22, y: 30, d: 0.06 },
    { x: -30, y: 26, d: 0.14 }, { x: 14, y: -36, d: 0.1 },
  ];

  return (
    <div className={styles.wrapper}>
      <AnimatePresence mode="wait">
        {status === 'success' ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className={styles.successMessage}
          >
            <span className={styles.successBadge}>
              <motion.svg
                className={styles.successIcon}
                viewBox="0 0 52 52"
                fill="none"
                initial="hidden"
                animate="show"
              >
                <motion.circle
                  cx="26" cy="26" r="23" stroke="currentColor" strokeWidth="2.5" fill="none"
                  variants={{ hidden: { pathLength: 0, opacity: 0 }, show: { pathLength: 1, opacity: 0.45 } }}
                  transition={{ duration: 0.6, ease: 'easeInOut' }}
                />
                <motion.path
                  d="M16 27l7 7 14-15" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
                  variants={{ hidden: { pathLength: 0 }, show: { pathLength: 1 } }}
                  transition={{ duration: 0.45, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
                />
              </motion.svg>
              {PARTICLES.map((p, i) => (
                <motion.span
                  key={i}
                  className={styles.particle}
                  initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 0], x: p.x, y: p.y, scale: [0, 1, 0.4] }}
                  transition={{ duration: 0.7, delay: 0.4 + p.d, ease: 'easeOut' }}
                />
              ))}
            </span>
            <Text color="secondary" weight="medium">
              {message}
            </Text>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            onSubmit={handleSubmit}
            className={`${styles.form} ${styles[variant]}`}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className={`${styles.field} ${error ? styles.fieldError : ''} ${isValid ? styles.fieldValid : ''}`}
            >
              <span className={styles.mailIcon} aria-hidden>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                  <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M4 7.5l8 5 8-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <input
                className={styles.input}
                type="email"
                placeholder={t.placeholder}
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                  if (status === 'error') setStatus('idle');
                }}
                disabled={status === 'loading'}
                dir="ltr"
                aria-label={t.ariaLabel}
                aria-invalid={!!error}
              />
              <Button
                type="submit"
                size={isCompact ? 'md' : 'lg'}
                isLoading={status === 'loading'}
                className={`${styles.submitButton} ${isValid ? styles.submitReady : ''}`}
                rightIcon={
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
                    <path d="M19 12H5M11 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                }
              >
                <span className={styles.btnLabel}>
                  {status === 'loading' ? t.submitting : t.submit}
                </span>
              </Button>
            </div>

            <AnimatePresence>
              {status === 'error' && message && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Text size="sm" color="error" className={styles.errorMessage}>
                    {message}
                  </Text>
                </motion.div>
              )}
            </AnimatePresence>

            {!isCompact && (
              <Text size="sm" color="muted" className={styles.privacyNote}>
                {t.privacy}
              </Text>
            )}
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
