'use client';

import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks';
import type { Locale } from '@/lib/i18n';
import styles from './Mission.module.css';

interface Value {
  key: string;
  title: string;
  description: string;
}

interface MissionCopy {
  ariaLabel: string;
  kicker: string;
  headlineStart: string;
  headlineAccent: string;
  body1: string;
  body2: string;
  pullText: string;
  pullMeta: string;
  values: Value[];
}

const COPY: Record<Locale, MissionCopy> = {
  he: {
    ariaLabel: 'המשימה שלנו',
    kicker: 'המשימה שלנו',
    headlineStart: 'למדוד, לאמת ולהנגיש את',
    headlineAccent: 'עמדת הרוב.',
    body1:
      'תַּרְאוּ היא מנגנון קונצנזוס ציבורי. המטרה פשוטה: למדוד היכן עומד רוב הציבור, לאמת שכל קול הוא תושב אמיתי אחד, ולהנגיש את התמונה לכולם בשקיפות מלאה.',
    body2:
      'לא דרך נציגים, אלא ישירות. לא באופן אנונימי, אלא כתושבים מאומתים שקולם נשמע ונספר.',
    pullText:
      'לא צעקות בקבוצת הפייסבוק. מספר אחד, מאומת, שהמועצה לא יכולה להתעלם ממנו.',
    pullMeta: 'עיקרון המערכת',
    values: [
      {
        key: 'transparency',
        title: 'שקיפות מלאה',
        description:
          'כל הצבעה נרשמת בבלוקצ׳יין באופן פומבי ובלתי הפיך. אין חדרים סגורים ואין מקום לזיוף.',
      },
      {
        key: 'security',
        title: 'אבטחה ואימות',
        description:
          'אימות רב-שכבתי מבטיח שכל קול הוא תושב אמיתי אחד: מאומת, ייחודי ובלתי ניתן לערעור.',
      },
      {
        key: 'access',
        title: 'נגישות לכולם',
        description:
          'ממשק פשוט ובהיר שמאפשר לכל תושב להשתתף מהטלפון, בכמה דקות, בלי קשר לרקע טכנולוגי.',
      },
      {
        key: 'continuous',
        title: 'מדידה מתמשכת',
        description:
          'לא פעם בארבע שנים, אלא בכל יום שיש בו החלטה. תמונת מצב חיה שהמועצה לא יכולה להתעלם ממנה.',
      },
    ],
  },
  en: {
    ariaLabel: 'Our mission',
    kicker: 'Our Mission',
    headlineStart: 'To measure, verify, and open up',
    headlineAccent: 'the position of the majority.',
    body1:
      'Taruu is a public consensus mechanism. The goal is simple: to measure where the majority of the public stands, to verify that every vote is one real resident, and to make the full picture available to everyone in complete transparency.',
    body2:
      'Not through representatives, but directly. Not anonymously, but as verified residents whose voice is heard and counted.',
    pullText:
      'Not shouting in the Facebook group. One number, verified, that the council cannot ignore.',
    pullMeta: 'System principle',
    values: [
      {
        key: 'transparency',
        title: 'Full transparency',
        description:
          'Every vote is recorded on the blockchain, publicly and irreversibly. No closed rooms, and no room for forgery.',
      },
      {
        key: 'security',
        title: 'Security and verification',
        description:
          'Multi-layer verification ensures that every vote is one real resident: verified, unique, and beyond challenge.',
      },
      {
        key: 'access',
        title: 'Accessible to everyone',
        description:
          'A simple, clear interface that lets any resident take part from their phone, in a few minutes, regardless of technical background.',
      },
      {
        key: 'continuous',
        title: 'Continuous measurement',
        description:
          'Not once every four years, but on every day that carries a decision. A live picture the council cannot ignore.',
      },
    ],
  },
};

interface MissionProps {
  locale?: Locale;
}

export function Mission({ locale = 'he' }: MissionProps) {
  const reducedMotion = useReducedMotion();
  const t = COPY[locale];

  return (
    <section className={styles.mission} aria-label={t.ariaLabel}>
      <div className={styles.inner}>
        <div className={styles.head}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            {t.kicker}
          </span>
          <h2 className={styles.headline}>
            {t.headlineStart} <span className={styles.red}>{t.headlineAccent}</span>
          </h2>
        </div>

        <hr className={styles.ruleHeavy} aria-hidden />

        <div className={styles.body}>
          <div className={styles.columns}>
            <p>{t.body1}</p>
            <p>{t.body2}</p>
          </div>

          <aside className={styles.pull}>
            <span className={styles.pullTick} aria-hidden />
            <p className={styles.pullText}>{t.pullText}</p>
            <span className={styles.pullMeta}>{t.pullMeta}</span>
          </aside>
        </div>

        <ol className={styles.values}>
          {t.values.map((value, i) => (
            <motion.li
              key={value.key}
              className={styles.value}
              initial={reducedMotion ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.4, delay: i * 0.08, ease: [0.2, 0, 0, 1] }}
            >
              <span className={styles.valueNum}>{String(i + 1).padStart(2, '0')}</span>
              <div className={styles.valueBody}>
                <h3 className={styles.valueTitle}>{value.title}</h3>
                <p className={styles.valueLine}>{value.description}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
