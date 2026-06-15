'use client';

import { NewsButton } from '@/components/press/NewsButton';
import type { Locale } from '@/lib/i18n';
import styles from './HowItWorks.module.css';

const WHATSAPP_LINK = 'https://chat.whatsapp.com/FITvea9IVsn2Ljie1yCrAc';

interface Step {
  no: string;
  title: string;
  body: string;
}

const STEPS: readonly Step[] = [
  {
    no: '01',
    title: 'נרשמים בקלות',
    body: 'אימייל או טלפון, אימות קצר. אתם בפנים.',
  },
  {
    no: '02',
    title: 'רואים מה על הפרק',
    body: 'הצבעות פעילות בקריית טבעון, או מציעים נושא חדש משלכם.',
  },
  {
    no: '03',
    title: 'מצביעים ומאמתים',
    body: 'בוחרים עמדה, מאמתים נוכחות (GPS), ומשתתפים ב-₪3 שנותנים לעמדה גב.',
  },
  {
    no: '04',
    title: 'עוקבים אחרי התוצאה',
    body: 'נתונים בזמן אמת, שמוגשים למועצה כעמדה קהילתית מגובה.',
  },
] as const;

interface HowItWorksProps {
  locale?: Locale;
}

export function HowItWorks({ locale = 'he' }: HowItWorksProps) {
  void locale;

  return (
    <section id="how" className={styles.section} aria-labelledby="how-heading">
      <div className={styles.inner}>
        <header className={styles.head}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            המדריך · HOW IT WORKS
          </span>

          <h2 id="how-heading" className={styles.headline}>
            מהרשמה ועד השפעה — <span className={styles.red}>בארבעה צעדים.</span>
          </h2>
        </header>

        <hr className={styles.ruleHeavy} aria-hidden />

        <ol className={styles.steps}>
          {STEPS.map((step) => (
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
            כל התהליך לוקח פחות מדקה.
          </span>

          <NewsButton
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            variant="red"
            size="md"
            trailing={<span aria-hidden>←</span>}
          >
            קבוצת המייסדים
          </NewsButton>
        </footer>
      </div>
    </section>
  );
}
