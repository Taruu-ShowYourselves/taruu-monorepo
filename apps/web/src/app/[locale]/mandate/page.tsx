import type { Metadata } from 'next';
import { Masthead } from '@/components/press';
import { Colophon } from '@/components/press/sections';
import {
  MandateBoard,
  type MandateBoardCopy,
} from '@/components/press/mandate/MandateBoard';
import styles from '@/components/press/mandate/Mandate.module.css';
import { civicMandate } from '@/server/read/mandate';
import { MANDATE_MIN_BALLOTS } from '@/server/domain/mandate/mandate';
import {
  DEMO_MUNICIPAL,
  DEMO_NATIONAL,
  DEMO_QUERY_FLAG,
  DEMO_TOTALS,
  isDemoRequested,
} from '@/server/domain/mandate/demoMandate';
import type { Locale } from '@/lib/i18n';

// The register moves when a ballot closes, not between one reader and the
// next; five minutes matches the desks and the municipal profiles.
export const revalidate = 300;

interface PageProps {
  params: Promise<{ locale: Locale }>;
  /** `?demo=1` presents an invented register instead of the counted one. */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface MandateCopy extends MandateBoardCopy {
  metaTitle: string;
  metaDescription: string;
  crumbHome: string;
  crumbMandate: string;
  kicker: string;
  titleLead: string;
  titleAccent: string;
  standfirst: string;
  totalDecided: string;
  totalStanding: string;
  totalBallots: string;
  totalAuthorities: string;
  method: string;
  demoStamp: string;
  demoNote: string;
}

const COPY: Record<Locale, MandateCopy> = {
  he: {
    metaTitle: 'המנדט האזרחי · תַּרְאוּ',
    metaDescription:
      'מה שהאזרחים כבר החליטו: כל ההכרעות שנספרו בהצבעות האזרחיות, מול הממשלה והכנסת ומול כל רשות מקומית.',
    crumbHome: 'ראשי',
    crumbMandate: 'המנדט האזרחי',
    kicker: 'המנדט האזרחי · THE CIVIC MANDATE',
    titleLead: 'הוכרע על ידי',
    titleAccent: 'האזרחים.',
    standfirst:
      'זה מה שנספר עד כה. כל שורה כאן היא הכרעה של תושבים מאומתים בנושא אחד - מול מי היא מופנית, כמה קולות עומדים מאחוריה, ובאיזה רוב. הכרעות שנסגרו מסומנות ככאלה; הצבעות שעוד פתוחות מוצגות כמצב נוכחי בלבד.',
    totalDecided: 'הכרעות שנסגרו',
    totalStanding: 'מצב בהצבעות פתוחות',
    totalBallots: 'קולות שנספרו',
    totalAuthorities: 'רשויות שנמענו',
    method: `הכרעה נספרת מ-${MANDATE_MIN_BALLOTS} קולות ומעלה, ורק כשיש עמדה מובילה אחת. תיקו אינו הכרעה.`,
    demoStamp: 'הדגמה · DEMO',
    demoNote:
      'המסך הזה מציג מנדט לדוגמה לצורכי הצגה בלבד. ההכרעות, הרוב ומספרי הקולות שבו הומצאו ואינם תוצאה של הצבעה. המנדט האמיתי נמצא בכתובת הזו ללא ?demo=1.',
    tabNational: 'ממשלה וכנסת',
    tabMunicipal: 'מדינה · רשויות',
    decided: 'הוכרע',
    standing: 'מצב נוכחי',
    decidedNote: 'ההצבעה נסגרה. זו עמדת התושבים בנושא.',
    standingNote: 'ההצבעה עדיין פתוחה - המספר יכול להשתנות עד לסגירה.',
    ballotsUnit: 'קולות',
    marginLabel: 'פער',
    marginUnit: 'נקודות',
    authorityFilterLabel: 'סינון לפי רשות',
    authorityAll: 'כל הרשויות',
    emptyNational: 'עוד לא הוכרע דבר ברמה הארצית.',
    emptyMunicipal: 'עוד לא הוכרע דבר ברשויות.',
    emptyNote:
      'הנושאים פתוחים והספירה רצה. ברגע שהצבעה תיסגר עם רוב ברור, ההחלטה תופיע כאן בשם התושבים שהצביעו בה.',
    emptyStamp: 'הספירה רצה · COUNTING',
    emptyCta: 'להצבעות הפתוחות ←',
    readVote: 'לרשומת ההצבעה ←',
    decidedThat: 'הוכרע על ידי האזרחים ש-',
  },
  en: {
    metaTitle: 'The civic mandate · Taruu',
    metaDescription:
      'What the residents have already decided: every counted civic decision, addressed to the government and the Knesset or to a named local authority.',
    crumbHome: 'Home',
    crumbMandate: 'The civic mandate',
    kicker: 'THE CIVIC MANDATE',
    titleLead: 'Decided by',
    titleAccent: 'the residents.',
    standfirst:
      'This is what has been counted so far. Every line is a decision taken by verified residents on one topic - who it is addressed to, how many votes stand behind it, and at what majority. Closed decisions are stamped as such; open ballots are shown as a current standing only.',
    totalDecided: 'Closed decisions',
    totalStanding: 'Standings on open ballots',
    totalBallots: 'Votes counted',
    totalAuthorities: 'Authorities addressed',
    method: `A decision is counted from ${MANDATE_MIN_BALLOTS} votes up, and only where one position leads. A tie is not a decision.`,
    demoStamp: 'DEMO',
    demoNote:
      'This screen shows a sample mandate for presentation only. Its decisions, majorities and vote counts are invented and are not the result of any ballot. The real register is at this address without ?demo=1.',
    tabNational: 'Government & Knesset',
    tabMunicipal: 'The state · authorities',
    decided: 'Decided',
    standing: 'Standing',
    decidedNote: 'The ballot is closed. This is the residents’ position on it.',
    standingNote: 'The ballot is still open - this can change before it closes.',
    ballotsUnit: 'votes',
    marginLabel: 'margin',
    marginUnit: 'points',
    authorityFilterLabel: 'Filter by authority',
    authorityAll: 'All authorities',
    emptyNational: 'Nothing has been decided nationally yet.',
    emptyMunicipal: 'Nothing has been decided in the authorities yet.',
    emptyNote:
      'The topics are open and the count is running. The moment a ballot closes with a clear majority, the decision appears here in the name of the residents who cast it.',
    emptyStamp: 'COUNTING',
    emptyCta: 'To the open ballots →',
    readVote: 'Vote record →',
    decidedThat: 'The residents decided that',
  },
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = COPY[locale];
  return { title: t.metaTitle, description: t.metaDescription };
}

/**
 * The civic mandate - the register of what residents have decided.
 *
 * The desks are the present tense of this product and this page is its
 * perfect tense: a topic leaves the desk when it closes and arrives here as
 * an instruction with a number behind it. It is deliberately one page rather
 * than a per-authority tab buried in each profile, because the argument the
 * product makes is cumulative - a single authority ignoring one decision is a
 * dispute, and a register of decisions is a mandate.
 */
export default async function MandatePage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const t = COPY[locale];
  const query = await searchParams;
  /* Presentation mode. The counted register is not consulted at all here, so
     a demo run can never be a partial mix of invented and real decisions. */
  const demo = isDemoRequested(query[DEMO_QUERY_FLAG]);
  const mandate = demo
    ? { national: [...DEMO_NATIONAL], municipal: [...DEMO_MUNICIPAL], totals: DEMO_TOTALS }
    : await civicMandate();
  const numberFormat = (value: number) =>
    value.toLocaleString(locale === 'he' ? 'he-IL' : 'en-US');

