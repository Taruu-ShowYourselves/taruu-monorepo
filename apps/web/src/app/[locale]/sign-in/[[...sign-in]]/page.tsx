'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import styles from './page.module.css';

// Google "G" mark — monochrome, inherits the button text colour (brutalist
// mono palette: ink/paper/red only; no off-system brand colour or white seat).
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInWithGoogle, isAuthenticated, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      const redirect = searchParams.get('redirect') || '/dashboard';
      router.push(redirect);
    }
  }, [isAuthenticated, isLoading, router, searchParams]);

  // Handle error from URL
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        auth_failed: 'ההתחברות נכשלה. נסו שוב.',
        state_mismatch: 'שגיאת אבטחה. נסו שוב.',
        callback_failed: 'שגיאה בתהליך ההתחברות.',
        access_denied: 'הגישה נדחתה.',
      };
      setError(
        errorMessages[errorParam] ||
          'משהו השתבש אצלנו, לא אצלכם. נסו שוב בעוד רגע.'
      );
    }
  }, [searchParams]);

  const handleGoogleSignIn = () => {
    setError(null);
    signInWithGoogle();
  };

  return (
    <div className={styles.field}>
      <div className={styles.desk}>
        <Link href="/" className={styles.wordmark}>
          תַּרְאוּ
        </Link>

        <span className={styles.kicker}>
          <span aria-hidden className={styles.kickerTick} />
          דלפק החברים · SIGN IN
        </span>

        <h1 className={styles.title}>
          ברוכים <span className={styles.red}>השבים.</span>
        </h1>
        <p className={styles.standfirst}>
          התחברו כדי להצביע על נושאים מקומיים — מאומת, שקוף, בלתי ניתן לזיוף.
        </p>

        <div className={styles.rule} aria-hidden />

        {error && (
          <p className={styles.error} role="alert">
            <span aria-hidden>✕ </span>
            {error}
          </p>
        )}

        <button
          type="button"
          className={styles.googleBtn}
          onClick={handleGoogleSignIn}
          disabled={isLoading}
        >
          <span className={styles.googleGlyph} aria-hidden>
            <GoogleIcon />
          </span>
          <span className={styles.googleLabel}>
            {isLoading ? 'מתחבר…' : 'התחבר עם Google'}
          </span>
        </button>

        <p className={styles.terms}>
          בהתחברות אתם מסכימים{' '}
          <Link href="/terms" className={styles.link}>
            לתנאי השימוש
          </Link>{' '}
          ו
          <Link href="/privacy" className={styles.link}>
            מדיניות הפרטיות
          </Link>
        </p>

        <div className={styles.divider}>
          <span>אין לכם חשבון?</span>
        </div>

        <Link href="/sign-up" className={styles.switchLink}>
          יצירת חשבון חדש ←
        </Link>

        <ul className={styles.features}>
          <li className={styles.feature}>
            <span aria-hidden className={styles.featGlyph}>
              ●
            </span>
            <span>מאובטח בבלוקצ׳יין</span>
          </li>
          <li className={styles.feature}>
            <span aria-hidden className={styles.featGlyph}>
              ■
            </span>
            <span>אימות מיקום</span>
          </li>
          <li className={styles.feature}>
            <span aria-hidden className={styles.featGlyph}>
              ▍
            </span>
            <span>טוקנים לתרומה</span>
          </li>
        </ul>

        <p className={styles.trust}>הקול שלכם. הקהילה שלכם.</p>
      </div>

      <aside className={styles.brand} aria-hidden>
        <span className={styles.brandWordmark}>תַּרְאוּ</span>
        <p className={styles.brandLine}>
          הקול שלכם. <span className={styles.brandRed}>הקהילה שלכם.</span>
        </p>
        <ul className={styles.brandTrust}>
          <li>
            <span className={styles.brandTrustGlyph}>●</span> מאומת · חתום בבלוקצ׳יין
          </li>
          <li>
            <span className={styles.brandTrustGlyph}>■</span> אימות תושב לפי מיקום
          </li>
          <li>
            <span className={styles.brandTrustGlyph}>▍</span> ₪2 מכל ₪3 לקרן הקהילתית
          </li>
        </ul>
      </aside>
    </div>
  );
}
