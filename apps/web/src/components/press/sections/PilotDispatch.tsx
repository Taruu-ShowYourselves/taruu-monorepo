'use client';

import { NewsButton } from '@/components/press/NewsButton';
import type { Locale } from '@/lib/i18n';
import styles from './PilotDispatch.module.css';

const WHATSAPP_LINK = 'https://chat.whatsapp.com/FITvea9IVsn2Ljie1yCrAc';

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

interface PilotDispatchProps {
  locale?: Locale;
}

export function PilotDispatch({ locale = 'he' }: PilotDispatchProps) {
  void locale;

  return (
    <section className={styles.dispatch} aria-labelledby="pilot-dispatch-headline">
      <div className={styles.inner}>
        {/* Dateline — top of the dispatch */}
        <div className={styles.dateline}>
          <span className={`np-kicker ${styles.kicker}`}>מברק מהשטח · DISPATCH</span>
          <span className={`np-mono ${styles.datelinePlace}`} aria-hidden>
            <PinIcon />
            קריית טבעון
          </span>
        </div>

        <hr className="np-rule-heavy" />

        <div className={styles.grid}>
          {/* Editorial column — headline + drop-cap body */}
          <div className={styles.story}>
            <h2 id="pilot-dispatch-headline" className={styles.headline}>
              קריית טבעון פותחת.
              <br />
              בואו להיות שותפים <span className={styles.red}>מהיום הראשון.</span>
            </h2>

            <p className={`np-dropcap ${styles.body}`}>
              כדי שהכלי הזה יהיה מדויק עבורנו, פתחנו קבוצת וואטסאפ שקטה — שם נדייק
              יחד את שלבי הפיתוח, את חוויית המשתמש, ואת הנושאים הראשונים שיעלו
              להצבעה. אתם לא מצטרפים למוצר מוגמר. אתם מעצבים אותו.
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
                להצטרפות לקבוצת המייסדים
              </NewsButton>
              <a href="#subscribe" className={styles.textLink}>
                הירשמו לעדכון במייל ↓
              </a>
            </div>
          </div>

          {/* Press furniture — fact strip + proof date + pull-quote */}
          <aside className={styles.furniture}>
            <div className={styles.factStrip}>
              <span className={`np-mono ${styles.factLabel}`}>עובדות · FACTS</span>

              <div className={styles.fact}>
                <span className={styles.factIcon} aria-hidden>
                  <PinIcon />
                </span>
                <span className={`np-mono ${styles.factText}`}>
                  הרשות הראשונה: קריית טבעון
                </span>
              </div>

              <hr className="np-rule-hair" />

              <div className={styles.fact}>
                <span className={styles.factIcon} aria-hidden>
                  <CalendarIcon />
                </span>
                <span className={`np-mono ${styles.factText}`}>
                  מועד ההצבעה הראשונה
                </span>
              </div>

              {/* The proof element — headline number */}
              <div className={styles.proofDate}>
                <span className={styles.proofNumber}>23.01.26</span>
                <span className={`np-mono ${styles.proofMeta}`}>
                  ההצבעה הראשונה · LIVE
                </span>
              </div>
            </div>

            <blockquote className={`np-block-red ${styles.pullQuote}`}>
              <p>אתם לא מספר 10,000.</p>
              <p className={styles.pullQuoteStrong}>אתם מהמייסדים.</p>
            </blockquote>
          </aside>
        </div>
      </div>
    </section>
  );
}
