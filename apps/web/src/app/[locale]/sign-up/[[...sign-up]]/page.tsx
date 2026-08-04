'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import styles from '../../sign-in/[[...sign-in]]/page.module.css';

// Reuse the membership-desk styles - sign-up shares the press desk.

// Google "G" mark - monochrome, inherits the button text colour (brutalist
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
      setError(
        errorMessages[errorParam] ||
          'לא הצלחנו להשלים את ההרשמה. נסו שוב בעוד רגע.'
      );
    }
  }, [searchParams]);

  const handleGoogleSignUp = () => {
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
          דלפק המשתתפים · פתיחת חשבון
        </span>

        <h1 className={styles.title}>
          הקול שלכם <span className={styles.red}>נכנס למניין.</span>
        </h1>
        <p className={styles.standfirst}>
          פתחו חשבון בחינם והצביעו על מה שקורה בעיר, בכנסת ובממשלה. הקול שלכם
          יצטרף לקולות מאומתים אחרים וייכלל בתוצאה גלויה שאפשר לבדוק.
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
          onClick={handleGoogleSignUp}
          disabled={isLoading}
        >
          <span className={styles.googleGlyph} aria-hidden>
            <GoogleIcon />
          </span>
          <span className={styles.googleLabel}>
            {isLoading ? 'פותחים חשבון…' : 'פתיחת חשבון עם Google'}
          </span>
        </button>

        <p className={styles.freeNote}>
          ההרשמה וההשתתפות חינם. האימות מתבצע בעת ההצבעה.
        </p>

        <p className={styles.terms}>
          בהרשמה אתם מסכימים{' '}
          <Link href="/terms" className={styles.link}>
            לתנאי השימוש
          </Link>{' '}
          ול
          <Link href="/privacy" className={styles.link}>
            מדיניות הפרטיות
          </Link>
        </p>

        <div className={styles.divider}>
          <span>כבר יש לכם חשבון?</span>
        </div>

        <Link href="/sign-in" className={styles.switchLink}>
          להתחברות ←
        </Link>

        <ul className={styles.features}>
          <li className={styles.feature}>
            <span aria-hidden className={styles.featGlyph}>
              ●
            </span>
            <span>עיר · כנסת · ממשלה</span>
          </li>
          <li className={styles.feature}>
            <span aria-hidden className={styles.featGlyph}>
              ■
            </span>
            <span>אדם אחד, קול אחד בכל הצבעה</span>
          </li>
          <li className={styles.feature}>
            <span aria-hidden className={styles.featGlyph}>
              ▍
            </span>
            <span>תוצאות שקופות</span>
          </li>
        </ul>

        <p className={styles.trust}>
          פותחים חשבון. בוחרים רשות. מצביעים.
        </p>
      </div>

      <aside className={styles.brand} aria-hidden>
        <span className={styles.brandWordmark}>תַּרְאוּ</span>
        <p className={styles.brandLine}>
          כתבתם. שיתפתם. צעקתם.{' '}
          <span className={styles.brandRed}>מי ספר אתכם בכנסת ובממשלה?</span>
        </p>
        <p className={styles.brandSub}>
          פוסט בודד נעלם בפיד. תַּרְאוּ מרכזת קולות מאומתים על מה שקורה בעיר,
          בכנסת ובממשלה, ומציגה את תוצאת המשתתפים בגלוי.
        </p>
        <ul className={styles.brandTrust}>
          <li>
            <span className={styles.brandTrustGlyph}>●</span> מה קורה בעיר
          </li>
          <li>
            <span className={styles.brandTrustGlyph}>■</span> מה עולה בכנסת
          </li>
          <li>
            <span className={styles.brandTrustGlyph}>▍</span> מה עושה הממשלה
          </li>
        </ul>
      </aside>
    </div>
  );
}
