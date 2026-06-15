'use client';

import { NewsButton } from '@/components/press';
import type { Locale } from '@/lib/i18n';
import styles from './AboutCTA.module.css';

const WHATSAPP_LINK = 'https://chat.whatsapp.com/FITvea9IVsn2Ljie1yCrAc';

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
          <span className={styles.meta}>גיליון הפיילוט · קריית טבעון</span>
        </div>

        <hr className={styles.rule} aria-hidden />

        <h2 className={styles.headline}>
          הגיע הזמן שהקול שלכם <span className={styles.red}>ייספר.</span>
        </h2>

        <p className={styles.sub}>
          הצטרפו לתושבים שכבר מעצבים את העתיד של הקהילה שלהם — לפני שההצבעה
          הראשונה יוצאת לדרך.
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
