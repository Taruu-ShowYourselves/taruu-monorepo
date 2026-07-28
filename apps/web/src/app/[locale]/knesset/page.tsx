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

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'כנסת ישראל — סדר היום',
  description:
    'המהדורה הארצית של תַּרְאוּ — סדר יומה של מליאת הכנסת, סעיף אחר סעיף, ' +
    'עם הצבעה אזרחית מאומתת על כל נושא.',
};

interface KnessetPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function KnessetPage({ params }: KnessetPageProps) {
  const { locale } = await params;

  const votes = await getActiveVotesWithOptions(KNESSET_SCOPE);
  const items = await getKnessetItemsByVoteIds(votes.map((v) => v.id));
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
                המהדורה הארצית · THE NATIONAL DESK
              </span>

              <h1 id="knesset-headline" className={styles.headline}>
                על סדר היום <span className={styles.red}>בכנסת.</span>
              </h1>

              <p className={styles.standfirst}>
                סדר יומה של מליאת הכנסת, ישירות מהמקור הרשמי — סעיף אחר סעיף.
                על כל נושא שעל שולחן המליאה נפתחת כאן הצבעה אזרחית: אותו מנגנון
                אימות, אותה ספירה שקופה, בקנה מידה ארצי.
              </p>
            </header>

            <div className={styles.ruleHeavy} aria-hidden />

            {hasContent ? (
              <div className={styles.agendaWrap}>
                <KnessetAgenda agenda={agenda} locale={locale} />
              </div>
            ) : (
              <div className={styles.notice}>
                <span className={styles.noticeStamp}>בהכנה · דפוס</span>
                <p className={styles.noticeLede}>
                  סדר היום הבא של המליאה יופיע כאן ברגע שיתפרסם.
                </p>
                <p className={styles.noticeNote}>
                  המערכת מושכת את סדר יום המליאה ממאגר המידע הרשמי של הכנסת.
                  בין מושבים — כשאין ישיבה קרובה — הדסק ממתין לסדר היום הבא.
                </p>
                <div className={styles.noticeActions}>
                  <NewsButton
                    href={WHATSAPP_FOUNDERS_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="red"
                    size="md"
                    trailing={<span aria-hidden>←</span>}
                  >
                    הצטרפו למייסדים
                  </NewsButton>
                  <Link href={`/${locale}#consensus-desk`} className={styles.backLink}>
                    לנושאי הרשויות המקומיות ←
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
