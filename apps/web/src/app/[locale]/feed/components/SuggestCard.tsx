'use client';

import Link from 'next/link';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';
import { NewsButton } from '@/components/press/NewsButton';
import { useDeckStage } from './useDeckStage';
import styles from './Feed.module.css';
import { localePrefix } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';

interface SuggestCardProps {
  index: number;
  rootRef: React.RefObject<HTMLDivElement | null>;
  locale: string;
  /** The reader's stored municipality, when they have chosen one. */
  home: string | null;
  isAuthenticated: boolean;
  onPosition: (index: number, stage: number) => void;
}

interface SuggestCopy {
  cardLabel: string;
  kicker: string;
  scope: string;
  headlineLead: string;
  /** The accent half of the headline; the town is inflected per language. */
  headlinePlace: (home: string | null) => string;
  /** Body sentence; `place` names the reader's town or a generic stand-in. */
  body: (place: string) => string;
  /** Stand-in when the reader has chosen no municipality. */
  placeFallback: string;
  createCta: string;
  signUpCta: string;
  foundersLink: string;
  advanceLabel: string;
  advanceAria: string;
  allVotesLink: string;
  /** Direction-semantic arrow: Hebrew ←, English →. */
  arrow: string;
}

const COPY: Record<Locale, SuggestCopy> = {
  he: {
    cardLabel: 'הצעת נושא להצבעה',
    kicker: 'תורכם · YOUR TURN',
    scope: 'הצעת נושא',
    headlineLead: 'מה חסר',
    headlinePlace: (home) => (home ? `ב${home}?` : 'בסדר היום?'),
    body: (place) =>
      'המערכת מאתרת נושאים מהשיח הציבורי, אבל היא לא רואה הכל. אם יש נושא ' +
      `שצריך לעלות להצבעה ${place} או על שולחן הכנסת - העלו אותו, ואנחנו ` +
      'נביא אליו את הספירה.',
    placeFallback: 'ברשות שלכם',
    createCta: 'העלו נושא להצבעה',
    signUpCta: 'פתחו חשבון והעלו נושא',
    foundersLink: 'או ספרו לנו בקבוצת המייסדים ←',
    advanceLabel: 'לא עכשיו · לנושא הבא',
    advanceAria: 'דלגו לנושא הבא',
    allVotesLink: 'לכל ההצבעות ←',
    arrow: '←',
  },
  en: {
    cardLabel: 'Suggest a topic for a vote',
    kicker: 'YOUR TURN',
    scope: 'Topic suggestion',
    headlineLead: "What's missing",
    headlinePlace: (home) => (home ? `in ${home}?` : 'from the agenda?'),
    body: (place) =>
      'The system finds topics in public discourse, but it does not see ' +
      `everything. If a topic should go to a vote ${place} or on the Knesset ` +
      'table, put it up and we will bring the count to it.',
    placeFallback: 'in your municipality',
    createCta: 'Put a topic to a vote',
    signUpCta: 'Open an account and put up a topic',
    foundersLink: 'Or tell us in the founders group →',
    advanceLabel: 'Not now · next topic',
    advanceAria: 'Skip to the next topic',
    allVotesLink: 'To all the votes →',
    arrow: '→',
  },
};

/**
 * The interruption: every few topics the stream stops reporting and asks.
 *
 * A reader who has just formed opinions on five items is the best source of
 * the sixth, so the prompt sits inside the stream rather than in a footer
 * nobody scrolls to. One deck, one decision, then back to the paper.
 */
export function SuggestCard({
  index,
  rootRef,
  locale,
  home,
  isAuthenticated,
  onPosition,
}: SuggestCardProps) {
  const { cardRef, advance } = useDeckStage({ rootRef, index, onPosition });
  const t = COPY[locale === 'en' ? 'en' : 'he'];

  const place = home ?? t.placeFallback;

  return (
    <article
      ref={cardRef}
      className={`${styles.card} ${styles.cardSingle}`}
      aria-label={t.cardLabel}
    >
      <div className={styles.shell}>
        <div className={`${styles.frame} ${styles.frameInvert}`}>
          <header className={styles.cardHead}>
            <span className={`${styles.kicker} ${styles.kickerInvert}`}>
              <span aria-hidden className={styles.kickerTick} />
              {t.kicker}
            </span>
            <span className={styles.scope}>{t.scope}</span>
          </header>

          <div className={styles.ruleHeavy} aria-hidden />

          <section className={`${styles.deck} ${styles.deckStatic}`} data-active>
            <h2 className={styles.headline}>
              {t.headlineLead}{' '}
              <span className={styles.red}>{t.headlinePlace(home)}</span>
            </h2>

            <p className={styles.body}>{t.body(place)}</p>

            <div className={styles.suggestActions}>
              {isAuthenticated ? (
                <NewsButton
                  href={`${localePrefix(locale)}/votes/create`}
                  variant="red"
                  size="lg"
                  trailing={<span aria-hidden>{t.arrow}</span>}
                >
                  {t.createCta}
                </NewsButton>
              ) : (
                <NewsButton
                  href={`${localePrefix(locale)}/sign-up?redirect=${encodeURIComponent(`${localePrefix(locale)}/votes/create`)}`}
                  variant="red"
                  size="lg"
                  trailing={<span aria-hidden>{t.arrow}</span>}
                >
                  {t.signUpCta}
                </NewsButton>
              )}

              <a
                href={WHATSAPP_FOUNDERS_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.textLink}
              >
                {t.foundersLink}
              </a>
            </div>
          </section>

          <footer className={styles.cardFoot}>
            <button
              type="button"
              className={styles.advance}
              onClick={advance}
              aria-label={t.advanceAria}
            >
              <span className={styles.advanceLabel}>{t.advanceLabel}</span>
              <span aria-hidden className={styles.advanceGlyph}>
                ↓
              </span>
            </button>

            <Link href={`${localePrefix(locale)}/votes`} className={styles.textLink}>
              {t.allVotesLink}
            </Link>
          </footer>
        </div>
      </div>

      <div
        data-stop={0}
        className={styles.stop}
        style={{ insetBlockStart: 0 }}
        aria-hidden
      />
    </article>
  );
}
