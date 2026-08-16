'use client';

import type { Locale } from '@/lib/i18n';
import styles from './AppFeatures.module.css';

interface AppFeaturesProps {
  locale?: Locale;
}

interface FeatureMeta {
  no: string;
  label: string;
  icon: React.ReactNode;
}

interface FeatureCopy {
  title: string;
  description: string;
}

interface AppFeaturesCopy {
  kicker: string;
  heading: string;
  headingRed: string;
  standfirst: string;
  features: FeatureCopy[];
}

const COPY: Record<Locale, AppFeaturesCopy> = {
  he: {
    kicker: 'מפרט · SPEC SHEET',
    heading: 'כל מה שצריך כדי שהקול שלכם',
    headingRed: 'ייספר.',
    standfirst: 'השתתפות בקבלת החלטות מקומיות - מאומתת, שקופה ובקצות האצבעות.',
    features: [
      {
        title: 'הצבעות בזמן אמת',
        description:
          'עקבו אחרי תמונת המצב המתעדכנת וקבלו התראה על כל הצבעה חדשה ברשות שלכם.',
      },
      {
        title: 'אימות מיקום',
        description:
          'אימות GPS פשוט מבטיח שרק תושבי המקום מצביעים - בלי זיופים, בלי כפילויות.',
      },
      {
        title: 'מאומת ובלתי ניתן לזיוף',
        description:
          'כל הצבעה נחתמת ונרשמת בשרשרת ציבורית פתוחה לביקורת - שקיפות מלאה, מקצה לקצה.',
      },
      {
        title: 'בעברית, על המובייל',
        description:
          'ממשק נקי ומלא בעברית, מותאם RTL ולכף היד - להשפיע על הקהילה בכמה הקשות.',
      },
    ],
  },
  en: {
    kicker: 'The specification · SPEC SHEET',
    heading: 'Everything it takes for your voice to',
    headingRed: 'count.',
    standfirst: 'Taking part in local decisions - verified, transparent and at your fingertips.',
    features: [
      {
        title: 'Votes in real time',
        description:
          'Follow the picture as it updates and get an alert for every new vote in your municipality.',
      },
      {
        title: 'Location verification',
        description:
          'Simple GPS verification ensures only local residents vote - no fakes, no duplicates.',
      },
      {
        title: 'Verified and tamper-proof',
        description:
          'Every vote is signed and recorded on a public chain open to audit - full transparency, end to end.',
      },
      {
        title: 'In Hebrew, on mobile',
        description:
          'A clean, fully Hebrew interface, built for RTL and for the palm of your hand - shape your community in a few taps.',
      },
    ],
  },
};

const FEATURE_META: FeatureMeta[] = [
  {
    no: '01',
    label: 'LIVE',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
        <path
          d="M5 19V11M12 19V5M19 19v-6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="square"
        />
      </svg>
    ),
  },
  {
    no: '02',
    label: 'GPS',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
        <path
          d="M12 2 4 9v13h16V9L12 2Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="miter"
        />
        <rect x="9" y="12" width="6" height="6" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    no: '03',
    label: 'CHAIN',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
        <path
          d="M12 3l8 3v6c0 4.5-3.5 7.5-8 9-4.5-1.5-8-4.5-8-9V6l8-3Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="miter"
        />
        <path
          d="M9 12l2 2 4-4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      </svg>
    ),
  },
  {
    no: '04',
    label: 'RTL',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
        <rect x="7" y="3" width="10" height="18" stroke="currentColor" strokeWidth="2" />
        <path d="M11 18h2" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
      </svg>
    ),
  },
];

export function AppFeatures({ locale = 'he' }: AppFeaturesProps) {
  const t = COPY[locale];
  return (
    <section
      id="features"
      className={styles.features}
      aria-labelledby="features-headline"
    >
      <div className={styles.inner}>
        {/* Dateline / section head */}
        <div className={styles.head}>
          <span className={`np-kicker ${styles.kicker}`}>{t.kicker}</span>
          <h2 id="features-headline" className={styles.heading}>
            {t.heading} <span className={styles.red}>{t.headingRed}</span>
          </h2>
          <p className={`np-mono ${styles.standfirst}`}>
            {t.standfirst}
          </p>
        </div>

        <hr className="np-rule-heavy" />

        {/* Mechanical spec list */}
        <ul className={styles.specList}>
          {FEATURE_META.map((feature, i) => (
            <li key={feature.no} className={styles.spec}>
              <span className={`np-mono ${styles.specNo}`}>{feature.no}</span>

              <span className={styles.specIcon} aria-hidden>
                {feature.icon}
              </span>

              <div className={styles.specBody}>
                <div className={styles.specTitleRow}>
                  <h3 className={styles.specTitle}>{t.features[i]?.title}</h3>
                  <span className={`np-mono ${styles.specLabel}`}>{feature.label}</span>
                </div>
                <p className={styles.specText}>{t.features[i]?.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
