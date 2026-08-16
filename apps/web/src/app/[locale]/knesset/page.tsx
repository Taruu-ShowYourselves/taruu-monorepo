import { Metadata } from 'next';
import Link from 'next/link';
import { KNESSET_SCOPE, WHATSAPP_FOUNDERS_LINK } from '@sync/shared';
import { Masthead } from '@/components/press';
import { Colophon, KnessetAgenda } from '@/components/press/sections';
import { buildKnessetAgenda } from '@/components/press/sections/knessetAgendaData';
import { NewsButton } from '@/components/press/NewsButton';
import {
  getActiveVotesWithOptions,
  getKnessetItemsByVoteIds,
} from '@/lib/supabase/db';
import type { Locale } from '@/lib/i18n';
import styles from './page.module.css';
import { localePrefix } from '@/lib/i18n';

export const revalidate = 300;

const METADATA: Record<Locale, Metadata> = {
  he: {
    title: 'כנסת ישראל · סדר היום',
    description:
      'המהדורה הארצית של תַּרְאוּ: סדר יומה של מליאת הכנסת, סעיף אחר סעיף, ' +
      'עם הצבעה אזרחית מאומתת על כל נושא.',
  },
  en: {
    title: 'The Knesset · agenda',
    description:
      "Taruu's national edition: the Knesset plenum agenda, item by item, " +
      'with a verified civic vote on every topic.',
  },
};

interface KnessetDeskCopy {
  kicker: string;
  headlineLead: string;
  headlineAccent: string;
  standfirst: string;
  noticeStamp: string;
  noticeLede: string;
  noticeNote: string;
  foundersCta: string;
  /** Across to the roster: this desk is the agenda, that page is the house. */
  rosterCta: string;
  backLink: string;
  /** Direction-semantic arrow: Hebrew ←, English →. */
  arrow: string;
}

const COPY: Record<Locale, KnessetDeskCopy> = {
  he: {
    kicker: 'המהדורה הארצית · THE NATIONAL DESK',
    headlineLead: 'על סדר היום',
    headlineAccent: 'בכנסת.',
    standfirst:
      'סדר יומה של מליאת הכנסת, ישירות מהמקור הרשמי, סעיף אחר סעיף. על כל נושא ' +
      'שעל שולחן המליאה נפתחת כאן הצבעה אזרחית: אותו מנגנון אימות, אותה ספירה ' +
      'שקופה, בקנה מידה ארצי.',
    noticeStamp: 'בהכנה · דפוס',
    noticeLede: 'סדר היום הבא של המליאה יופיע כאן ברגע שיתפרסם.',
    noticeNote:
      'המערכת מושכת את סדר יום המליאה ממאגר המידע הרשמי של הכנסת. בין מושבים, ' +
      'כשאין ישיבה קרובה, הדסק ממתין לסדר היום הבא.',
    foundersCta: 'הצטרפו למייסדים',
    rosterCta: 'מי מצביע שם? למצבת הכנסת',
    backLink: 'לנושאי הרשויות המקומיות ←',
    arrow: '←',
  },
  en: {
    kicker: 'THE NATIONAL EDITION · THE NATIONAL DESK',
    headlineLead: 'On the agenda',
    headlineAccent: 'in the Knesset.',
    standfirst:
      'The Knesset plenum agenda, straight from the official source, item by ' +
      'item. Every topic on the plenum table opens a civic vote here: the same ' +
      'verification mechanism, the same transparent count, at national scale.',
    noticeStamp: 'IN PREPARATION · PRESS',
    noticeLede: 'The next plenum agenda appears here the moment it is published.',
    noticeNote:
      "The system pulls the plenum agenda from the Knesset's official data " +
      'store. Between sessions, with no sitting close at hand, the desk waits ' +
      'for the next agenda.',
    foundersCta: 'Join the founders',
    rosterCta: 'Who votes there? To the roster',
    backLink: 'To the municipal topics →',
    arrow: '→',
  },
};

interface KnessetPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({
  params,
}: KnessetPageProps): Promise<Metadata> {
  const { locale } = await params;
  return METADATA[locale];
}

export default async function KnessetPage({ params }: KnessetPageProps) {
  const { locale } = await params;
  const t = COPY[locale];

  // Degrade to the empty agenda when the DB is unreachable (build-time
  // prerender in CI has no service-role key - #39); ISR refills at runtime.
  const votes = await getActiveVotesWithOptions(KNESSET_SCOPE).catch(() => []);
  const items = await getKnessetItemsByVoteIds(votes.map((v) => v.id)).catch(() => []);
  const agenda = buildKnessetAgenda(votes, items);
  const hasContent = agenda.sessions.length > 0 || agenda.extras.length > 0;

  return (
    <div className="np-page">
      <Masthead locale={locale} />
      <main>
        <section className={styles.desk} aria-labelledby="knesset-headline">
          <div className={styles.inner}>
            <header className={styles.header}>
              <span className={styles.kicker}>
                <span aria-hidden className={styles.kickerTick} />
                {t.kicker}
              </span>

              <h1 id="knesset-headline" className={styles.headline}>
                {t.headlineLead} <span className={styles.red}>{t.headlineAccent}</span>
              </h1>

              <p className={styles.standfirst}>{t.standfirst}</p>

              {/* The desk answers "what is on the agenda"; the roster answers
                  "who decides it, and how did they vote last time". */}
              <a className={styles.rosterLink} href={`${localePrefix(locale)}/government`}>
                {t.rosterCta}
                <span aria-hidden> {t.arrow}</span>
              </a>
            </header>

            <div className={styles.ruleHeavy} aria-hidden />

            {hasContent ? (
              <div className={styles.agendaWrap}>
                <KnessetAgenda agenda={agenda} locale={locale} />
              </div>
            ) : (
              <div className={styles.notice}>
                <span className={styles.noticeStamp}>{t.noticeStamp}</span>
                <p className={styles.noticeLede}>{t.noticeLede}</p>
                <p className={styles.noticeNote}>{t.noticeNote}</p>
                <div className={styles.noticeActions}>
                  <NewsButton
                    href={WHATSAPP_FOUNDERS_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="red"
                    size="md"
                    trailing={<span aria-hidden>{t.arrow}</span>}
                  >
                    {t.foundersCta}
                  </NewsButton>
                  <Link href={`${localePrefix(locale)}#consensus-desk`} className={styles.backLink}>
                    {t.backLink}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
      <Colophon locale={locale} />
    </div>
  );
}
