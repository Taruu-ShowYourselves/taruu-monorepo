'use client';

import { motion } from 'framer-motion';
import { NewsButton } from '@/components/press';
import { useReducedMotion } from '@/hooks';
import styles from './TreasuryHero.module.css';

const EASE = [0.2, 0, 0, 1] as const;
const WHATSAPP_LINK = 'https://chat.whatsapp.com/FITvea9IVsn2Ljie1yCrAc';

interface Rule {
  no: string;
  title: string;
  text: string;
  icon: React.ReactNode;
}

const RULES: Rule[] = [
  {
    no: '01',
    title: 'שקיפות מלאה',
    text: 'כל הכנסה וכל הוצאה מתועדות בזמן אמת — פתוחות לבדיקה של כל תושב, בלי חדרים סגורים.',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
        <path
          d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    ),
  },
  {
    no: '02',
    title: 'אישור הקהילה',
    text: 'הוצאות מעל סף מסוים אינן יוצאות לדרך ללא הצבעת אישור של הקהילה. הרוב מחליט גם על ההוצאה.',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
        <path
          d="M9 12.5l2.2 2.2L15.5 10"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 3l7 3v5c0 4.4-2.9 7.9-7 9-4.1-1.1-7-4.6-7-9V6l7-3Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    no: '03',
    title: 'ביקורת עצמאית',
    text: 'הקרן עוברת ביקורת חשבונאית עצמאית מדי שנה — גורם חיצוני שמאמת שכל שקל במקומו.',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
        <path
          d="M7 4h7l4 4v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="M13 4v4h4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path
          d="M9 13l1.8 1.8L14.5 11"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export function TreasuryHero() {
  const reduced = useReducedMotion();

  return (
    <section className={styles.hero} aria-labelledby="treasury-hero-title">
      <div className={styles.container}>
        <header className={styles.head}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            שקיפות הקרן · עמוד כלכלה
          </span>

          <h2 id="treasury-hero-title" className={styles.headline}>
            כל שקל בקרן — <span className={styles.red}>גלוי לעין.</span>
          </h2>

          <p className={styles.standfirst}>
            הקרן הקהילתית פתוחה לבדיקה: כל הכנסה וכל הוצאה מתועדות בזמן אמת. הוצאות
            מעל סף מסוים דורשות אישור הקהילה, והקרן עוברת ביקורת חשבונאית עצמאית.
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
              הצטרפו לפיילוט
            </NewsButton>
            <span className={styles.dateline}>קריית טבעון · גיליון כלכלה</span>
          </div>
        </header>

        <span className={styles.rulesHead}>הקרן עומדת על שלושה עקרונות</span>
        <ul className={styles.rules}>
          {RULES.map((rule, i) => (
            <motion.li
              key={rule.title}
              className={styles.rule}
              initial={reduced ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.4, ease: EASE, delay: 0.06 * i }}
            >
              <span className={styles.ruleNo}>{rule.no}</span>
              <span className={styles.ruleIcon}>{rule.icon}</span>
              <h3 className={styles.ruleTitle}>{rule.title}</h3>
              <p className={styles.ruleText}>{rule.text}</p>
            </motion.li>
          ))}
        </ul>

        <p className={styles.trust}>
          <span className={styles.trustMark} aria-hidden>
            ₪
          </span>
          הכסף שלכם נשאר בקהילה — ואתם רואים בדיוק לאן הוא הולך.
        </p>
      </div>
    </section>
  );
}
