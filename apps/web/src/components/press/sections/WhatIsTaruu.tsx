import type { Locale } from '@/lib/i18n';
import styles from './WhatIsTaruu.module.css';

interface WhatIsTaruuProps {
  locale?: Locale;
}

interface WhatIsTaruuCopy {
  editionLine: string;
  editionEcho: string;
  headline: string;
  headlineSub: string;
  authoritiesLabel: string;
  authorities: { number: string; title: string; role: string }[];
  feedbackLabel: string;
  feedbackStrong: string;
  feedbackText: string;
  lede: string;
  counterLead: string;
  counterStrong1: string;
  counterMid: string;
  counterStrong2: string;
  counterTail: string;
  counterStrong3: string;
  mechanismLabel: string;
  mechanism: { number: string; title: string; body: string }[];
}

const COPY: Record<Locale, WhatIsTaruuCopy> = {
  he: {
    editionLine: 'למה תַּרְאוּ? · מנגנון נגד אזרחי / 06',
    editionEcho: 'PUBLIC BALANCE / CIVIC COUNTERWEIGHT',
    headline: 'שלוש רשויות מאזנות אחת את השנייה.',
    headlineSub: ' אבל האיזון אינו מגיע בזמן.',
    authoritiesLabel: 'שלוש רשויות השלטון',
    authorities: [
      { number: '01', title: 'הכנסת', role: 'מחוקקת ומפקחת.' },
      { number: '02', title: 'הממשלה', role: 'מבצעת.' },
      { number: '03', title: 'בתי המשפט', role: 'מפרשים את הדין ומכריעים בסכסוכים.' },
    ],
    feedbackLabel: 'מנגנון נגד אזרחי',
    feedbackStrong: 'לא רשות רביעית.',
    feedbackText: ' ריבון אזרחי שמחזיר את האיזון.',
    lede: 'תהליכי הרשויות ארוכים, איטיים, בזבזניים ומסורבלים. בשנים האחרונות אנו רואים כיצד ממשלות מנצלות תהליך זה לרעה, כמדיניות של סחבת והסחת דעת.',
    counterLead: 'ועל כן, כ',
    counterStrong1: 'מנגנון נגד',
    counterMid: ', ניצוק את קולנו לגיבוש',
    counterStrong2: 'ריבון אזרחי',
    counterTail: '. את רצונו אנו מצפים מן הממשלה והרשויות',
    counterStrong3: 'לבצע ללא כל הסתייגות.',
    mechanismLabel: 'כך עובד מנגנון תראו',
    mechanism: [
      { number: '01', title: 'מגבשים', body: 'את הנושאים הדורשים הכרעה ציבורית.' },
      { number: '02', title: 'מאמתים', body: 'כל קול שייך לאדם אמיתי אחד.' },
      { number: '03', title: 'מכריעים', body: 'עמדה אזרחית גלויה שאי אפשר להסיט הצדה.' },
    ],
  },
  en: {
    editionLine: 'Why Taruu? · A civic counter-mechanism / 06',
    editionEcho: 'איזון ציבורי / מנגנון נגד אזרחי',
    headline: 'Three branches balance one another.',
    headlineSub: ' But the balance does not arrive in time.',
    authoritiesLabel: 'The three branches of government',
    authorities: [
      { number: '01', title: 'The Knesset', role: 'Legislates and oversees.' },
      { number: '02', title: 'The Government', role: 'Executes.' },
      { number: '03', title: 'The Courts', role: 'Interpret the law and settle disputes.' },
    ],
    feedbackLabel: 'A civic counter-mechanism',
    feedbackStrong: 'Not a fourth branch.',
    feedbackText: ' A civic sovereign that restores the balance.',
    lede: 'The branches’ processes are long, slow, wasteful, and cumbersome. In recent years we have watched governments abuse that process as a policy of delay and distraction.',
    counterLead: 'And so, as a ',
    counterStrong1: 'counter-mechanism',
    counterMid: ', we pour our voice into forming a',
    counterStrong2: 'civic sovereign',
    counterTail: '. Its will we expect the government and the authorities',
    counterStrong3: 'to carry out without reservation.',
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
            <span>{t.headlineSub}</span>
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

          <div className={styles.feedback}>
            <span className={styles.feedbackLabel}>{t.feedbackLabel}</span>
            <p>
              <strong>{t.feedbackStrong}</strong>
              <span>{t.feedbackText}</span>
            </p>
          </div>
        </div>

        <div className={styles.explainer}>
          <div className={styles.copy}>
            <p className={styles.lede}>
              {t.lede}
            </p>
            <p className={styles.counterCopy}>
              {t.counterLead}<strong>{t.counterStrong1}</strong>{t.counterMid}{' '}
              <strong>{t.counterStrong2}</strong>{t.counterTail}{' '}
              <strong>{t.counterStrong3}</strong>
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
