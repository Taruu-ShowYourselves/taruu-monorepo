import 'server-only';
import { KNESSET_SCOPE } from '@sync/shared';
import { formatScore, scoreBand } from '@/lib/civic/score';
import { municipalityCivicStats } from '@/server/read/municipality-stats';
import { governmentStats } from '@/server/read/government';
import { civicMandate } from '@/server/read/mandate';
import type { Locale } from '@/lib/i18n';
import { MandateSheet } from './MandateSheet';
import styles from './BeatStages.module.css';

/**
 * The backdrops the thesis beats stand in front of.
 *
 * Each beat makes a different claim, so each gets the part of the product that
 * makes that claim true rather than a pattern that decorates it. The ballots
 * themselves are not here: the beat about legitimacy is backed by the live
 * carousel, the real desk rather than a drawing of it. What is here is the
 * scores those ballots add up to, and the mandate read out of them. All three are server components off the same reads
 * the rest of the site uses - the intro is a client island, so they are handed
 * down as nodes rather than fetched again.
 *
 * Every one of them prints an honest empty state. A young ledger is a true
 * fact about this product today, and a backdrop that invented decisions to
 * look busy would be inventing exactly the thing the page is asking to be
 * trusted about.
 */

const he = (value: number, locale: Locale) =>
  value.toLocaleString(locale === 'he' ? 'he-IL' : 'en-US');

interface StageCopy {
  ballotsUnit: string;
  scoresKicker: string;
  scoreGovernment: string;
  scoreRepresentation: string;
  scoreEngagement: string;
  scoreTrust: string;
  scoreUnmeasured: string;
  authoritiesKicker: string;
  mandateKicker: string;
  mandateLead: string;
  mandateEmpty: string;
  mandateEmptyNote: string;
  mandateShareUnit: string;
  demoStamp: string;
}

const COPY: Record<Locale, StageCopy> = {
  he: {
    ballotsUnit: 'קולות',
    scoresKicker: 'הדירוג · THE SCORE',
    scoreGovernment: 'ציון הממשלה',
    scoreRepresentation: 'ייצוגיות',
    scoreEngagement: 'מעורבות',
    scoreTrust: 'אמון',
    scoreUnmeasured: 'טרם נמדד',
    authoritiesKicker: 'רשויות · AUTHORITIES',
    mandateKicker: 'המנדט האזרחי · THE MANDATE',
    mandateLead: 'הוכרע על ידי האזרחים ש־',
    mandateEmpty: 'המנדט עוד ריק.',
    mandateEmptyNote: 'ההחלטה הראשונה תיכתב כאן ברגע שהצבעה תיסגר ברוב ברור.',
    mandateShareUnit: 'רוב',
    demoStamp: 'הדגמה',
  },
  en: {
    ballotsUnit: 'votes',
    scoresKicker: 'THE SCORE',
    scoreGovernment: 'Government score',
    scoreRepresentation: 'Representation',
    scoreEngagement: 'Engagement',
    scoreTrust: 'Trust',
    scoreUnmeasured: 'Not measured yet',
    authoritiesKicker: 'AUTHORITIES',
    mandateKicker: 'THE CIVIC MANDATE',
    mandateLead: 'The residents decided that',
    mandateEmpty: 'The mandate is still empty.',
    mandateEmptyNote:
      'The first decision is written here the moment a ballot closes with a clear majority.',
    mandateShareUnit: 'majority',
    demoStamp: 'demo',
  },
};

/** Where a stage's cards hang in the field, clear of the centred beat column. */
const CARD_SLOTS = [
  { x: '3%', y: '10%', depth: 0.9 },
  { x: '70%', y: '8%', depth: 0.55 },
  { x: '74%', y: '46%', depth: 0.95 },
  { x: '2%', y: '52%', depth: 0.45 },
  { x: '10%', y: '78%', depth: 0.72 },
  { x: '64%', y: '76%', depth: 0.5 },
] as const;

