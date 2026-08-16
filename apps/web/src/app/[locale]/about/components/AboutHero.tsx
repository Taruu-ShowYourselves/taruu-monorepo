'use client';

import type { Locale } from '@/lib/i18n';
import styles from './AboutHero.module.css';

interface AboutHeroCopy {
  ariaLabel: string;
  kicker: string;
  meta: string;
  headlineTop: string;
  headlineAccent: string;
  lead: string;
}

const COPY: Record<Locale, AboutHeroCopy> = {
  he: {
    ariaLabel: 'אודות תַּרְאוּ',
    kicker: 'אודות · המניפסט',
    meta: 'גיליון המערכת · כל הארץ',
    headlineTop: 'מקולה של עיר,',
    headlineAccent: 'לקולה של מדינה.',
    lead: 'התחלנו מהבנה אחת: לדמוקרטיה המקומית אין כלי מדידה אמין. אנחנו בונים את התשתית שהופכת את הקול של הרוב למדיד, מאומת ושקוף, עיר אחר עיר.',
  },
  en: {
    ariaLabel: 'About Taruu',
    kicker: 'About · The Manifesto',
    meta: 'Editorial Edition · Nationwide',
    headlineTop: 'From the voice of a city,',
    headlineAccent: 'to the voice of a nation.',
    lead: 'We started from a single understanding: local democracy has no reliable instrument of measurement. We are building the infrastructure that makes the voice of the majority measurable, verified, and transparent, city by city.',
  },
};

interface AboutHeroProps {
  locale?: Locale;
}

export function AboutHero({ locale = 'he' }: AboutHeroProps) {
  const t = COPY[locale];

  return (
    <section className={styles.hero} aria-label={t.ariaLabel}>
      <div className={styles.inner}>
        <div className={styles.dateline}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            {t.kicker}
          </span>
          <span className={styles.meta}>{t.meta}</span>
        </div>

        <hr className={styles.ruleHeavy} aria-hidden />

        <h1 className={styles.headline}>
          {t.headlineTop}
          <br />
          <span className={styles.red}>{t.headlineAccent}</span>
        </h1>

        <hr className={styles.rule} aria-hidden />

        <p className={`${styles.lead} np-dropcap`}>{t.lead}</p>
      </div>
    </section>
  );
}
