'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { GoogleMark } from '@/components/uikit/google-mark';
import { safeRedirect } from '@/lib/safeRedirect';
import { PressAtmosphere } from '@/components/press/PressAtmosphere';
import type { Locale } from '@/lib/i18n';
import { localePath, localePrefix } from '@/lib/i18n';
import styles from './page.module.css';

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
    switchCta: 'פתחו חשבון בחינם',
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
    switchCta: 'Create a free account',
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
  const [connecting, setConnecting] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      // Never push an unvalidated query param: an absolute URL here is an
      // open redirect off the back of a successful sign-in.
      router.push(safeRedirect(searchParams.get('redirect'), '/dashboard'));
    }
  }, [isAuthenticated, isLoading, router, searchParams]);

  // The OAuth redirect unloads the page mid-"connecting"; a bfcache restore
  // (back button) would otherwise revive it with the CTA stuck disabled.
  useEffect(() => {
    const reset = () => setConnecting(false);
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

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
    // The OAuth redirect takes 1-3s to leave the page; without a local pending
    // state the tap appears to do nothing and invites a second click.
    setError(null);
    setConnecting(true);
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
          disabled={isLoading || connecting}
        >
          <span
            className={
              connecting
                ? `${styles.googleGlyph} ${styles.googleGlyphPending}`
                : styles.googleGlyph
            }
            aria-hidden
          >
            <GoogleMark />
          </span>
          <span className={styles.googleLabel}>
            {isLoading || connecting ? t.googleCtaLoading : t.googleCta}
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
          <span>{t.switchCta}</span>
          {/* Separate glyph so hover can slide it along the reading direction. */}
          <span aria-hidden className={styles.switchArrow}>
            {locale === 'he' ? '←' : '→'}
          </span>
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
