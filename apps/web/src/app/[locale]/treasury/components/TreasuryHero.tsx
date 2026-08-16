'use client';

import { motion } from 'framer-motion';
import { NewsButton } from '@/components/press';
import { useReducedMotion } from '@/hooks';
import type { Locale } from '@/lib/i18n';
import styles from './TreasuryHero.module.css';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';

const EASE = [0.2, 0, 0, 1] as const;
const WHATSAPP_LINK = WHATSAPP_FOUNDERS_LINK;

interface RuleMeta {
  no: string;
  icon: React.ReactNode;
}

const RULES: RuleMeta[] = [
  {
    no: '01',
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

interface TreasuryHeroProps {
  locale?: Locale;
}

interface TreasuryHeroCopy {
  kicker: string;
  headline: string;
  headlineRed: string;
  standfirst: string;
  foundersCta: string;
  arrow: string;
  dateline: string;
  rulesHead: string;
  rules: { title: string; text: string }[];
  trust: string;
}

const COPY: Record<Locale, TreasuryHeroCopy> = {
  he: {
    kicker: 'שקיפות הקרן · עמוד כלכלה',
    headline: 'כל שקל בקרן',
    headlineRed: 'גלוי לעין.',
    standfirst:
      'הקרן הקהילתית פתוחה לבדיקה: כל הכנסה וכל הוצאה מתועדות בזמן אמת. הוצאות מעל סף מסוים דורשות אישור הקהילה, והקרן עוברת ביקורת חשבונאית עצמאית.',
    foundersCta: 'קבוצת המייסדים',
    arrow: '←',
    dateline: 'כל הארץ · גיליון כלכלה',
    rulesHead: 'הקרן עומדת על שלושה עקרונות',
    rules: [
      {
        title: 'שקיפות מלאה',
        text: 'כל הכנסה וכל הוצאה מתועדות בזמן אמת ופתוחות לבדיקה של כל תושב, בלי חדרים סגורים.',
      },
      {
        title: 'אישור הקהילה',
        text: 'הוצאות מעל סף מסוים אינן יוצאות לדרך ללא הצבעת אישור של הקהילה. הרוב מחליט גם על ההוצאה.',
      },
      {
        title: 'ביקורת עצמאית',
        text: 'הקרן עוברת ביקורת חשבונאית עצמאית מדי שנה: גורם חיצוני מאמת שכל שקל במקומו.',
      },
    ],
    trust: 'הכסף נשאר בקהילה, ואתם רואים בדיוק לאן הוא הולך.',
  },
  en: {
    kicker: 'Treasury transparency · Economics page',
    headline: 'Every shekel in the fund,',
    headlineRed: 'in plain sight.',
    standfirst:
      'The community fund is open for inspection: every deposit and every expense is recorded in real time. Expenses above a set threshold require community approval, and the fund undergoes an independent accounting audit.',
    foundersCta: 'The founders’ group',
    arrow: '→',
    dateline: 'Nationwide · Economics edition',
    rulesHead: 'The fund stands on three principles',
    rules: [
      {
        title: 'Full transparency',
        text: 'Every deposit and every expense is recorded in real time and open to inspection by any resident, with no closed rooms.',
      },
      {
        title: 'Community approval',
        text: 'Expenses above a set threshold do not go ahead without an approval vote by the community. The majority decides the spending, too.',
      },
      {
        title: 'Independent audit',
        text: 'The fund undergoes an independent accounting audit every year: an outside party verifies that every shekel is where it should be.',
      },
    ],
    trust: 'The money stays in the community, and you see exactly where it goes.',
  },
};

export function TreasuryHero({ locale = 'he' }: TreasuryHeroProps) {
  const reduced = useReducedMotion();
  const t = COPY[locale];

  return (
    <section className={styles.hero} aria-labelledby="treasury-hero-title">
      <div className={styles.container}>
        <header className={styles.head}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            {t.kicker}
          </span>

          <h2 id="treasury-hero-title" className={styles.headline}>
            {t.headline} <span className={styles.red}>{t.headlineRed}</span>
          </h2>

          <p className={styles.standfirst}>
            {t.standfirst}
          </p>

          <div className={styles.actions}>
            <NewsButton
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              variant="red"
              size="lg"
              trailing={<span aria-hidden>{t.arrow}</span>}
            >
              {t.foundersCta}
            </NewsButton>
            <span className={styles.dateline}>{t.dateline}</span>
          </div>
        </header>

        <span className={styles.rulesHead}>{t.rulesHead}</span>
        <ul className={styles.rules}>
          {RULES.map((rule, i) => (
            <motion.li
              key={t.rules[i].title}
              className={styles.rule}
              initial={reduced ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.4, ease: EASE, delay: 0.06 * i }}
            >
              <span className={styles.ruleNo}>{rule.no}</span>
              <span className={styles.ruleIcon}>{rule.icon}</span>
              <h3 className={styles.ruleTitle}>{t.rules[i].title}</h3>
              <p className={styles.ruleText}>{t.rules[i].text}</p>
            </motion.li>
          ))}
        </ul>

        <p className={styles.trust}>
          <span className={styles.trustMark} aria-hidden>
            ₪
          </span>
          {t.trust}
        </p>
      </div>
    </section>
  );
}
