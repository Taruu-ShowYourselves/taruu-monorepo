'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import styles from '../[[...sign-in]]/page.module.css';

// Reuse sign-in styles since they're similar

// Google icon SVG
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function SignUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInWithGoogle, isAuthenticated, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push('/onboarding');
    }
  }, [isAuthenticated, isLoading, router]);

  // Handle error from URL
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        auth_failed: 'ההרשמה נכשלה. נסו שוב.',
        state_mismatch: 'שגיאת אבטחה. נסו שוב.',
        callback_failed: 'שגיאה בתהליך ההרשמה.',
        access_denied: 'הגישה נדחתה.',
      };
      setError(errorMessages[errorParam] || 'שגיאה לא ידועה');
    }
  }, [searchParams]);

  const handleGoogleSignUp = () => {
    setError(null);
    signInWithGoogle();
  };

  return (
    <div className={styles.container}>
      <motion.div
        className={styles.content}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Link href="/" className={styles.logoLink}>
          <span className={styles.logo}>תַּרְאוּ</span>
        </Link>

        <h1 className={styles.title}>הצטרפו לתַּרְאוּ</h1>
        <p className={styles.subtitle}>יצרו חשבון והתחילו להצביע על נושאים מקומיים</p>

        <div className={styles.authCard}>
          {error && (
            <motion.div
              className={styles.error}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
            >
              {error}
            </motion.div>
          )}

          <Button
            variant="outline"
            size="lg"
            isFullWidth
            leftIcon={<GoogleIcon />}
            onClick={handleGoogleSignUp}
            isLoading={isLoading}
            className={styles.googleButton}
          >
            הרשמה עם Google
          </Button>

          <p className={styles.terms}>
            בהרשמה אתם מסכימים{' '}
            <Link href="/terms" className={styles.link}>
              לתנאי השימוש
            </Link>{' '}
            ו
            <Link href="/privacy" className={styles.link}>
              מדיניות הפרטיות
            </Link>
          </p>

          <div className={styles.divider}>
            <span>יש לכם חשבון?</span>
          </div>

          <Link href="/sign-in" className={styles.switchLink}>
            <Button variant="ghost" isFullWidth>
              התחברות לחשבון קיים
            </Button>
          </Link>
        </div>

        <div className={styles.features}>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>🔒</span>
            <span className={styles.featureText}>מאובטח בבלוקצ׳יין</span>
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>📍</span>
            <span className={styles.featureText}>אימות מיקום</span>
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>🎫</span>
            <span className={styles.featureText}>טוקנים לתרומה</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
