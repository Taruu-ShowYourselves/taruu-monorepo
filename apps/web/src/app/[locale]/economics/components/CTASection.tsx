'use client';

import { NewsButton } from '@/components/press';
import type { Locale } from '@/lib/i18n';
import styles from './CTASection.module.css';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';

const WHATSAPP_LINK = WHATSAPP_FOUNDERS_LINK;

interface CTASectionProps {
  locale: Locale;
}

interface CTACopy {
  kicker: string;
  headlineLead: string;
  headlineAccent: string;
  standfirst: string;
  foundersCta: string;
  trustStats: { value: string; label: string }[];
  /** Direction-semantic arrow: Hebrew ←, English →. */
  arrow: string;
}

const COPY: Record<Locale, CTACopy> = {
  he: {
    kicker: 'נפתחים בכל הארץ · 04.08.26',
    headlineLead: 'מוכנים להפוך קול אחד',
    headlineAccent: 'לכוח קהילתי?',
    standfirst:
      'הצטרפו לקהילת התושבים שבונה את הקרן הראשונה. הצטרפות חינם, בלי התחייבות.',
    foundersCta: 'קבוצת המייסדים',
    trustStats: [
      { value: 'חינם', label: 'עלות הצבעה' },
      { value: '70%', label: 'לקרן הקהילתית' },
      { value: 'תעודה', label: 'לכל משתתף' },
    ],
    arrow: '←',
  },
  en: {
    kicker: 'OPENING NATIONWIDE · 04.08.26',
    headlineLead: 'Ready to turn one voice',
    headlineAccent: 'into community power?',
    standfirst:
      'Join the residents building the first fund. Joining is free, with no commitment.',
    foundersCta: 'The founders group',
    trustStats: [
      { value: 'Free', label: 'cost of a vote' },
      { value: '70%', label: 'to the community fund' },
      { value: 'Certificate', label: 'for every participant' },
    ],
    arrow: '→',
  },
};

export function CTASection({ locale }: CTASectionProps) {
  const t = COPY[locale];

  return (
    <section className={styles.cta} aria-labelledby="cta-title">
      <div className={styles.inner}>
        <div className={styles.content}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            {t.kicker}
          </span>

          <h2 id="cta-title" className={styles.headline}>
            {t.headlineLead} <span className={styles.red}>{t.headlineAccent}</span>
          </h2>

          <p className={styles.standfirst}>{t.standfirst}</p>

          <div className={styles.actions}>
            <NewsButton
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              variant="red"
              size="lg"
              trailing={<span aria-hidden>{t.arrow}</span>}
            >
              {t.foundersCta}
            </NewsButton>
          </div>

          <dl className={styles.stats}>
            {t.trustStats.map((stat) => (
              <div key={stat.label} className={styles.statItem}>
                <dt className={styles.statValue}>{stat.value}</dt>
                <dd className={styles.statLabel}>{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
