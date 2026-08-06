'use client';

import { useState } from 'react';
import { NewsButton } from '@/components/press/NewsButton';
import { LiveVoteWidget } from '@/components/press/VoteWidget';
import type { Locale } from '@/lib/i18n';
import styles from './Participate.module.css';

interface ParticipateProps {
  locale?: Locale;
}

interface ConsensusBar {
  label: string;
  pct: number;
}

interface ParticipateCopy {
  kicker: string;
  headline: string;
  headlineRed: string;
  standfirst: string;
  fig1Title: string;
  fig1Note: string;
  fig2Title: string;
  voteBtn: string;
  joinBtn: string;
  readMoreBtn: string;
  fig2Note: string;
  fig3Title: string;
  bars: readonly ConsensusBar[];
  fig3Note: string;
  fig4Title: string;
  inputLabel: string;
  placeholder: string;
  submitBtn: string;
  fig4Note: string;
  arrow: string;
}

const COPY: Record<Locale, ParticipateCopy> = {
  he: {
    kicker: 'השליטה בידיים שלכם · PARTICIPATE',
    headline: 'ככה משתתפים:',
    headlineRed: 'בתוך העמוד.',
    standfirst:
      'כל כלי ההשתתפות גלויים על השולחן. בלי תפריטים נסתרים ובלי טפסים אינסופיים. רואים בדיוק איך הקול נמדד, מאומת ונספר.',
    fig1Title: 'תא הקלפי',
    fig1Note: 'FIG. 1 · תא הקלפי. בחרו עמדה, ראו את הספירה בזמן אמת.',
    fig2Title: 'כפתורי פעולה',
    voteBtn: 'הצביעו',
    joinBtn: 'הצטרפו',
    readMoreBtn: 'קראו עוד',
    fig2Note: 'FIG. 2 · משטחי פעולה.',
    fig3Title: 'מד תמיכה',
    bars: [
      { label: 'בעד', pct: 72 },
      { label: 'נגד', pct: 19 },
      { label: 'נמנע', pct: 9 },
    ],
    fig3Note: 'FIG. 3 · מד קונצנזוס.',
    fig4Title: 'הצעת נושא',
    inputLabel: 'הציעו נושא להצבעה',
    placeholder: 'מה מטריד אתכם ברחוב?',
    submitBtn: 'שלחו',
    fig4Note: 'FIG. 4 · טור הקוראים.',
    arrow: '←',
  },
  en: {
    kicker: 'CONTROL IN YOUR HANDS · PARTICIPATE',
    headline: 'This is how you participate:',
    headlineRed: 'inside the page.',
    standfirst:
      'Every participation tool is out on the table. No hidden menus and no endless forms. You see exactly how a vote is measured, verified, and counted.',
    fig1Title: 'The voting booth',
    fig1Note: 'FIG. 1 · The voting booth. Pick a position, watch the count in real time.',
    fig2Title: 'Action buttons',
    voteBtn: 'Vote',
    joinBtn: 'Join',
    readMoreBtn: 'Read more',
    fig2Note: 'FIG. 2 · Action surfaces.',
    fig3Title: 'Support meter',
    bars: [
      { label: 'For', pct: 72 },
      { label: 'Against', pct: 19 },
      { label: 'Abstain', pct: 9 },
    ],
    fig3Note: 'FIG. 3 · Consensus meter.',
    fig4Title: 'Propose a topic',
    inputLabel: 'Propose a topic for a vote',
    placeholder: 'What bothers you on your street?',
    submitBtn: 'Submit',
    fig4Note: "FIG. 4 · The readers' column.",
    arrow: '→',
  },
};

/**
 * Participate - the control-surfaces showcase. The brand idea, made literal:
 * you don't just read the paper, you participate inside it. The participation
 * control surfaces are laid out as styled press furniture (a technical spec
 * page), each captioned like a figure plate. Surfaces are interactive/styled,
 * not a full working flow.
 */
