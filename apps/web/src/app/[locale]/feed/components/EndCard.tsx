'use client';

import Link from 'next/link';
import { NewsButton } from '@/components/press/NewsButton';
import { useDeckStage } from './useDeckStage';
import styles from './Feed.module.css';
import { localePrefix } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';

interface EndCardProps {
  index: number;
  rootRef: React.RefObject<HTMLDivElement | null>;
  locale: string;
  onPosition: (index: number, stage: number) => void;
}

interface EndCardCopy {
  cardLabel: string;
  kicker: string;
  headlineLead: string;
  headlineAccent: string;
  body: string;
  createCta: string;
  archiveLink: string;
  knessetLink: string;
  /** Direction-semantic arrow: Hebrew ←, English →. */
  arrow: string;
}

const COPY: Record<Locale, EndCardCopy> = {
  he: {
    cardLabel: 'סוף המהדורה',
    kicker: 'סוף המהדורה · END OF EDITION',
    headlineLead: 'עברתם על כל מה',
    headlineAccent: 'שפתוח.',
    body:
      'המהדורה מתעדכנת כשנפתחים נושאים חדשים ברשות שלכם ועל שולחן הכנסת. ' +
      'עד אז - הרשומות הסגורות פתוחות לעיון, והנושא הבא יכול להיות שלכם.',
    createCta: 'העלו נושא להצבעה',
    archiveLink: 'לרשומות הסגורות ←',
    knessetLink: 'לסדר היום המלא בכנסת ←',
    arrow: '←',
  },
  en: {
    cardLabel: 'End of edition',
    kicker: 'END OF EDITION',
    headlineLead: "You've been through everything",
    headlineAccent: 'that is open.',
    body:
      'The edition refreshes as new topics open in your municipality and on the ' +
      'Knesset table. Until then the closed records stay open to read, and the ' +
      'next topic could be yours.',
    createCta: 'Put a topic to a vote',
    archiveLink: 'To the closed records →',
    knessetLink: 'To the full Knesset agenda →',
    arrow: '→',
  },
};

/** The colophon of the stream: nothing left open, here is where to go next. */
export function EndCard({ index, rootRef, locale, onPosition }: EndCardProps) {
  const { cardRef } = useDeckStage({ rootRef, index, onPosition });
  const t = COPY[locale === 'en' ? 'en' : 'he'];

  return (
    <article
      ref={cardRef}
      className={`${styles.card} ${styles.cardSingle}`}
      aria-label={t.cardLabel}
    >
      <div className={styles.shell}>
        <div className={styles.frame}>
          <header className={styles.cardHead}>
            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              {t.kicker}
            </span>
          </header>

          <div className={styles.ruleHeavy} aria-hidden />

          <section className={`${styles.deck} ${styles.deckStatic}`} data-active>
            <h2 className={styles.headline}>
              {t.headlineLead} <span className={styles.red}>{t.headlineAccent}</span>
            </h2>

            <p className={styles.body}>{t.body}</p>

            <div className={styles.suggestActions}>
              <NewsButton
                href={`${localePrefix(locale)}/votes/create`}
                variant="red"
                size="lg"
                trailing={<span aria-hidden>{t.arrow}</span>}
              >
                {t.createCta}
              </NewsButton>

              <Link href={`${localePrefix(locale)}/votes/archive`} className={styles.textLink}>
                {t.archiveLink}
              </Link>
              <Link href={`${localePrefix(locale)}/knesset`} className={styles.textLink}>
                {t.knessetLink}
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
