'use client';

import { NewsButton } from '@/components/press/NewsButton';
import type { Locale } from '@/lib/i18n';
import styles from './PilotDispatch.module.css';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';

const WHATSAPP_LINK = WHATSAPP_FOUNDERS_LINK;

/** Hard-edged ink map pin, no rounding. */
function PinIcon() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
      focusable="false"
    >
      <path d="M12 2 4 9v13h16V9L12 2Z" />
      <rect x="9" y="12" width="6" height="6" />
    </svg>
  );
}

/** Hard-edged ink calendar/tear-off, no rounding. */
function CalendarIcon() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
      focusable="false"
    >
      <rect x="3" y="4" width="18" height="17" />
      <path d="M3 9h18" />
      <path d="M8 2v4M16 2v4" />
    </svg>
  );
}

interface PilotDispatchCopy {
  kicker: string;
  datelinePlace: string;
  headlineLine1: string;
  headlineLine2: string;
  headlineRed: string;
  body: string;
  cta: string;
  emailLink: string;
  factLabel: string;
  fact1: string;
  fact2: string;
  proofNumber: string;
  proofMeta: string;
  quoteLine1: string;
  quoteLine2: string;
  arrow: string;
}

const COPY: Record<Locale, PilotDispatchCopy> = {
  he: {
    kicker: 'מברק מהשטח · DISPATCH',
    datelinePlace: 'כל הארץ',
    headlineLine1: 'נפתחים בכל הארץ, בבת אחת.',
    headlineLine2: 'בואו להיות שותפים',
    headlineRed: 'מהיום הראשון.',
    body: 'כדי שהכלי הזה יהיה מדויק עבורנו, פתחנו קבוצת וואטסאפ שקטה. שם נדייק יחד את שלבי הפיתוח, את חוויית המשתמש, ואת הנושאים הראשונים שיעלו להצבעה. אתם לא מצטרפים למוצר מוגמר. אתם מעצבים אותו.',
    cta: 'להצטרפות לקבוצת המייסדים',
    emailLink: 'הירשמו לעדכון במייל ↓',
    factLabel: 'עובדות · FACTS',
    fact1: 'פתיחה ארצית: כל הרשויות יחד',
    fact2: 'מועד ההצבעה הראשונה',
    proofNumber: '04.08.26',
    proofMeta: 'ההצבעה הראשונה · LIVE',
    quoteLine1: 'אתם לא מספר 10,000.',
    quoteLine2: 'אתם מהמייסדים.',
    arrow: '←',
  },
  en: {
    kicker: 'FROM THE FIELD · DISPATCH',
    datelinePlace: 'Nationwide',
    headlineLine1: 'Opening nationwide, all at once.',
    headlineLine2: 'Come be partners',
    headlineRed: 'from day one.',
    body: 'To make this tool precise for us, we opened a quiet WhatsApp group. There we will refine together the stages of development, the user experience, and the first topics that will go to a vote. You are not joining a finished product. You are shaping it.',
    cta: 'Join the founders group',
    emailLink: 'Sign up for email updates ↓',
    factLabel: 'THE FACTS · FACTS',
    fact1: 'National launch: all municipalities together',
    fact2: 'Date of the first vote',
    proofNumber: '04.08.26',
    proofMeta: 'THE FIRST VOTE · LIVE',
    quoteLine1: 'You are not number 10,000.',
    quoteLine2: 'You are one of the founders.',
    arrow: '→',
  },
};

interface PilotDispatchProps {
  locale?: Locale;
}

export function PilotDispatch({ locale = 'he' }: PilotDispatchProps) {
  const t = COPY[locale];

  return (
    <section className={styles.dispatch} aria-labelledby="pilot-dispatch-headline">
      <div className={styles.inner}>
        {/* Dateline - top of the dispatch */}
        <div className={styles.dateline}>
          <span className={`np-kicker ${styles.kicker}`}>{t.kicker}</span>
          <span className={`np-mono ${styles.datelinePlace}`} aria-hidden>
            <PinIcon />
            {t.datelinePlace}
          </span>
        </div>

        <hr className="np-rule-heavy" />

        <div className={styles.grid}>
          {/* Editorial column - headline + drop-cap body */}
          <div className={styles.story}>
            <h2 id="pilot-dispatch-headline" className={styles.headline}>
              {t.headlineLine1}
              <br />
              {t.headlineLine2} <span className={styles.red}>{t.headlineRed}</span>
            </h2>

            <p className={`np-dropcap ${styles.body}`}>{t.body}</p>

            <div className={styles.actions}>
              <NewsButton
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                variant="red"
                size="lg"
                trailing={<span aria-hidden>{t.arrow}</span>}
              >
                {t.cta}
              </NewsButton>
              <a href="#subscribe" className={styles.textLink}>
                {t.emailLink}
              </a>
            </div>
          </div>

          {/* Press furniture - fact strip + proof date + pull-quote */}
          <aside className={styles.furniture}>
            <div className={styles.factStrip}>
              <span className={`np-mono ${styles.factLabel}`}>{t.factLabel}</span>

              <div className={styles.fact}>
                <span className={styles.factIcon} aria-hidden>
                  <PinIcon />
                </span>
                <span className={`np-mono ${styles.factText}`}>{t.fact1}</span>
              </div>

              <hr className="np-rule-hair" />

              <div className={styles.fact}>
                <span className={styles.factIcon} aria-hidden>
                  <CalendarIcon />
                </span>
                <span className={`np-mono ${styles.factText}`}>{t.fact2}</span>
              </div>

              {/* The proof element - headline number */}
              <div className={styles.proofDate}>
                <span className={styles.proofNumber}>{t.proofNumber}</span>
                <span className={`np-mono ${styles.proofMeta}`}>{t.proofMeta}</span>
              </div>
            </div>

            <blockquote className={`np-block-red ${styles.pullQuote}`}>
              <p>{t.quoteLine1}</p>
              <p className={styles.pullQuoteStrong}>{t.quoteLine2}</p>
            </blockquote>
          </aside>
        </div>
      </div>
    </section>
  );
}
