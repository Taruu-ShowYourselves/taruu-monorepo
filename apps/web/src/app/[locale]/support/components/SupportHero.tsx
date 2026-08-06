'use client';

import type { Locale } from '@/lib/i18n';
import styles from './SupportHero.module.css';

interface SupportHeroProps {
  locale?: Locale;
}

interface SupportHeroCopy {
  kicker: string;
  headline: string;
  headlineRed: string;
  standfirst: string;
}

const COPY: Record<Locale, SupportHeroCopy> = {
  he: {
    kicker: 'מרכז התמיכה · אנשים אמיתיים',
    headline: 'יש שאלה?',
    headlineRed: 'יש תשובה.',
    standfirst:
      'כל מה שרציתם לדעת על הצבעה, אימות, כסף ופרטיות, במקום אחד. לא מצאתם? כתבו לנו בוואטסאפ, אנחנו אנשים אמיתיים.',
  },
  en: {
    kicker: 'Support desk · Real people',
    headline: 'Have a question?',
    headlineRed: 'There is an answer.',
    standfirst:
      'Everything you wanted to know about voting, verification, money and privacy, in one place. Did not find it? Write to us on WhatsApp — we are real people.',
  },
};

export function SupportHero({ locale = 'he' }: SupportHeroProps) {
  const t = COPY[locale];
  return (
    <section className={styles.hero}>
      <div className={styles.container}>
        <span className={styles.kicker}>
          <span aria-hidden className={styles.kickerTick} />
          {t.kicker}
        </span>

        <h1 className={styles.headline}>
          {t.headline} <span className={styles.red}>{t.headlineRed}</span>
        </h1>

        <p className={styles.standfirst}>
          {t.standfirst}
        </p>
      </div>
    </section>
  );
}