  return (
    <div className="np-page">
      <Masthead locale={locale} />

      <main className={styles.page}>
        <div className={styles.inner}>
          <header className={styles.hero}>
            <nav className={styles.breadcrumb} aria-label={t.crumbMandate}>
              <a className={styles.crumb} href={locale === 'he' ? '/' : `/${locale}`}>
                {t.crumbHome}
              </a>
              <span aria-hidden>/</span>
              <span>{t.crumbMandate}</span>
            </nav>

            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              {t.kicker}
            </span>

            {/* The stamp sits with the headline, not in a footnote: anything
                that can be screenshotted has to carry its own disclaimer. */}
            {demo && (
              <p className={styles.demoBanner} role="status">
                <span className={styles.demoStamp}>{t.demoStamp}</span>
                {t.demoNote}
              </p>
            )}

            <h1 className={styles.title}>
              {t.titleLead} <span className={styles.red}>{t.titleAccent}</span>
            </h1>
            <p className={styles.standfirst}>{t.standfirst}</p>
          </header>

          <dl className={styles.totals}>
            <div className={styles.total}>
              <dt>{t.totalDecided}</dt>
              <dd>{numberFormat(mandate.totals.decided)}</dd>
            </div>
            <div className={styles.total}>
              <dt>{t.totalStanding}</dt>
              <dd>{numberFormat(mandate.totals.standing)}</dd>
            </div>
            <div className={styles.total}>
              <dt>{t.totalBallots}</dt>
              <dd>{numberFormat(mandate.totals.ballotsCounted)}</dd>
            </div>
            <div className={styles.total}>
              <dt>{t.totalAuthorities}</dt>
              <dd>{numberFormat(mandate.totals.authorities)}</dd>
            </div>
          </dl>

          <MandateBoard
            national={mandate.national}
            municipal={mandate.municipal}
            copy={t}
            locale={locale}
          />

          <p className={styles.emptyNote}>{t.method}</p>
        </div>
      </main>

      <Colophon locale={locale} />
    </div>
  );
}
