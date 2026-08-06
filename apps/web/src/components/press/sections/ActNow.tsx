import { NewsButton } from '@/components/press/NewsButton';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';
import type { Locale } from '@/lib/i18n';
import styles from './ActNow.module.css';
import { localePrefix } from '@/lib/i18n';

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

interface ActNowCopy {
  kickerExplore: string;
  kickerDefault: string;
  headlineExplore: string;
  headlineExploreRed: string;
  headlineDefault: string;
  headlineDefaultRed: string;
  exploreFoundersTitle: string;
  exploreFoundersNote: string;
  exploreFoundersCta: string;
  exploreSignupTitle: string;
  exploreSignupNote: string;
  exploreSignupCta: string;
  voteTitle: string;
  voteNote: string;
  voteCta: string;
  topicTitle: string;
  topicNote: string;
  topicCta: string;
  foundersTitle: string;
  foundersNote: string;
  foundersCta: string;
  arrow: string;
}

const COPY: Record<Locale, ActNowCopy> = {
  he: {
    kickerExplore: 'הצטרפו למהדורה · JOIN THE EDITION',
    kickerDefault: 'עכשיו תורכם · ACT NOW',
    headlineExplore: 'הקול הבא',
    headlineExploreRed: 'שלכם.',
    headlineDefault: 'הקול שלכם,',
    headlineDefaultRed: 'על הנייר.',
    exploreFoundersTitle: 'הצטרפו למייסדים',
    exploreFoundersNote: 'קבוצת הוואטסאפ שבה מודפסת המהדורה הבאה. שם נסגרים הנושאים הראשונים.',
    exploreFoundersCta: 'לקבוצת המייסדים',
    exploreSignupTitle: 'פתחו חשבון',
    exploreSignupNote: 'הרשמה קצרה, אימות אחד - ומהגיליון הבא אתם מצביעים בפנים.',
    exploreSignupCta: 'הרשמה',
    voteTitle: 'הצביעו',
    voteNote: 'בחרו נושא פתוח ברשות שלכם והשמיעו קול מאומת.',
    voteCta: 'לנושאים הפתוחים',
    topicTitle: 'הציעו נושא',
    topicNote: 'מה שורף אצלכם בעיר? העלו אותו לסדר היום של הרשות.',
    topicCta: 'פתיחת נושא',
    foundersTitle: 'הצטרפו למייסדים',
    foundersNote: 'קבוצת הוואטסאפ שבה מודפסת המהדורה הבאה.',
    foundersCta: 'לקבוצת המייסדים',
    arrow: '←',
  },
  en: {
    kickerExplore: 'Join the edition · הצטרפו למהדורה',
    kickerDefault: 'Act now · עכשיו תורכם',
    headlineExplore: 'The next vote',
    headlineExploreRed: 'is yours.',
    headlineDefault: 'Your voice,',
    headlineDefaultRed: 'on paper.',
    exploreFoundersTitle: 'Join the founders',
    exploreFoundersNote: 'The WhatsApp group where the next edition is set in print. That is where the first topics are decided.',
    exploreFoundersCta: 'To the founders’ group',
    exploreSignupTitle: 'Open an account',
    exploreSignupNote: 'A short sign-up, one verification - and from the next issue you vote inside.',
    exploreSignupCta: 'Sign up',
    voteTitle: 'Vote',
    voteNote: 'Pick an open topic in your municipality and cast a verified vote.',
    voteCta: 'To the open topics',
    topicTitle: 'Raise a topic',
    topicNote: 'What is burning in your city? Put it on the municipality’s agenda.',
    topicCta: 'Open a topic',
    foundersTitle: 'Join the founders',
    foundersNote: 'The WhatsApp group where the next edition is set in print.',
    foundersCta: 'To the founders’ group',
    arrow: '→',
  },
};

/**
 * ActNow - the closing call-to-action band. Three doors in: cast a vote,
 * raise a topic, join the founders. Heavy rules, no explanations - the
 * how-it-works page carries the pedagogy.
 */
export function ActNow({ locale = 'he', variant = 'default', children }: ActNowProps) {
  const isExplore = variant === 'explore';
  const t = COPY[locale];

  return (
    <section id="act-now" className={styles.act} aria-labelledby="act-now-headline">
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            {isExplore ? t.kickerExplore : t.kickerDefault}
          </span>
          <h2 id="act-now-headline" className={styles.headline}>
            {isExplore ? (
              <>
                {t.headlineExplore} <span className={styles.red}>{t.headlineExploreRed}</span>
              </>
            ) : (
              <>
                {t.headlineDefault} <span className={styles.red}>{t.headlineDefaultRed}</span>
              </>
            )}
          </h2>
        </header>

        {isExplore ? (
          <div className={`${styles.doors} ${styles.doorsTwo}`}>
            <div className={styles.door}>
              <span className={styles.doorNo}>01</span>
              <h3 className={styles.doorTitle}>{t.exploreFoundersTitle}</h3>
              <p className={styles.doorNote}>
                {t.exploreFoundersNote}
              </p>
              <NewsButton
                href={WHATSAPP_FOUNDERS_LINK}
                target="_blank"
                rel="noopener noreferrer"
                variant="red"
                size="md"
                trailing={<span aria-hidden>{t.arrow}</span>}
              >
                {t.exploreFoundersCta}
              </NewsButton>
            </div>

            <div className={styles.door}>
              <span className={styles.doorNo}>02</span>
              <h3 className={styles.doorTitle}>{t.exploreSignupTitle}</h3>
              <p className={styles.doorNote}>
                {t.exploreSignupNote}
              </p>
              <NewsButton
                href={`${localePrefix(locale)}/sign-up`}
                variant="ink"
                size="md"
                trailing={<span aria-hidden>{t.arrow}</span>}
              >
                {t.exploreSignupCta}
              </NewsButton>
            </div>
          </div>
        ) : (
          <div className={styles.doors}>
            <div className={styles.door}>
              <span className={styles.doorNo}>01</span>
              <h3 className={styles.doorTitle}>{t.voteTitle}</h3>
              <p className={styles.doorNote}>
                {t.voteNote}
              </p>
              <NewsButton
                href={`${localePrefix(locale)}/votes`}
                variant="red"
                size="md"
                trailing={<span aria-hidden>{t.arrow}</span>}
              >
                {t.voteCta}
              </NewsButton>
            </div>

            <div className={styles.door}>
              <span className={styles.doorNo}>02</span>
              <h3 className={styles.doorTitle}>{t.topicTitle}</h3>
              <p className={styles.doorNote}>
                {t.topicNote}
              </p>
              <NewsButton
                href={`${localePrefix(locale)}/votes/create`}
                variant="ink"
                size="md"
                trailing={<span aria-hidden>{t.arrow}</span>}
              >
                {t.topicCta}
              </NewsButton>
            </div>

            <div className={styles.door}>
              <span className={styles.doorNo}>03</span>
              <h3 className={styles.doorTitle}>{t.foundersTitle}</h3>
              <p className={styles.doorNote}>
                {t.foundersNote}
              </p>
              <NewsButton
                href={WHATSAPP_FOUNDERS_LINK}
                target="_blank"
                rel="noopener noreferrer"
                variant="outline"
                size="md"
                trailing={<span aria-hidden>{t.arrow}</span>}
              >
                {t.foundersCta}
              </NewsButton>
            </div>
          </div>
        )}

        {children ? <div className={styles.slotRow}>{children}</div> : null}
      </div>
    </section>
  );
}
