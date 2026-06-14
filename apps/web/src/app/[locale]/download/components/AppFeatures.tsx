'use client';

import styles from './AppFeatures.module.css';

interface Feature {
  no: string;
  label: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const features: Feature[] = [
  {
    no: '01',
    label: 'LIVE',
    title: 'הצבעות בזמן אמת',
    description:
      'עקבו אחרי תמונת המצב המתעדכנת וקבלו התראה על כל הצבעה חדשה ברשות שלכם.',
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
    title: 'אימות מיקום',
    description:
      'אימות GPS פשוט מבטיח שרק תושבי המקום מצביעים — בלי זיופים, בלי כפילויות.',
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
    title: 'מאומת ובלתי ניתן לזיוף',
    description:
      'כל הצבעה נחתמת ונרשמת בשרשרת ציבורית פתוחה לביקורת — שקיפות מלאה, מקצה לקצה.',
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
    title: 'בעברית, על המובייל',
    description:
      'ממשק נקי ומלא בעברית, מותאם RTL ולכף היד — להשפיע על הקהילה בכמה הקשות.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
        <rect x="7" y="3" width="10" height="18" stroke="currentColor" strokeWidth="2" />
        <path d="M11 18h2" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
      </svg>
    ),
  },
];

export function AppFeatures() {
  return (
    <section
      id="features"
      className={styles.features}
      aria-labelledby="features-headline"
    >
      <div className={styles.inner}>
        {/* Dateline / section head */}
        <div className={styles.head}>
          <span className={`np-kicker ${styles.kicker}`}>מפרט · SPEC SHEET</span>
          <h2 id="features-headline" className={styles.heading}>
            כל מה שצריך כדי שהקול שלכם <span className={styles.red}>ייספר.</span>
          </h2>
          <p className={`np-mono ${styles.standfirst}`}>
            השתתפות בקבלת החלטות מקומיות — מאומתת, שקופה ובקצות האצבעות.
          </p>
        </div>

        <hr className="np-rule-heavy" />

        {/* Mechanical spec list */}
        <ul className={styles.specList}>
          {features.map((feature) => (
            <li key={feature.title} className={styles.spec}>
              <span className={`np-mono ${styles.specNo}`}>{feature.no}</span>

              <span className={styles.specIcon} aria-hidden>
                {feature.icon}
              </span>

              <div className={styles.specBody}>
                <div className={styles.specTitleRow}>
                  <h3 className={styles.specTitle}>{feature.title}</h3>
                  <span className={`np-mono ${styles.specLabel}`}>{feature.label}</span>
                </div>
                <p className={styles.specText}>{feature.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
