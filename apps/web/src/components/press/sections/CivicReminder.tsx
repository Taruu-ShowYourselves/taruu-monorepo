import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import styles from './CivicReminder.module.css';
import { localePrefix } from '@/lib/i18n';

interface CivicReminderProps {
  locale?: Locale;
}

interface CivicReminderCopy {
  headline: string;
  headlineStrong: string;
  cta: string;
  arrow: string;
}

const COPY: Record<Locale, CivicReminderCopy> = {
  he: {
    headline: 'אנו כאן כדי להזכיר לממשלה, לרשויות המקומיות ולמועצות האזוריות כי',
    headlineStrong: 'הן עובדות עבור הציבור.',
    cta: 'אני אזרח ורוצה להשתתף',
    arrow: '←',
  },
  en: {
    headline: 'We are here to remind the government, the municipalities, and the regional councils that',
    headlineStrong: 'they work for the public.',
    cta: 'Sign the charter',
    arrow: '→',
  },
};

export function CivicReminder({ locale = 'he' }: CivicReminderProps) {
  const t = COPY[locale];
  return (
    <section
      className={styles.section}
      aria-labelledby="civic-reminder-headline"
    >
      <div className={styles.inner}>
        <h2 id="civic-reminder-headline" className={styles.headline}>
          {t.headline}{' '}
          <strong>{t.headlineStrong}</strong>
        </h2>

        <div className={styles.action}>
          <Link href={`${localePrefix(locale)}/sign-up`} className={styles.cta}>
            {t.cta} <span aria-hidden>{t.arrow}</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
