'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { safeRedirect } from '@/lib/safeRedirect';
import { PressAtmosphere } from '@/components/press/PressAtmosphere';
import type { Locale } from '@/lib/i18n';
import { localePath, localePrefix } from '@/lib/i18n';
import styles from './page.module.css';

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

interface SignInCopy {
  wordmark: string;
  kicker: string;
  titleLead: string;
  titleRed: string;
  standfirst: string;
  errors: {
    authFailed: string;
    stateMismatch: string;
    callbackFailed: string;
    accessDenied: string;
    generic: string;
  };
  googleCta: string;
  googleCtaLoading: string;
  freeNote: string;
  termsPrefix: string;
  termsLink: string;
  termsJoin: string;
  privacyLink: string;
  dividerPrompt: string;
  switchCta: string;
  features: { scope: string; oneVoice: string; openResults: string };
  trust: string;
  brand: {
    wordmark: string;
    line: string;
    lineRed: string;
    sub: string;
    city: string;
    knesset: string;
    government: string;
  };
}

const COPY: Record<Locale, SignInCopy> = {
  he: {
    wordmark: 'תַּרְאוּ',
    kicker: 'דלפק המשתתפים · כניסה',
    titleLead: 'חוזרים',
    titleRed: 'לסדר היום.',
    standfirst:
      'היכנסו ללוח שלכם. ראו מה עומד להצבעה בעיר, אילו נושאים מקודמים בכנסת ומה קורה בממשלה, והוסיפו את הקול שלכם למניין.',
    errors: {
      authFailed: 'ההתחברות נכשלה. נסו שוב.',
      stateMismatch: 'שגיאת אבטחה. נסו שוב.',
      callbackFailed: 'שגיאה בתהליך ההתחברות.',
      accessDenied: 'הגישה נדחתה.',
      generic: 'לא הצלחנו להשלים את הכניסה. נסו שוב בעוד רגע.',
    },
    googleCta: 'כניסה עם Google',
    googleCtaLoading: 'נכנסים…',
    freeNote: 'לאחר הכניסה תחזרו ללוח שלכם.',
    termsPrefix: 'בכניסה אתם מסכימים',
    termsLink: 'לתנאי השימוש',
    termsJoin: 'ול',
    privacyLink: 'מדיניות הפרטיות',
    dividerPrompt: 'עוד אין לכם חשבון?',
    switchCta: 'פתחו חשבון בחינם ←',
    features: {
      scope: 'עיר · כנסת · ממשלה',
      oneVoice: 'קול אחד בכל הצבעה',
      openResults: 'תוצאות גלויות',
    },
    trust: 'בין בחירות לבחירות, הקול שלכם עדיין יכול להיספר.',
    brand: {
      wordmark: 'תַּרְאוּ',
      line: 'העיר זזה. הכנסת מצביעה. הממשלה פועלת.',
      lineRed: 'איפה אתם עומדים?',
      sub: 'חזרו לראות מה פתוח, מה השתנה ואיפה נדרשת עכשיו עמדה ציבורית.',
      city: 'נושאים עירוניים',
      knesset: 'סדר היום בכנסת',
      government: 'פעולות הממשלה',
    },
  },
  en: {
    wordmark: 'Taruu',
    kicker: 'Participants’ desk · Sign in',
    titleLead: 'Back to',
    titleRed: 'the agenda.',
    standfirst:
      'Sign in to your board. See what is up for a vote in your city, which items are moving in the Knesset and what the government is doing, and add your voice to the count.',
    errors: {
      authFailed: 'Sign-in failed. Try again.',
      stateMismatch: 'Security error. Try again.',
      callbackFailed: 'An error occurred during sign-in.',
      accessDenied: 'Access denied.',
      generic: 'We could not complete the sign-in. Try again in a moment.',
    },
    googleCta: 'Sign in with Google',
    googleCtaLoading: 'Signing in…',
    freeNote: 'After signing in you will return to your board.',
    termsPrefix: 'By signing in you agree to the',
    termsLink: 'Terms of Use',
    termsJoin: 'and the ',
    privacyLink: 'Privacy Policy',
    dividerPrompt: 'No account yet?',
    switchCta: 'Create a free account →',
    features: {
      scope: 'City · Knesset · Government',
      oneVoice: 'One voice in every vote',
      openResults: 'Results in the open',
    },
    trust: 'Between elections, your voice can still be counted.',
    brand: {
      wordmark: 'Taruu',
      line: 'The city moves. The Knesset votes. The government acts.',
      lineRed: 'Where do you stand?',
      sub: 'Come back to see what is open, what has changed and where a public position is needed now.',
      city: 'Municipal affairs',
      knesset: 'The Knesset agenda',
      government: 'Government action',
    },
  },
};

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale: rawLocale } = useParams<{ locale: string }>();
  const locale: Locale = rawLocale === 'en' ? 'en' : 'he';
  const t = COPY[locale];
  const { signInWithGoogle, isAuthenticated, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      // Never push an unvalidated query param: an absolute URL here is an
      // open redirect off the back of a successful sign-in.
      router.push(safeRedirect(searchParams.get('redirect'), '/dashboard'));
    }
  }, [isAuthenticated, isLoading, router, searchParams]);

  // Handle error from URL
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        auth_failed: t.errors.authFailed,
        state_mismatch: t.errors.stateMismatch,
        callback_failed: t.errors.callbackFailed,
        access_denied: t.errors.accessDenied,
      };
      setError(errorMessages[errorParam] || t.errors.generic);
    }
  }, [searchParams, t]);

  const handleGoogleSignIn = () => {
    setError(null);
    signInWithGoogle();
  };

  return (
    <div className={styles.field}>
      <PressAtmosphere />
      <div className={styles.desk}>
        <Link href={localePath(locale)} className={styles.wordmark}>
          {t.wordmark}
        </Link>

        <span className={styles.kicker}>
          <span aria-hidden className={styles.kickerTick} />
          {t.kicker}
        </span>

        <h1 className={styles.title}>
          {t.titleLead} <span className={styles.red}>{t.titleRed}</span>
        </h1>
        <p className={styles.standfirst}>{t.standfirst}</p>

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
            {isLoading ? t.googleCtaLoading : t.googleCta}
          </span>
        </button>

        <p className={styles.freeNote}>{t.freeNote}</p>

        <p className={styles.terms}>
          {t.termsPrefix}{' '}
          <Link href={`${localePrefix(locale)}/terms`} className={styles.link}>
            {t.termsLink}
          </Link>{' '}
          {t.termsJoin}
          <Link href={`${localePrefix(locale)}/privacy`} className={styles.link}>
            {t.privacyLink}
          </Link>
        </p>

        <div className={styles.divider}>
          <span>{t.dividerPrompt}</span>
        </div>

        <Link href={`${localePrefix(locale)}/sign-up`} className={styles.switchLink}>
          {t.switchCta}
        </Link>

        <ul className={styles.features}>
          <li className={styles.feature}>
            <span aria-hidden className={styles.featGlyph}>
              ●
            </span>
            <span>{t.features.scope}</span>
          </li>
          <li className={styles.feature}>
            <span aria-hidden className={styles.featGlyph}>
              ■
            </span>
            <span>{t.features.oneVoice}</span>
          </li>
          <li className={styles.feature}>
            <span aria-hidden className={styles.featGlyph}>
              ▍
            </span>
            <span>{t.features.openResults}</span>
          </li>
        </ul>

        <p className={styles.trust}>{t.trust}</p>
      </div>

      <aside className={styles.brand} aria-hidden>
        <span className={styles.brandWordmark}>{t.brand.wordmark}</span>
        <p className={styles.brandLine}>
          {t.brand.line}{' '}
          <span className={styles.brandRed}>{t.brand.lineRed}</span>
        </p>
        <p className={styles.brandSub}>{t.brand.sub}</p>
        <ul className={styles.brandTrust}>
          <li>
            <span className={styles.brandTrustGlyph}>●</span> {t.brand.city}
          </li>
          <li>
            <span className={styles.brandTrustGlyph}>■</span> {t.brand.knesset}
          </li>
          <li>
            <span className={styles.brandTrustGlyph}>▍</span>{' '}
            {t.brand.government}
          </li>
        </ul>
      </aside>
    </div>
  );
}
