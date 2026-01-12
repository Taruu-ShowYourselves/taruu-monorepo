'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/Input';
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

  return (
    <div className={styles.wrapper}>
      <AnimatePresence mode="wait">
        {status === 'success' ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={styles.successMessage}
          >
            <svg
              className={styles.successIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
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
            <div className={styles.inputGroup}>
              <Input
                type="email"
                placeholder={t.placeholder}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                  if (status === 'error') setStatus('idle');
                }}
                error={error}
                inputSize={isCompact ? 'md' : 'lg'}
                isFullWidth
                disabled={status === 'loading'}
                dir="ltr"
                aria-label={t.ariaLabel}
              />
              <Button
                type="submit"
                size={isCompact ? 'md' : 'lg'}
                isLoading={status === 'loading'}
                className={styles.submitButton}
              >
                {status === 'loading' ? t.submitting : t.submit}
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
