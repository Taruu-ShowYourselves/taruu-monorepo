'use client';

import Link from 'next/link';
import { NewsButton } from '@/components/press/NewsButton';
import { useDeckStage } from './useDeckStage';
import styles from './Feed.module.css';
import { localePrefix } from '@/lib/i18n';

interface EndCardProps {
  index: number;
  rootRef: React.RefObject<HTMLDivElement | null>;
  locale: string;
  onPosition: (index: number, stage: number) => void;
}

/** The colophon of the stream: nothing left open, here is where to go next. */
export function EndCard({ index, rootRef, locale, onPosition }: EndCardProps) {
  const { cardRef } = useDeckStage({ rootRef, index, onPosition });

  return (
    <article
      ref={cardRef}
      className={`${styles.card} ${styles.cardSingle}`}
      aria-label="סוף המהדורה"
    >
      <div className={styles.shell}>
        <div className={styles.frame}>
          <header className={styles.cardHead}>
            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              סוף המהדורה · END OF EDITION
            </span>
          </header>

          <div className={styles.ruleHeavy} aria-hidden />

          <section className={`${styles.deck} ${styles.deckStatic}`} data-active>
            <h2 className={styles.headline}>
              עברתם על כל מה <span className={styles.red}>שפתוח.</span>
            </h2>

            <p className={styles.body}>
              המהדורה מתעדכנת כשנפתחים נושאים חדשים ברשות שלכם ועל שולחן הכנסת.
              עד אז - הרשומות הסגורות פתוחות לעיון, והנושא הבא יכול להיות שלכם.
            </p>

            <div className={styles.suggestActions}>
              <NewsButton
                href={`${localePrefix(locale)}/votes/create`}
                variant="red"
                size="lg"
                trailing={<span aria-hidden>←</span>}
              >
                העלו נושא להצבעה
              </NewsButton>

              <Link href={`${localePrefix(locale)}/votes/archive`} className={styles.textLink}>
                לרשומות הסגורות ←
              </Link>
              <Link href={`${localePrefix(locale)}/knesset`} className={styles.textLink}>
                לסדר היום המלא בכנסת ←
              </Link>
            </div>
          </section>
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
