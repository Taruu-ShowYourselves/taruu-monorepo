'use client';

import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks';
import type { Locale } from '@/lib/i18n';
import styles from './Technology.module.css';

interface TechGlyph {
  key: string;
  glyph: React.ReactNode;
}

interface TechItem {
  spec: string;
  title: string;
  description: string;
}

interface TechnologyCopy {
  ariaLabel: string;
  kicker: string;
  headlineStart: string;
  headlineAccent: string;
  sub: string;
  items: TechItem[];
}

const TECHNOLOGIES: TechGlyph[] = [
  {
    key: 'location',
    glyph: (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M24 4c8 0 14 6 14 14 0 9-14 26-14 26S10 27 10 18C10 10 16 4 24 4Z" stroke="currentColor" strokeWidth="2.4" fill="none" />
        <circle cx="24" cy="18" r="5" stroke="currentColor" strokeWidth="2.4" fill="none" />
      </svg>
    ),
  },
  {
    key: 'identity',
    glyph: (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <circle cx="24" cy="16" r="8" stroke="currentColor" strokeWidth="2.4" fill="none" />
        <path d="M10 40c0-7.5 6.3-13 14-13s14 5.5 14 13" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <path d="M31 33l3.2 3.2L41 29" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'ledger',
    glyph: (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <rect x="9" y="9" width="13" height="13" stroke="currentColor" strokeWidth="2.2" fill="none" />
        <rect x="26" y="9" width="13" height="13" stroke="currentColor" strokeWidth="2.2" fill="none" />
        <rect x="17.5" y="26" width="13" height="13" stroke="currentColor" strokeWidth="2.2" fill="none" />
        <path d="M22 15.5h4M30 22v4M22 32.5h4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ),
  },
];

const COPY: Record<Locale, TechnologyCopy> = {
  he: {
    ariaLabel: 'הטכנולוגיה',
    kicker: 'הטכנולוגיה',
    headlineStart: 'שלוש שכבות שהופכות קול',
    headlineAccent: 'לאמין.',
    sub: 'שלושה מנגנונים פשוטים שעובדים יחד כדי שכל מספר שתַּרְאוּ מפרסמת יהיה מדויק, הוגן וניתן לבדיקה.',
    items: [
      {
        spec: 'שכבה 01',
        title: 'אימות מיקום',
        description:
          'לפני שמצביעים, המכשיר מאשר שאתם נמצאים בתחום הרשות. כך כל קול שנספר באמת שייך לאנשים שחיים במקום, לא למישהו מבחוץ.',
      },
      {
        spec: 'שכבה 02',
        title: 'זהות מאומתת',
        description:
          'כל משתתף מאומת כתושב אמיתי אחד, פעם אחת בלבד. בלי בוטים, בלי כפילויות ובלי חשבונות מזויפים. קול אחד לכל אדם.',
      },
      {
        spec: 'שכבה 03',
        title: 'רישום בלתי הפיך',
        description:
          'אחרי הספירה, כל הצבעה נחתמת ברשומה ציבורית שאי אפשר לשנות בדיעבד. כל אחד יכול לבדוק שהתוצאה שפורסמה היא בדיוק מה שהתושבים אמרו.',
      },
    ],
  },
  en: {
    ariaLabel: 'The technology',
    kicker: 'The Technology',
    headlineStart: 'Three layers that make a vote',
    headlineAccent: 'credible.',
    sub: 'Three simple mechanisms working together so that every number Taruu publishes is accurate, fair, and open to inspection.',
    items: [
      {
        spec: 'Layer 01',
        title: 'Location verification',
        description:
          'Before you vote, your device confirms you are within the municipality’s boundaries. Every vote that is counted truly belongs to the people who live there, not to someone from outside.',
      },
      {
        spec: 'Layer 02',
        title: 'Verified identity',
        description:
          'Every participant is verified as one real resident, exactly once. No bots, no duplicates, and no fake accounts. One vote per person.',
      },
      {
        spec: 'Layer 03',
        title: 'An irreversible record',
        description:
          'After the count, every vote is sealed into a public record that cannot be changed after the fact. Anyone can check that the published result is exactly what the residents said.',
      },
    ],
  },
};

interface TechnologyProps {
  locale?: Locale;
}

export function Technology({ locale = 'he' }: TechnologyProps) {
  const reducedMotion = useReducedMotion();
  const t = COPY[locale];

  return (
    <section className={styles.technology} aria-label={t.ariaLabel}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            {t.kicker}
          </span>
          <h2 className={styles.headline}>
            {t.headlineStart} <span className={styles.red}>{t.headlineAccent}</span>
          </h2>
          <p className={styles.sub}>{t.sub}</p>
        </div>

        <hr className={styles.ruleHeavy} aria-hidden />

        <ol className={styles.specs}>
          {TECHNOLOGIES.map((tech, i) => (
            <motion.li
              key={tech.key}
              className={styles.spec}
              initial={reducedMotion ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.4, delay: i * 0.08, ease: [0.2, 0, 0, 1] }}
            >
              <span className={styles.specLabel}>{t.items[i].spec}</span>
              <span className={styles.glyph}>{tech.glyph}</span>
              <div className={styles.specBody}>
                <h3 className={styles.specName}>{t.items[i].title}</h3>
                <p className={styles.specLine}>{t.items[i].description}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
