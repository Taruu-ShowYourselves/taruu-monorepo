import type { Locale } from '@/lib/i18n';
import styles from './WhatIsTaruu.module.css';

interface WhatIsTaruuProps {
  locale?: Locale;
}

/**
 * One run of the lede. A paragraph set entirely in red is a paragraph with no
 * emphasis left to give, so the charge is spent on three phrases and the rest
 * is printed in ink.
 *
 * `mark` is the diagnosis - what is wrong, in red. `strong` is the mechanism
 * behind it: ink, but underscored in red so the eye still catches it on the
 * way past. Everything else is plain body text.
 */
interface LedeRun {
  readonly text: string;
  readonly tone?: 'mark' | 'strong';
}

interface WhatIsTaruuCopy {
  editionLine: string;
  editionEcho: string;
  headline: string;
  authoritiesLabel: string;
  authorities: { number: string; title: string; role: string }[];
  lede: readonly LedeRun[];
  mechanismLabel: string;
  mechanism: { number: string; title: string; body: string }[];
}

const COPY: Record<Locale, WhatIsTaruuCopy> = {
  he: {
    editionLine: 'למה תַּרְאוּ? · מנגנון אזרחי מסייע החלטה',
    editionEcho: 'PUBLIC BALANCE / CIVIC DECISION SUPPORT',
    headline: 'שלוש רשויות מאזנות אחת את השנייה.',
    authoritiesLabel: 'שלוש רשויות השלטון',
    authorities: [
      { number: '01', title: 'הכנסת', role: 'מחוקקת ומפקחת.' },
      { number: '02', title: 'הממשלה', role: 'מבצעת.' },
      { number: '03', title: 'בתי המשפט', role: 'מפרשים את הדין ומכריעים בסכסוכים.' },
    ],
    lede: [
      { text: 'תהליכי הרשויות ' },
      { text: 'ארוכים, איטיים, בזבזניים ומסורבלים', tone: 'mark' },
      { text: '. מפלגות פרלמנטריות מכניסות ' },
      { text: 'שיקולים מנותקי אזרח', tone: 'strong' },
      { text: ' לתמונה, שמבלבלים ומסבכים את העשייה הפוליטית והציבורית. בשנים האחרונות אנו רואים כיצד ממשלות, רשויות ומועצות מקומיות מנצלות תהליך זה לרעה, כמדיניות של ' },
      { text: 'סחבת והסחת דעת', tone: 'mark' },
      { text: '.' },
    ],
    mechanismLabel: 'כך עובד מנגנון תראו',
    mechanism: [
      { number: '01', title: 'מגבשים', body: 'את הנושאים הדורשים הכרעה ציבורית.' },
      { number: '02', title: 'מאמתים', body: 'כל קול שייך לאדם אמיתי אחד.' },
      { number: '03', title: 'מכריעים', body: 'עמדה אזרחית גלויה שאי אפשר להסיט הצדה.' },
    ],
  },
  en: {
    editionLine: 'Why Taruu? · A civic decision-support mechanism',
    editionEcho: 'איזון ציבורי / מנגנון אזרחי מסייע החלטה',
    headline: 'Three branches balance one another.',
    authoritiesLabel: 'The three branches of government',
    authorities: [
      { number: '01', title: 'The Knesset', role: 'Legislates and oversees.' },
      { number: '02', title: 'The Government', role: 'Executes.' },
      { number: '03', title: 'The Courts', role: 'Interpret the law and settle disputes.' },
    ],
    lede: [
      { text: 'The branches’ processes are ' },
      { text: 'long, slow, wasteful, and cumbersome', tone: 'mark' },
      { text: '. Parliamentary parties add ' },
      { text: 'considerations detached from the citizen', tone: 'strong' },
      { text: ', muddying and complicating political and public action. In recent years we have watched governments, authorities, and local councils abuse that process as a policy of ' },
      { text: 'delay and distraction', tone: 'mark' },
      { text: '.' },
    ],
    mechanismLabel: 'How the Taruu mechanism works',
    mechanism: [
      { number: '01', title: 'We frame', body: 'the issues that demand a public decision.' },
      { number: '02', title: 'We verify', body: 'every vote belongs to one real person.' },
      { number: '03', title: 'We decide', body: 'an open civic position that cannot be pushed aside.' },
    ],
  },
};

/**
 * The editorial bridge between local proof and the national Knesset desk.
 * Taruu is deliberately separated from the three branches: it is a civic
 * feedback layer, not a fourth governing authority.
 */
export function WhatIsTaruu({ locale = 'he' }: WhatIsTaruuProps) {
  const t = COPY[locale];
  return (
    <section
      id="what-is-taruu"
      className={styles.section}
      aria-labelledby="what-is-taruu-headline"
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <div className={styles.editionLine}>
            <span>{t.editionLine}</span>
            <span aria-hidden>{t.editionEcho}</span>
          </div>

          <h2 id="what-is-taruu-headline" className={styles.headline}>
            {t.headline}
          </h2>
        </header>

        <div className={styles.system}>
          <ol className={styles.authorities} aria-label={t.authoritiesLabel}>
            {t.authorities.map((authority) => (
              <li key={authority.number} className={styles.authority}>
                <span className={styles.number}>{authority.number}</span>
                <div>
                  <h3>{authority.title}</h3>
                  <p>{authority.role}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className={styles.explainer}>
          <div className={styles.copy}>
            <p className={styles.lede}>
              {t.lede.map((run, i) => {
                if (run.tone === 'mark') {
                  return (
                    <mark key={i} className={styles.ledeMark}>
                      {run.text}
                    </mark>
                  );
                }
                if (run.tone === 'strong') {
                  return (
                    <strong key={i} className={styles.ledeStrong}>
                      {run.text}
                    </strong>
                  );
                }
                return <span key={i}>{run.text}</span>;
              })}
            </p>
          </div>

          <ol className={styles.mechanism} aria-label={t.mechanismLabel}>
            {t.mechanism.map((step) => (
              <li key={step.number}>
                <span className={styles.stepNo}>{step.number}</span>
                <p>
                  <strong>{step.title}</strong>
                  <span> - {step.body}</span>
                </p>
              </li>
            ))}
          </ol>
        </div>

      </div>
    </section>
  );
}