export function Participate({ locale = 'he' }: ParticipateProps) {
  const [topic, setTopic] = useState('');
  const t = COPY[locale];

  return (
    <section id="participate" className={styles.participate}>
      <div className={styles.inner}>
        {/* Section header - kicker, headline, standfirst */}
        <header className={styles.header}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            {t.kicker}
          </span>

          <h2 className={styles.headline}>
            {t.headline} <span className={styles.red}>{t.headlineRed}</span>
          </h2>

          <p className={styles.standfirst}>{t.standfirst}</p>
        </header>

        <div className={styles.ruleHeavy} aria-hidden />

        {/* Spec-sheet gallery of control surfaces */}
        <div className={styles.specSheet}>
          {/* FIG. 1 - הצבעה חיה (live ballot) */}
          <figure className={`${styles.fig} ${styles.figBallot}`}>
            <figcaption className={styles.figHead}>
              <span className={styles.figNo}>FIG. 1</span>
              <span className={styles.figTitle}>{t.fig1Title}</span>
            </figcaption>
            <div className={styles.figBody}>
              <LiveVoteWidget issueNo="04" locale={locale} />
            </div>
            <p className={styles.figNote}>{t.fig1Note}</p>
          </figure>

          {/* FIG. 2 - כפתורי פעולה (action surfaces) */}
          <figure className={`${styles.fig} ${styles.figButtons}`}>
            <figcaption className={styles.figHead}>
              <span className={styles.figNo}>FIG. 2</span>
              <span className={styles.figTitle}>{t.fig2Title}</span>
            </figcaption>
            <div className={styles.figBody}>
              <div className={styles.buttonRack}>
                <div className={styles.buttonCell}>
                  <span className={styles.cellLabel}>VARIANT · RED</span>
                  <NewsButton variant="red" size="md" trailing={<span aria-hidden>{t.arrow}</span>}>
                    {t.voteBtn}
                  </NewsButton>
                </div>
                <div className={styles.buttonCell}>
                  <span className={styles.cellLabel}>VARIANT · INK</span>
                  <NewsButton variant="ink" size="md" trailing={<span aria-hidden>{t.arrow}</span>}>
                    {t.joinBtn}
                  </NewsButton>
                </div>
                <div className={styles.buttonCell}>
                  <span className={styles.cellLabel}>VARIANT · OUTLINE</span>
                  <NewsButton variant="outline" size="md">
                    {t.readMoreBtn}
                  </NewsButton>
                </div>
              </div>
            </div>
            <p className={styles.figNote}>{t.fig2Note}</p>
          </figure>

          {/* FIG. 3 - מד תמיכה (consensus meter) */}
          <figure className={`${styles.fig} ${styles.figMeter}`}>
            <figcaption className={styles.figHead}>
              <span className={styles.figNo}>FIG. 3</span>
              <span className={styles.figTitle}>{t.fig3Title}</span>
            </figcaption>
            <div className={styles.figBody}>
              <ul className={styles.meterList}>
                {t.bars.map((bar) => (
                  <li key={bar.label} className={styles.meterRow}>
                    <span className={styles.meterLabel}>{bar.label}</span>
                    <span className={styles.meterTrack}>
                      <span
                        className={styles.meterFill}
                        style={{ inlineSize: `${bar.pct}%` }}
                        aria-hidden
                      />
                    </span>
                    <span className={styles.meterPct}>{bar.pct}%</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className={styles.figNote}>{t.fig3Note}</p>
          </figure>

          {/* FIG. 4 - הצעת נושא (readers' column input) */}
          <figure className={`${styles.fig} ${styles.figInput}`}>
            <figcaption className={styles.figHead}>
              <span className={styles.figNo}>FIG. 4</span>
              <span className={styles.figTitle}>{t.fig4Title}</span>
            </figcaption>
            <div className={styles.figBody}>
              <form
                className={styles.proposeForm}
                onSubmit={(e) => e.preventDefault()}
              >
                <label className={styles.inputLabel} htmlFor="participate-topic">
                  {t.inputLabel}
                </label>
                <input
                  id="participate-topic"
                  type="text"
                  className={styles.input}
                  placeholder={t.placeholder}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
                <div className={styles.proposeActions}>
                  <NewsButton
                    type="submit"
                    variant="red"
                    size="md"
                    trailing={<span aria-hidden>{t.arrow}</span>}
                  >
                    {t.submitBtn}
                  </NewsButton>
                </div>
              </form>
            </div>
            <p className={styles.figNote}>{t.fig4Note}</p>
          </figure>
        </div>
      </div>
    </section>
  );
}
