'use client';

import { NewsButton } from '@/components/press';
import type { Locale } from '@/lib/i18n';
import styles from './AboutCTA.module.css';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';

const WHATSAPP_LINK = WHATSAPP_FOUNDERS_LINK;

interface AboutCTAProps {
  locale?: Locale;
}

export function AboutCTA(_props: AboutCTAProps) {
  return (
    <section id="join" className={styles.cta} aria-label="קבוצת המייסדים">
      <div className={styles.inner}>
        <div className={styles.dateline}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            הצטרפו עכשיו
          </span>
          <span className={styles.meta}>גיליון ההשקה · כל הארץ</span>
        </div>

        <hr className={styles.rule} aria-hidden />

        <h2 className={styles.headline}>
          הקול שלכם <span className={styles.red}>ייספר.</span>
        </h2>

        <p className={styles.sub}>
          ההצבעה הראשונה נפתחת 04.08.26, בכל הארץ בבת אחת. הצטרפו לקבוצת
          המייסדים לפני הפתיחה.
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
          <span className={styles.microcopy}>
            האפליקציה תהיה זמינה ב-App Store ו-Google Play לקראת ההצבעה הראשונה.
          </span>
        </div>
      </div>
    </section>
  );
}
