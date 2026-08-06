'use client';

import Link from 'next/link';
import { useParallaxBackdrop } from '@/hooks';
import type { Locale } from '@/lib/i18n';
import styles from './CivicReminder.module.css';

interface CivicReminderProps {
  locale?: Locale;
}

export function CivicReminder({ locale = 'he' }: CivicReminderProps) {
  // Shallow drift: the section is half a viewport tall, so the ghost numeral
  // only has room to move a little before it reads as sliding rather than
  // sitting further back than the headline.
  const sectionRef = useParallaxBackdrop<HTMLElement>({ back: -0.04, fore: 0.1 });

  return (
    <section
      ref={sectionRef}
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
