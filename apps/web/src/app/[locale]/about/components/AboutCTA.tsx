'use client';

import { NewsButton } from '@/components/press';
import type { Locale } from '@/lib/i18n';
import styles from './AboutCTA.module.css';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';

const WHATSAPP_LINK = WHATSAPP_FOUNDERS_LINK;

interface AboutCTACopy {
  ariaLabel: string;
  kicker: string;
  meta: string;
  headlineStart: string;
  headlineAccent: string;
  sub: string;
  ctaLabel: string;
  ctaGlyph: string;
  microcopy: string;
}

const COPY: Record<Locale, AboutCTACopy> = {
  he: {
    ariaLabel: 'קבוצת המייסדים',
    kicker: 'הצטרפו עכשיו',
    meta: 'גיליון ההשקה · כל הארץ',
    headlineStart: 'הקול שלכם',
    headlineAccent: 'ייספר.',
    sub: 'ההצבעה הראשונה נפתחת 04.08.26, בכל הארץ בבת אחת. הצטרפו לקבוצת המייסדים לפני הפתיחה.',
    ctaLabel: 'קבוצת המייסדים',
    ctaGlyph: '←',
    microcopy: 'האפליקציה תהיה זמינה ב-App Store ו-Google Play לקראת ההצבעה הראשונה.',
  },
  en: {
    ariaLabel: 'The founders group',
    kicker: 'Join Now',
    meta: 'Launch Edition · Nationwide',
    headlineStart: 'Your voice',
    headlineAccent: 'will be counted.',
    sub: 'The first vote opens on 04.08.26, nationwide at once. Join the founders group before it opens.',
    ctaLabel: 'The Founders Group',
    ctaGlyph: '→',
    microcopy: 'The app will be available on the App Store and Google Play ahead of the first vote.',
  },
};

interface AboutCTAProps {
  locale?: Locale;
}

export function AboutCTA({ locale = 'he' }: AboutCTAProps) {
  const t = COPY[locale];

  return (
    <section id="join" className={styles.cta} aria-label={t.ariaLabel}>
      <div className={styles.inner}>
        <div className={styles.dateline}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            {t.kicker}
          </span>
          <span className={styles.meta}>{t.meta}</span>
        </div>

        <hr className={styles.rule} aria-hidden />

        <h2 className={styles.headline}>
          {t.headlineStart} <span className={styles.red}>{t.headlineAccent}</span>
        </h2>

        <p className={styles.sub}>{t.sub}</p>

        <div className={styles.actions}>
          <NewsButton
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            variant="red"
            size="lg"
            trailing={<span aria-hidden>{t.ctaGlyph}</span>}
          >
            {t.ctaLabel}
          </NewsButton>
          <span className={styles.microcopy}>{t.microcopy}</span>
        </div>
      </div>
    </section>
  );
}
