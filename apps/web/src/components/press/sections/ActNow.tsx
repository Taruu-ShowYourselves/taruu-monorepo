import { NewsButton } from '@/components/press/NewsButton';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';
import type { Locale } from '@/lib/i18n';
import styles from './ActNow.module.css';

interface ActNowProps {
  locale?: Locale;
  /**
   * `default` - the homepage closing band (vote / raise a topic / founders).
   * `explore` - the /explore conversion floor: one primary action (WhatsApp
   * founders), a subordinate sign-up door, and a tertiary slot row supplied
   * via `children` (gated create-vote tile, store teaser, download link).
   */
  variant?: 'default' | 'explore';
  /** Tertiary slot row, rendered under the doors (explore variant). */
  children?: React.ReactNode;
}

/**
 * ActNow - the closing call-to-action band. Three doors in: cast a vote,
 * raise a topic, join the founders. Heavy rules, no explanations - the
 * how-it-works page carries the pedagogy.
 */
export function ActNow({ locale = 'he', variant = 'default', children }: ActNowProps) {
  const isExplore = variant === 'explore';

  return (
    <section id="act-now" className={styles.act} aria-labelledby="act-now-headline">
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            {isExplore ? 'הצטרפו למהדורה · JOIN THE EDITION' : 'עכשיו תורכם · ACT NOW'}
          </span>
          <h2 id="act-now-headline" className={styles.headline}>
            {isExplore ? (
              <>
                הקול הבא <span className={styles.red}>שלכם.</span>
              </>
            ) : (
              <>
                הקול שלכם, <span className={styles.red}>על הנייר.</span>
              </>
            )}
          </h2>
        </header>

        {isExplore ? (
          <div className={`${styles.doors} ${styles.doorsTwo}`}>
            <div className={styles.door}>
              <span className={styles.doorNo}>01</span>
              <h3 className={styles.doorTitle}>הצטרפו למייסדים</h3>
              <p className={styles.doorNote}>
                קבוצת הוואטסאפ שבה מודפסת המהדורה הבאה. שם נסגרים הנושאים
                הראשונים.
              </p>
              <NewsButton
                href={WHATSAPP_FOUNDERS_LINK}
                target="_blank"
                rel="noopener noreferrer"
                variant="red"
                size="md"
                trailing={<span aria-hidden>←</span>}
              >
                לקבוצת המייסדים
              </NewsButton>
            </div>

            <div className={styles.door}>
              <span className={styles.doorNo}>02</span>
              <h3 className={styles.doorTitle}>פתחו חשבון</h3>
              <p className={styles.doorNote}>
                הרשמה קצרה, אימות אחד - ומהגיליון הבא אתם מצביעים בפנים.
              </p>
              <NewsButton
                href={`/${locale}/sign-up`}
                variant="ink"
                size="md"
                trailing={<span aria-hidden>←</span>}
              >
                הרשמה
              </NewsButton>
            </div>
          </div>
        ) : (
          <div className={styles.doors}>
            <div className={styles.door}>
              <span className={styles.doorNo}>01</span>
              <h3 className={styles.doorTitle}>הצביעו</h3>
              <p className={styles.doorNote}>
                בחרו נושא פתוח ברשות שלכם והשמיעו קול מאומת.
              </p>
              <NewsButton
                href={`/${locale}/votes`}
                variant="red"
                size="md"
                trailing={<span aria-hidden>←</span>}
              >
                לנושאים הפתוחים
              </NewsButton>
            </div>

            <div className={styles.door}>
              <span className={styles.doorNo}>02</span>
              <h3 className={styles.doorTitle}>הציעו נושא</h3>
              <p className={styles.doorNote}>
                מה שורף אצלכם בעיר? העלו אותו לסדר היום של הרשות.
              </p>
              <NewsButton
                href={`/${locale}/votes/create`}
                variant="ink"
                size="md"
                trailing={<span aria-hidden>←</span>}
              >
                פתיחת נושא
              </NewsButton>
            </div>

            <div className={styles.door}>
              <span className={styles.doorNo}>03</span>
              <h3 className={styles.doorTitle}>הצטרפו למייסדים</h3>
              <p className={styles.doorNote}>
                קבוצת הוואטסאפ שבה מודפסת המהדורה הבאה.
              </p>
              <NewsButton
                href={WHATSAPP_FOUNDERS_LINK}
                target="_blank"
                rel="noopener noreferrer"
                variant="outline"
                size="md"
                trailing={<span aria-hidden>←</span>}
              >
                לקבוצת המייסדים
              </NewsButton>
            </div>
          </div>
        )}

        {children ? <div className={styles.slotRow}>{children}</div> : null}
      </div>
    </section>
  );
}
