import { NewsButton } from '@/components/press/NewsButton';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';
import type { Locale } from '@/lib/i18n';
import styles from './ActNow.module.css';

interface ActNowProps {
  locale?: Locale;
}

/**
 * ActNow — the closing call-to-action band. Three doors in: cast a vote,
 * raise a topic, join the founders. Heavy rules, no explanations — the
 * how-it-works page carries the pedagogy.
 */
export function ActNow({ locale = 'he' }: ActNowProps) {
  return (
    <section id="act-now" className={styles.act} aria-labelledby="act-now-headline">
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            עכשיו תורכם · ACT NOW
          </span>
          <h2 id="act-now-headline" className={styles.headline}>
            הקול שלכם — <span className={styles.red}>על הנייר.</span>
          </h2>
        </header>

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
              מה שורף בשכונה? העלו אותו לסדר היום של הרשות.
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
      </div>
    </section>
  );
}
