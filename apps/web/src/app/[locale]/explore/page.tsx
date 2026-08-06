import type { Metadata } from 'next';
import { Masthead, Ticker } from '@/components/press';
import { ActNow, Colophon } from '@/components/press/sections';
import { getActiveVotesWithOptions, countRegisteredUsers } from '@/lib/supabase/db';
import type { Locale } from '@/lib/i18n';
import { buildExploreEdition, getMoneyStats } from './data';
import { ExploreRail } from './components/ExploreRail';
import { PulseStrip } from './components/PulseStrip';
import { NowDecidingDesk } from './components/NowDecidingDesk';
import { MuniIndex } from './components/MuniIndex';
import { KnessetStrip } from './components/KnessetStrip';
import { MoneyDesk } from './components/MoneyDesk';
import { MechanismTiles } from './components/MechanismTiles';
import { JoinSlotRow } from './components/JoinSlotRow';
import styles from './page.module.css';

// Cached edition: refreshes every 5 minutes like home/knesset/municipality -
// zero Supabase load per request.
export const revalidate = 300;

const METADATA: Record<Locale, Metadata> = {
  he: {
    title: 'סדר היום המלא',
    description:
      'מפת המערכת של תַּרְאוּ: כל ההצבעות החיות בכל הרשויות, סדר היום בכנסת, ' +
      'הקרן האזרחית ושוק ה-BAGS - אינדקס אחד, שקוף ופתוח לכולם.',
  },
  en: {
    title: 'The Full Agenda',
    description:
      'The system map of Taruu: every live vote in every municipality, the Knesset agenda, ' +
      'the civic fund and the BAGS market - one index, transparent and open to all.',
  },
};

interface ExplorePageCopy {
  kicker: string;
  headline: string;
  headlineRed: string;
  standfirst: string;
  railItems: { id: string; label: string }[];
}

const COPY: Record<Locale, ExplorePageCopy> = {
  he: {
    kicker: 'המפתח · THE FULL INDEX',
    headline: 'סדר היום',
    headlineRed: 'המלא.',
    standfirst:
      'כל מה שמודפס במערכת - כל הצבעה חיה, כל דסק מקומי, כל שקל בקרן - בעמוד אחד. מסודר לפי מה שאתם מחפשים, לא לפי מבנה האתר.',
    railItems: [
      { id: 'now-deciding', label: 'חי' },
      { id: 'muni-index', label: 'רשויות' },
      { id: 'knesset-strip', label: 'כנסת' },
      { id: 'money-desk', label: 'הכסף' },
      { id: 'mechanism', label: 'המנגנון' },
      { id: 'act-now', label: 'הצטרפות' },
    ],
  },
  en: {
    kicker: 'The key · THE FULL INDEX',
    headline: 'The agenda,',
    headlineRed: 'in full.',
    standfirst:
      'Everything the desk prints - every live vote, every local desk, every shekel in the fund - on one page. Ordered by what you are looking for, not by the site structure.',
    railItems: [
      { id: 'now-deciding', label: 'Live' },
      { id: 'muni-index', label: 'Municipalities' },
      { id: 'knesset-strip', label: 'Knesset' },
      { id: 'money-desk', label: 'The money' },
      { id: 'mechanism', label: 'The mechanism' },
      { id: 'act-now', label: 'Join' },
    ],
  },
};

interface ExplorePageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({
  params,
}: ExplorePageProps): Promise<Metadata> {
  const { locale } = await params;
  return METADATA[locale];
}

/**
 * /explore - the newsroom floor plan. The homepage is the front page; this is
 * the full standing index of everything the paper covers, ordered by visitor
 * intent: see it live → near you → the country → the money → the mechanism →
 * join. Public end to end; the only gated acts (vote / create / dashboard)
 * bounce through /sign-in?redirect=… on their own pages.
 *
 * One page, one votes query (S3/S4/S5 all derive from it); every server
 * fetch degrades to an honest empty edition (issue #39 pattern).
 */
export default async function ExplorePage({ params }: ExplorePageProps) {
  const { locale } = await params;

  const [votes, money, registered] = await Promise.all([
    getActiveVotesWithOptions().catch(() => []),
    getMoneyStats().catch(() => null),
    countRegisteredUsers().catch(() => null),
  ]);

  const edition = buildExploreEdition(votes);
  const t = COPY[locale];

  return (
    <div className="np-page">
      <Masthead locale={locale} />
      <Ticker locale={locale} />

      <main className={styles.page}>
        {/* S1 - title + standing index rail */}
        <header className={styles.hero} aria-labelledby="explore-headline">
          <div className={styles.heroInner}>
            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              {t.kicker}
            </span>
            <h1 id="explore-headline" className={styles.headline}>
              {t.headline} <span className={styles.red}>{t.headlineRed}</span>
            </h1>
            <p className={styles.standfirst}>
              {t.standfirst}
            </p>
          </div>
        </header>

        <ExploreRail items={t.railItems} locale={locale} />

        {/* S2 - הדופק */}
        <PulseStrip
          locale={locale}
          registered={registered}
          activeVotes={edition.activeVotes}
          municipalitiesLive={edition.municipalitiesLive}
          totalRaisedIls={money?.totalRaisedIls ?? null}
          weeklyGrowth={money?.weeklyGrowth ?? null}
        />

        {/* S3 - מכריעים עכשיו */}
        <NowDecidingDesk locale={locale} topics={edition.nowDeciding} />

        {/* S4 - דסקי הרשויות */}
        <MuniIndex locale={locale} rows={edition.muniRows} hasData={edition.hasVotes} />

        {/* S5 - על סדר היום בכנסת */}
        <KnessetStrip locale={locale} topics={edition.knessetTop} />

        {/* S6 - הכסף, גלוי (the glass section) */}
        <MoneyDesk locale={locale} totalRaisedIls={money?.totalRaisedIls ?? null} />

        {/* S7 - איך זה עובד */}
        <MechanismTiles locale={locale} />

        {/* S8 - הצטרפו למהדורה */}
        <ActNow locale={locale} variant="explore">
          <JoinSlotRow locale={locale} />
        </ActNow>
      </main>

      <Colophon locale={locale} />
    </div>
  );
}