function slotStyle(index: number) {
  const slot = CARD_SLOTS[index % CARD_SLOTS.length];
  return {
    '--card-x': slot.x,
    '--card-y': slot.y,
    '--depth': slot.depth,
  } as React.CSSProperties;
}

/* ------------------------------------------------------------------ */
/* Beat: the rating - the scores the answers add up to.                 */
/* ------------------------------------------------------------------ */

interface ScoreCard {
  key: string;
  label: string;
  sub: string;
  score: number | null;
}

/**
 * The score cards, on the same signed −100..+100 track the government and
 * municipality profiles use. An unmeasured axis prints an em-dash and says so
 * rather than showing a zero, which would read as a measured floor.
 */
export async function BeatScoresStage({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  const [gov, authorities] = await Promise.all([
    governmentStats(),
    municipalityCivicStats(),
  ]);

  const topAuthorities = [...authorities]
    .sort((a, b) => (b.openTopics ?? 0) - (a.openTopics ?? 0))
    .slice(0, 3);

  const cards: ScoreCard[] = [
    {
      key: 'gov-overall',
      label: t.scoreGovernment,
      sub: gov?.knessetNum ? `כנסת ${gov.knessetNum}` : KNESSET_SCOPE,
      score: gov?.overallScore ?? null,
    },
    {
      key: 'gov-representation',
      label: t.scoreRepresentation,
      sub: KNESSET_SCOPE,
      score: gov?.representationScore ?? null,
    },
    {
      key: 'gov-engagement',
      label: t.scoreEngagement,
      sub: KNESSET_SCOPE,
      score: gov?.engagementScore ?? null,
    },
    ...topAuthorities.map((authority) => ({
      key: `muni-${authority.municipality}`,
      label: authority.municipality,
      sub: `${authority.openTopics} · ${t.authoritiesKicker.split(' · ')[0]}`,
      score: authority.overallScore,
    })),
  ];

  return (
    <div className={styles.stage} aria-hidden>
      <span className={styles.stageKicker}>{t.scoresKicker}</span>
      {cards.map((card, index) => (
        <article
          className={styles.scoreCard}
          data-thesis-metric
          data-depth={CARD_SLOTS[index % CARD_SLOTS.length].depth}
          data-band={scoreBand(card.score)}
          key={card.key}
          style={slotStyle(index)}
        >
          <span className={styles.scoreLabel}>{card.label}</span>
          <b className={styles.scoreValue}>{formatScore(card.score)}</b>
          {/* Zero is drawn, and the bar runs from it, so the length of the bar
              is the deviation rather than the value - the same track the
              profiles use. */}
          <span className={styles.scoreTrack} aria-hidden>
            <i
              style={{
                insetInlineStart: `${card.score === null ? 50 : 50 + Math.min(0, card.score) / 2}%`,
                inlineSize: `${card.score === null ? 0 : Math.abs(card.score) / 2}%`,
              }}
            />
            <u />
          </span>
          <span className={styles.scoreSub}>
            {card.score === null ? t.scoreUnmeasured : card.sub}
          </span>
        </article>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Beat: the court - the mandate that would be handed over.             */
/* ------------------------------------------------------------------ */

/**
 * The mandate as it would be read out: one clause per decision, in the
 * ballot's own words, with the majority behind it. This is the same register
 * the /mandate page prints in full - the beat is a window onto it, not a
 * separate claim.
 */
export async function BeatMandateStage({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  const mandate = await civicMandate();
  const clauses = [...mandate.national, ...mandate.municipal].slice(0, 4);

  return (
    <div className={styles.stage} aria-hidden>
      <span className={styles.stageKicker}>{t.mandateKicker}</span>

      <MandateSheet
        clauses={clauses}
        numberLocale={locale === 'he' ? 'he-IL' : 'en-US'}
        copy={{
          lead: t.mandateLead,
          empty: t.mandateEmpty,
          emptyNote: t.mandateEmptyNote,
          shareUnit: t.mandateShareUnit,
          ballotsUnit: t.ballotsUnit,
          demoStamp: t.demoStamp,
        }}
      />
    </div>
  );
}
