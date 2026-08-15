/* The gate a guest meets at the moment they first say something.
   A push on a tile is the whole gesture the desk is built around, so it is
   never refused silently and never swapped for a page: the tile answers, the
   sheet opens on the position they just took, and the two ways in - sign in,
   open an account - are both one click away. The choice travels with them and
   the ballot re-opens on it when they come back. */
'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { NewsButton } from '@/components/press/NewsButton';
import { GoogleMark } from '@/components/uikit/google-mark';
import { useAuth } from '@/providers/AuthProvider';
import { useLockPageScroll } from '@/hooks';
import { localePrefix, type Locale } from '@/lib/i18n';
import { voteReturnPath } from './voteAuthReturn';
import type { VoteAuthRequest } from './DeskTopicRow';
import type { SwipeIntent } from './voteSwipe';
import styles from './VoteAuthDialog.module.css';

/** OAuth drops arbitrary query parameters, so the target is parked client-side. */
const RETURN_KEY = 'taruu.post_auth_redirect';

interface GateCopy {
  kicker: string;
  titleLead: string;
  titleAccent: string;
  leadVote: string;
  leadAside: string;
  positionLabel: string;
  intents: Record<SwipeIntent, string>;
  signIn: string;
  signUp: string;
  dismiss: string;
  termsPrefix: string;
  termsLink: string;
  termsJoin: string;
  privacyLink: string;
  closeLabel: string;
}

const COPY: Record<Locale, GateCopy> = {
  he: {
    kicker: 'קול אחד לתושב · ONE RESIDENT, ONE VOICE',
    titleLead: 'רגע לפני שהקול',
    titleAccent: 'נספר.',
    leadVote:
      'כל קול נרשם פעם אחת ומשויך לתושב מאומת אחד - ולכן צריך חשבון כדי לספור אותו. הבחירה שלכם נשמרת, ואחרי הכניסה נחזיר אתכם בדיוק לאישור שלה.',
    leadAside:
      'המהדורה שלכם - מה יורד מהשולחן ומה נשאר עליו - נשמרת לחשבון, כדי שתמצאו אותה גם במכשיר הבא. היכנסו והיא תישמר מכאן והלאה.',
    positionLabel: 'העמדה שלכם',
    intents: {
      for: 'בעד',
      against: 'נגד',
      aside: 'לא נושא לקונצנזוס',
    },
    signIn: 'כניסה עם Google',
    signUp: 'פתיחת חשבון חדש',
    dismiss: 'לא עכשיו · חזרה לשולחן',
    termsPrefix: 'בכניסה אתם מסכימים',
    termsLink: 'לתנאי השימוש',
    termsJoin: 'ול',
    privacyLink: 'מדיניות הפרטיות',
    closeLabel: 'סגירת החלון',
  },
  en: {
    kicker: 'ONE RESIDENT, ONE VOICE',
    titleLead: 'One step before your voice',
    titleAccent: 'is counted.',
    leadVote:
      'Every vote is recorded once and tied to one verified resident, so counting it takes an account. Your choice is kept, and you will come back to exactly this confirmation.',
    leadAside:
      'Your edition - what leaves the desk and what stays on it - is kept with your account, so it is still yours on the next device. Sign in and it holds from here on.',
    positionLabel: 'Your position',
    intents: {
      for: 'For',
      against: 'Against',
      aside: 'Not a consensus matter',
    },
    signIn: 'Sign in with Google',
    signUp: 'Open a free account',
    dismiss: 'Not now · back to the desk',
    termsPrefix: 'By signing in you agree to',
    termsLink: 'the terms of use',
    termsJoin: ' and the ',
    privacyLink: 'privacy policy',
    closeLabel: 'Close the dialog',
  },
};

interface VoteAuthDialogProps {
  /** The push a guest made, or null when the gate is shut. */
  request: VoteAuthRequest | null;
  onClose: () => void;
  locale: Locale;
}

/**
 * VoteAuthDialog - the sign-in / sign-up gate, opened by a guest's vote.
 *
 * Both doors lead to the same provider (Google is the only sign-in this
 * product has), so the difference between them is honest rather than
 * technical: the first is one click from here, the second opens the sign-up
 * desk that says what an account is before asking for one.
 */
export function VoteAuthDialog({ request, onClose, locale }: VoteAuthDialogProps) {
  const t = COPY[locale];
  const router = useRouter();
  const { signInWithGoogle, isLoading } = useAuth();
  useLockPageScroll(request !== null);

  /** Park the return target for the OAuth callback to consume. */
  const parkReturn = useCallback(() => {
    if (!request) return;
    try {
      const target = voteReturnPath(
        {
          intent: request.intent,
          voteId: request.topic.id,
          optionId: request.optionId,
          currentPath: `${window.location.pathname}${window.location.search}`,
        },
        locale
      );
      sessionStorage.setItem(RETURN_KEY, target);
    } catch {
      /* Storage unavailable - the reader simply lands on their dashboard. */
    }
  }, [request, locale]);

  const handleSignIn = useCallback(() => {
    parkReturn();
    signInWithGoogle();
  }, [parkReturn, signInWithGoogle]);

  const handleSignUp = useCallback(() => {
    parkReturn();
    router.push(`${localePrefix(locale)}/sign-up`);
  }, [parkReturn, router, locale]);

  const intent = request?.intent ?? null;

  return (
    <Dialog.Root open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.backdrop} />
        <Dialog.Content className={styles.dialog} data-lenis-prevent>
          {request && intent ? (
            <>
              <span className={styles.kicker}>
                <span aria-hidden className={styles.kickerTick} />
                {t.kicker}
              </span>

              <Dialog.Title className={styles.title}>
                {t.titleLead} <span className={styles.red}>{t.titleAccent}</span>
              </Dialog.Title>

              <Dialog.Description className={styles.lead}>
                {intent === 'aside' ? t.leadAside : t.leadVote}
              </Dialog.Description>

              <div className={styles.rule} aria-hidden />

              {/* The push, printed back: the reader has already said something,
                  and the gate has to show it is still being held. */}
              <p className={styles.ballot} data-intent={intent}>
                <span className={styles.ballotLabel}>{t.positionLabel}</span>
                <span className={styles.ballotValue}>{t.intents[intent]}</span>
                <span className={styles.ballotTopic}>{request.headline}</span>
              </p>

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.googleBtn}
                  onClick={handleSignIn}
                  disabled={isLoading}
                >
                  <span className={styles.googleGlyph} aria-hidden>
                    <GoogleMark />
                  </span>
                  <span className={styles.googleLabel}>{t.signIn}</span>
                </button>

                <NewsButton
                  variant="outline"
                  size="lg"
                  className={styles.secondary}
                  onClick={handleSignUp}
                >
                  {t.signUp}
                </NewsButton>
              </div>

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

              <Dialog.Close className={styles.dismiss}>{t.dismiss}</Dialog.Close>

              <Dialog.Close className={styles.closeX} aria-label={t.closeLabel}>
                <span aria-hidden>✕</span>
              </Dialog.Close>
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
