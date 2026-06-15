'use client';

import { NewsButton } from '@/components/press';
import type { Locale } from '@/lib/i18n';
import styles from './CTASection.module.css';

const WHATSAPP_LINK = 'https://chat.whatsapp.com/FITvea9IVsn2Ljie1yCrAc';

interface CTASectionProps {
  locale: Locale;
}

const trustStats = [
  { value: '₪3', label: 'עלות הצבעה' },
  { value: '70%', label: 'לקרן הקהילתית' },
  { value: 'תעודה', label: 'לכל משתתף' },
];

export function CTASection(_props: CTASectionProps) {
  void _props;

  return (
    <section className={styles.cta} aria-labelledby="cta-title">
      <div className={styles.inner}>
        <div className={styles.content}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            פיילוט חי · קריית טבעון
          </span>

          <h2 id="cta-title" className={styles.headline}>
            מוכנים להפוך 3 שקלים <span className={styles.red}>לכוח קהילתי?</span>
          </h2>

          <p className={styles.standfirst}>
            הצטרפו לקהילת התושבים שבונה את הקרן הראשונה. הצטרפות חינם, בלי התחייבות.
          </p>

          <div className={styles.actions}>
            <NewsButton
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              variant="red"
              size="lg"
              trailing={<span aria-hidden>←</span>}
            >
              קבוצת המייסדים
            </NewsButton>
          </div>

          <dl className={styles.stats}>
            {trustStats.map((stat) => (
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
