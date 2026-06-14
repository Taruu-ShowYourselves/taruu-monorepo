'use client';

import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks';
import styles from './Mission.module.css';

interface Value {
  key: string;
  title: string;
  description: string;
}

const VALUES: Value[] = [
  {
    key: 'transparency',
    title: 'שקיפות מלאה',
    description:
      'כל הצבעה נרשמת בבלוקצ׳יין באופן פומבי ובלתי הפיך. אין חדרים סגורים ואין מקום לזיוף.',
  },
  {
    key: 'security',
    title: 'אבטחה ללא פשרות',
    description:
      'אימות רב-שכבתי מבטיח שכל קול הוא תושב אמיתי אחד — מאומת, ייחודי ובלתי ניתן לערעור.',
  },
  {
    key: 'access',
    title: 'נגישות לכולם',
    description:
      'ממשק פשוט ובהיר שמאפשר לכל תושב להשתתף — בלי קשר לרקע טכנולוגי, מהטלפון, בכמה דקות.',
  },
  {
    key: 'continuous',
    title: 'מדידה מתמשכת',
    description:
      'לא פעם בארבע שנים — אלא בכל יום שיש בו החלטה. תמונת מצב חיה שהמועצה לא יכולה להתעלם ממנה.',
  },
];

export function Mission() {
  const reducedMotion = useReducedMotion();

  return (
    <section className={styles.mission} aria-label="המשימה שלנו">
      <div className={styles.inner}>
        <div className={styles.head}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            המשימה שלנו
          </span>
          <h2 className={styles.headline}>
            למדוד, לאמת ולהנגיש את <span className={styles.red}>עמדת הרוב.</span>
          </h2>
        </div>

        <hr className={styles.ruleHeavy} aria-hidden />

        <div className={styles.body}>
          <div className={styles.columns}>
            <p>
              תַּרְאוּ הוא מנגנון קונצנזוס ציבורי. המטרה פשוטה: למדוד היכן עומד רוב
              הציבור, לאמת שכל קול הוא תושב אמיתי אחד, ולהנגיש את התמונה לכולם —
              בשקיפות מלאה.
            </p>
            <p>
              לא דרך נציגים, אלא ישירות. לא באופן אנונימי, אלא כתושבים מאומתים שקולם
              נשמע ונספר.
            </p>
          </div>

          <aside className={styles.pull}>
            <span className={styles.pullTick} aria-hidden />
            <p className={styles.pullText}>
              לא צעקות בקבוצת הפייסבוק — מספר אחד, מאומת, שהמועצה לא יכולה להתעלם
              ממנו.
            </p>
            <span className={styles.pullMeta}>עיקרון המערכת</span>
          </aside>
        </div>

        <ol className={styles.values}>
          {VALUES.map((value, i) => (
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
