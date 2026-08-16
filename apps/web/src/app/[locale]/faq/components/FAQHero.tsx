'use client';

import type { Locale } from '@/lib/i18n';
import styles from './FAQHero.module.css';

interface FAQHeroCopy {
  kicker: string;
  headlineStart: string;
  headlineAccent: string;
  standfirst: string;
}

const COPY: Record<Locale, FAQHeroCopy> = {
  he: {
    kicker: 'מרכז העזרה · שאלות ותשובות',
    headlineStart: 'יש שאלה?',
    headlineAccent: 'יש תשובה.',
    standfirst: 'כל מה שרציתם לדעת על הצבעה, אימות, כסף ופרטיות, במקום אחד.',
  },
  en: {
    kicker: 'Help Center · Questions and Answers',
    headlineStart: 'Have a question?',
    headlineAccent: 'There is an answer.',
    standfirst: 'Everything you wanted to know about voting, verification, money, and privacy, in one place.',
  },
};

interface FAQHeroProps {
  locale?: Locale;
}

export function FAQHero({ locale = 'he' }: FAQHeroProps) {
  const t = COPY[locale];

  return (
    <section className={styles.hero}>
      <div className={styles.container}>
        <span className={styles.kicker}>
          <span aria-hidden className={styles.kickerTick} />
          {t.kicker}
        </span>

        <h1 className={styles.headline}>
          {t.headlineStart} <span className={styles.red}>{t.headlineAccent}</span>
        </h1>

        <p className={styles.standfirst}>{t.standfirst}</p>
      </div>
    </section>
  );
}
