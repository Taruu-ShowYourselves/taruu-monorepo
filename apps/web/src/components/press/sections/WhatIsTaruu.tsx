import type { Locale } from '@/lib/i18n';
import styles from './WhatIsTaruu.module.css';

interface WhatIsTaruuProps {
  locale?: Locale;
}

const AUTHORITIES = [
  { number: '01', title: 'הכנסת', role: 'מחוקקת ומפקחת.' },
  { number: '02', title: 'הממשלה', role: 'מבצעת.' },
  { number: '03', title: 'בתי המשפט', role: 'מפרשים את הדין ומכריעים בסכסוכים.' },
];

const MECHANISM = [
  { number: '01', title: 'מגבשים', body: 'את הנושאים הדורשים הכרעה ציבורית.' },
  { number: '02', title: 'מאמתים', body: 'כל קול שייך לאדם אמיתי אחד.' },
  { number: '03', title: 'מכריעים', body: 'עמדה אזרחית גלויה שאי אפשר להסיט הצדה.' },
];

/**
 * The editorial bridge between local proof and the national Knesset desk.
 * Taruu is deliberately separated from the three branches: it is a civic
 * feedback layer, not a fourth governing authority.
 */
export function WhatIsTaruu(_props: WhatIsTaruuProps) {
  return (
    <section
      id="what-is-taruu"
      className={styles.section}
      aria-labelledby="what-is-taruu-headline"
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <div className={styles.editionLine}>
            <span>למה תַּרְאוּ? · מנגנון נגד אזרחי / 06</span>
            <span aria-hidden>PUBLIC BALANCE / CIVIC COUNTERWEIGHT</span>
          </div>

          <h2 id="what-is-taruu-headline" className={styles.headline}>
            שלוש רשויות מאזנות אחת את השנייה.
            <span> אבל האיזון אינו מגיע בזמן.</span>
          </h2>
        </header>

        <div className={styles.system}>
          <ol className={styles.authorities} aria-label="שלוש רשויות השלטון">
            {AUTHORITIES.map((authority) => (
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
            <span className={styles.feedbackLabel}>מנגנון נגד אזרחי</span>
            <p>
              <strong>לא רשות רביעית.</strong>
              <span> ריבון אזרחי שמחזיר את האיזון.</span>
            </p>
          </div>
        </div>

        <div className={styles.explainer}>
          <div className={styles.copy}>
            <p className={styles.lede}>
              תהליכי הרשויות ארוכים, איטיים, בזבזניים ומסורבלים. בשנים
              האחרונות אנו רואים כיצד ממשלות מנצלות תהליך זה לרעה, כמדיניות
              של סחבת והסחת דעת.
            </p>
            <p className={styles.counterCopy}>
              ועל כן, כ<strong>מנגנון נגד</strong>, ניצוק את קולנו לגיבוש{' '}
              <strong>ריבון אזרחי</strong>. את רצונו אנו מצפים מן הממשלה
              והרשויות <strong>לבצע ללא כל הסתייגות.</strong>
            </p>
          </div>

          <ol className={styles.mechanism} aria-label="כך עובד מנגנון תראו">
            {MECHANISM.map((step) => (
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
