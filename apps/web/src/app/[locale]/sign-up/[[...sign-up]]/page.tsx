'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import type { Locale } from '@/lib/i18n';
import { localePath, localePrefix } from '@/lib/i18n';
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

interface SignUpCopy {
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

const COPY: Record<Locale, SignUpCopy> = {
  he: {
    wordmark: 'תַּרְאוּ',
    kicker: 'דלפק המשתתפים · פתיחת חשבון',
    titleLead: 'הקול שלכם',
    titleRed: 'נכנס למניין.',
    standfirst:
      'פתחו חשבון בחינם והצביעו על מה שקורה בעיר, בכנסת ובממשלה. הקול שלכם יצטרף לקולות מאומתים אחרים וייכלל בתוצאה גלויה שאפשר לבדוק.',
    errors: {
      authFailed: 'ההרשמה נכשלה. נסו שוב.',
      stateMismatch: 'שגיאת אבטחה. נסו שוב.',
      callbackFailed: 'שגיאה בתהליך ההרשמה.',
      accessDenied: 'הגישה נדחתה.',
      generic: 'לא הצלחנו להשלים את ההרשמה. נסו שוב בעוד רגע.',
    },
    googleCta: 'פתיחת חשבון עם Google',
    googleCtaLoading: 'פותחים חשבון…',
    freeNote: 'ההרשמה וההשתתפות חינם. האימות מתבצע בעת ההצבעה.',
    termsPrefix: 'בהרשמה אתם מסכימים',
    termsLink: 'לתנאי השימוש',
    termsJoin: 'ול',
    privacyLink: 'מדיניות הפרטיות',
    dividerPrompt: 'כבר יש לכם חשבון?',
    switchCta: 'להתחברות ←',
    features: {
      scope: 'עיר · כנסת · ממשלה',
      oneVoice: 'אדם אחד, קול אחד בכל הצבעה',
      openResults: 'תוצאות שקופות',
    },
    trust: 'פותחים חשבון. בוחרים רשות. מצביעים.',
    brand: {
      wordmark: 'תַּרְאוּ',
      line: 'כתבתם. שיתפתם. צעקתם.',
      lineRed: 'מי ספר אתכם בכנסת ובממשלה?',
      sub: 'פוסט בודד נעלם בפיד. תַּרְאוּ מרכזת קולות מאומתים על מה שקורה בעיר, בכנסת ובממשלה, ומציגה את תוצאת המשתתפים בגלוי.',
      city: 'מה קורה בעיר',
      knesset: 'מה עולה בכנסת',
      government: 'מה עושה הממשלה',
    },
  },
  en: {
    wordmark: 'Taruu',
    kicker: 'Participants’ desk · New account',
    titleLead: 'Your voice',
    titleRed: 'joins the count.',
    standfirst:
      'Open a free account and vote on what is happening in your city, in the Knesset and in the government. Your voice joins other verified voices and is counted in an open result that anyone can check.',
    errors: {
      authFailed: 'Sign-up failed. Try again.',
      stateMismatch: 'Security error. Try again.',
      callbackFailed: 'An error occurred during sign-up.',
      accessDenied: 'Access denied.',
      generic: 'We could not complete the sign-up. Try again in a moment.',
    },
    googleCta: 'Open an account with Google',
    googleCtaLoading: 'Opening your account…',
    freeNote: 'Sign-up and participation are free. Verification takes place when you vote.',
    termsPrefix: 'By signing up you agree to the',
    termsLink: 'Terms of Use',
    termsJoin: 'and the ',
    privacyLink: 'Privacy Policy',
    dividerPrompt: 'Already have an account?',
    switchCta: 'Sign in →',
    features: {
      scope: 'City · Knesset · Government',
      oneVoice: 'One person, one voice in every vote',
      openResults: 'Transparent results',
    },
    trust: 'Open an account. Choose your municipality. Vote.',
    brand: {
      wordmark: 'Taruu',
      line: 'You wrote. You shared. You shouted.',
      lineRed: 'Who counted you in the Knesset and the government?',
      sub: 'A single post disappears into the feed. Taruu gathers verified voices on what is happening in the city, the Knesset and the government, and shows the participants’ result in the open.',
      city: 'What is happening in the city',
      knesset: 'What is coming up in the Knesset',
      government: 'What the government is doing',
    },
  },
};

export default function SignUpPage() {
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
      router.push(`${localePrefix(locale)}/onboarding`);
    }
  }, [isAuthenticated, isLoading, router, locale]);

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

  const handleGoogleSignUp = () => {
    setError(null);
    signInWithGoogle();
  };

  return (
    <div className={styles.field}>
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
          onClick={handleGoogleSignUp}
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

        <Link href={`${localePrefix(locale)}/sign-in`} className={styles.switchLink}>
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
