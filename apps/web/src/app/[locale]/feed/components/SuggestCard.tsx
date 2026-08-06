'use client';

import Link from 'next/link';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';
import { NewsButton } from '@/components/press/NewsButton';
import { useDeckStage } from './useDeckStage';
import styles from './Feed.module.css';
import { localePrefix } from '@/lib/i18n';

interface SuggestCardProps {
  index: number;
  rootRef: React.RefObject<HTMLDivElement | null>;
  locale: string;
  /** The reader's stored municipality, when they have chosen one. */
  home: string | null;
  isAuthenticated: boolean;
  onPosition: (index: number, stage: number) => void;
}

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

  const place = home ?? 'ברשות שלכם';

  return (
    <article
      ref={cardRef}
      className={`${styles.card} ${styles.cardSingle}`}
      aria-label="הצעת נושא להצבעה"
    >
      <div className={styles.shell}>
        <div className={`${styles.frame} ${styles.frameInvert}`}>
          <header className={styles.cardHead}>
            <span className={`${styles.kicker} ${styles.kickerInvert}`}>
              <span aria-hidden className={styles.kickerTick} />
              תורכם · YOUR TURN
            </span>
            <span className={styles.scope}>הצעת נושא</span>
          </header>

          <div className={styles.ruleHeavy} aria-hidden />

          <section className={`${styles.deck} ${styles.deckStatic}`} data-active>
            <h2 className={styles.headline}>
              מה חסר{' '}
              <span className={styles.red}>
                {home ? `ב${home}?` : 'בסדר היום?'}
              </span>
            </h2>

            <p className={styles.body}>
              המערכת מאתרת נושאים מהשיח הציבורי, אבל היא לא רואה הכל. אם יש נושא
              שצריך לעלות להצבעה {place} או על שולחן הכנסת - העלו אותו, ואנחנו
              נביא אליו את הספירה.
            </p>

            <div className={styles.suggestActions}>
              {isAuthenticated ? (
                <NewsButton
                  href={`${localePrefix(locale)}/votes/create`}
                  variant="red"
                  size="lg"
                  trailing={<span aria-hidden>←</span>}
                >
                  העלו נושא להצבעה
                </NewsButton>
              ) : (
                <NewsButton
                  href={`${localePrefix(locale)}/sign-up?redirect=${encodeURIComponent(`${localePrefix(locale)}/votes/create`)}`}
                  variant="red"
                  size="lg"
                  trailing={<span aria-hidden>←</span>}
                >
                  פתחו חשבון והעלו נושא
                </NewsButton>
              )}

              <a
                href={WHATSAPP_FOUNDERS_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.textLink}
              >
                או ספרו לנו בקבוצת המייסדים ←
              </a>
            </div>
          </section>

          <footer className={styles.cardFoot}>
            <button
              type="button"
              className={styles.advance}
              onClick={advance}
              aria-label="דלגו לנושא הבא"
            >
              <span className={styles.advanceLabel}>לא עכשיו · לנושא הבא</span>
              <span aria-hidden className={styles.advanceGlyph}>
                ↓
              </span>
            </button>

            <Link href={`${localePrefix(locale)}/votes`} className={styles.textLink}>
              לכל ההצבעות ←
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
