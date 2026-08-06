'use client';

import { NewsButton } from '@/components/press/NewsButton';
import type { Locale } from '@/lib/i18n';
import styles from './HowItWorks.module.css';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';

const WHATSAPP_LINK = WHATSAPP_FOUNDERS_LINK;

interface Step {
  no: string;
  title: string;
  body: string;
}

interface HowItWorksCopy {
  kicker: string;
  headline: string;
  headlineRed: string;
  steps: readonly Step[];
  microcopy: string;
  cta: string;
  arrow: string;
}

const COPY: Record<Locale, HowItWorksCopy> = {
  he: {
    kicker: 'המדריך · HOW IT WORKS',
    headline: 'מהרשמה ועד השפעה:',
    headlineRed: 'ארבעה צעדים.',
    steps: [
      {
        no: '01',
        title: 'נרשמים בקלות',
        body: 'אימייל או טלפון, אימות קצר. אתם בפנים.',
      },
      {
        no: '02',
        title: 'רואים מה על הפרק',
        body: 'הצבעות פעילות ברשות שלכם, או מציעים נושא חדש משלכם.',
      },
      {
        no: '03',
        title: 'מצביעים ומאמתים',
        body: 'בוחרים עמדה, מאמתים נוכחות (GPS), ומצביעים. חינם.',
      },
      {
        no: '04',
        title: 'עוקבים אחרי התוצאה',
        body: 'נתונים בזמן אמת, שמוגשים למועצה כעמדה קהילתית מגובה.',
      },
    ],
    microcopy: 'כל התהליך לוקח פחות מדקה.',
    cta: 'קבוצת המייסדים',
    arrow: '←',
  },
  en: {
    kicker: 'THE GUIDE · HOW IT WORKS',
    headline: 'From sign-up to impact:',
    headlineRed: 'four steps.',
    steps: [
      {
        no: '01',
        title: 'Sign up easily',
        body: 'Email or phone, one short verification. You are in.',
      },
      {
        no: '02',
        title: 'See what is on the agenda',
        body: 'Active votes in your municipality, or propose a new topic of your own.',
      },
      {
        no: '03',
        title: 'Vote and verify',
        body: 'Pick a position, verify presence (GPS), and cast your vote. Free.',
      },
      {
        no: '04',
        title: 'Follow the result',
        body: 'Real-time numbers, submitted to the council as a substantiated community position.',
      },
    ],
    microcopy: 'The whole process takes less than a minute.',
    cta: 'The founders group',
    arrow: '→',
  },
};

interface HowItWorksProps {
  locale?: Locale;
}

export function HowItWorks({ locale = 'he' }: HowItWorksProps) {
  const t = COPY[locale];

  return (
    <section id="how" className={styles.section} aria-labelledby="how-heading">
      <div className={styles.inner}>
        <header className={styles.head}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            {t.kicker}
          </span>

          <h2 id="how-heading" className={styles.headline}>
            {t.headline} <span className={styles.red}>{t.headlineRed}</span>
          </h2>
        </header>

        <hr className={styles.ruleHeavy} aria-hidden />

        <ol className={styles.steps}>
          {t.steps.map((step) => (
            <li key={step.no} className={styles.step}>
              <span className={styles.stepNo} aria-hidden>
                {step.no}
              </span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepBody}>{step.body}</p>
            </li>
          ))}
        </ol>

        <hr className={styles.ruleHair} aria-hidden />

        <footer className={styles.foot}>
          <span className={styles.microcopy}>
            <span aria-hidden className={styles.footTick} />
            {t.microcopy}
          </span>

          <NewsButton
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            variant="red"
            size="md"
            trailing={<span aria-hidden>{t.arrow}</span>}
          >
            {t.cta}
          </NewsButton>
        </footer>
      </div>
    </section>
  );
}
