import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import styles from './CivicReminder.module.css';

interface CivicReminderProps {
  locale?: Locale;
}

export function CivicReminder({ locale = 'he' }: CivicReminderProps) {
  return (
    <section
      className={styles.section}
      aria-labelledby="civic-reminder-headline"
    >
      <div className={styles.inner}>
        <h2 id="civic-reminder-headline" className={styles.headline}>
          אנו כאן כדי להזכיר לממשלה, לרשויות המקומיות ולמועצות האזוריות כי{' '}
          <strong>הן עובדות עבור הציבור.</strong>
        </h2>

        <div className={styles.action}>
          <Link href={`/${locale}/sign-up`} className={styles.cta}>
            לחתימה על האמנה <span aria-hidden>←</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
