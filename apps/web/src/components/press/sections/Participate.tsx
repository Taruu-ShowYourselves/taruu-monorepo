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

const CONSENSUS_BARS: ConsensusBar[] = [
  { label: 'בעד', pct: 72 },
  { label: 'נגד', pct: 19 },
  { label: 'נמנע', pct: 9 },
];

/**
 * Participate — the control-surfaces showcase. The brand idea, made literal:
 * you don't just read the paper, you participate inside it. The participation
 * control surfaces are laid out as styled press furniture (a technical spec
 * page), each captioned like a figure plate. Surfaces are interactive/styled,
 * not a full working flow.
 */
export function Participate({ locale = 'he' }: ParticipateProps) {
  const [topic, setTopic] = useState('');

  return (
    <section id="participate" className={styles.participate}>
      <div className={styles.inner}>
        {/* Section header — kicker, headline, standfirst */}
        <header className={styles.header}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            השליטה בידיים שלכם · PARTICIPATE
          </span>

          <h2 className={styles.headline}>
            ככה משתתפים: <span className={styles.red}>בתוך העמוד.</span>
          </h2>

          <p className={styles.standfirst}>
            כל כלי ההשתתפות גלויים על השולחן. בלי תפריטים נסתרים ובלי טפסים
            אינסופיים. רואים בדיוק איך הקול נמדד, מאומת ונספר.
          </p>
        </header>

        <div className={styles.ruleHeavy} aria-hidden />

        {/* Spec-sheet gallery of control surfaces */}
        <div className={styles.specSheet}>
          {/* FIG. 1 — הצבעה חיה (live ballot) */}
          <figure className={`${styles.fig} ${styles.figBallot}`}>
            <figcaption className={styles.figHead}>
              <span className={styles.figNo}>FIG. 1</span>
              <span className={styles.figTitle}>תא הקלפי</span>
            </figcaption>
            <div className={styles.figBody}>
              <LiveVoteWidget issueNo="04" />
            </div>
            <p className={styles.figNote}>
              FIG. 1 · תא הקלפי. בחרו עמדה, ראו את הספירה בזמן אמת.
            </p>
          </figure>

          {/* FIG. 2 — כפתורי פעולה (action surfaces) */}
          <figure className={`${styles.fig} ${styles.figButtons}`}>
            <figcaption className={styles.figHead}>
              <span className={styles.figNo}>FIG. 2</span>
              <span className={styles.figTitle}>כפתורי פעולה</span>
            </figcaption>
            <div className={styles.figBody}>
              <div className={styles.buttonRack}>
                <div className={styles.buttonCell}>
                  <span className={styles.cellLabel}>VARIANT · RED</span>
                  <NewsButton variant="red" size="md" trailing={<span aria-hidden>←</span>}>
                    הצביעו
                  </NewsButton>
                </div>
                <div className={styles.buttonCell}>
                  <span className={styles.cellLabel}>VARIANT · INK</span>
                  <NewsButton variant="ink" size="md" trailing={<span aria-hidden>←</span>}>
                    הצטרפו
                  </NewsButton>
                </div>
                <div className={styles.buttonCell}>
                  <span className={styles.cellLabel}>VARIANT · OUTLINE</span>
                  <NewsButton variant="outline" size="md">
                    קראו עוד
                  </NewsButton>
                </div>
              </div>
            </div>
            <p className={styles.figNote}>FIG. 2 · משטחי פעולה.</p>
          </figure>

          {/* FIG. 3 — מד תמיכה (consensus meter) */}
          <figure className={`${styles.fig} ${styles.figMeter}`}>
            <figcaption className={styles.figHead}>
              <span className={styles.figNo}>FIG. 3</span>
              <span className={styles.figTitle}>מד תמיכה</span>
            </figcaption>
            <div className={styles.figBody}>
              <ul className={styles.meterList}>
                {CONSENSUS_BARS.map((bar) => (
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
            <p className={styles.figNote}>FIG. 3 · מד קונצנזוס.</p>
          </figure>

          {/* FIG. 4 — הצעת נושא (readers' column input) */}
          <figure className={`${styles.fig} ${styles.figInput}`}>
            <figcaption className={styles.figHead}>
              <span className={styles.figNo}>FIG. 4</span>
              <span className={styles.figTitle}>הצעת נושא</span>
            </figcaption>
            <div className={styles.figBody}>
              <form
                className={styles.proposeForm}
                onSubmit={(e) => e.preventDefault()}
              >
                <label className={styles.inputLabel} htmlFor="participate-topic">
                  הציעו נושא להצבעה
                </label>
                <input
                  id="participate-topic"
                  type="text"
                  className={styles.input}
                  placeholder="מה מטריד אתכם ברחוב?"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
                <div className={styles.proposeActions}>
                  <NewsButton
                    type="submit"
                    variant="red"
                    size="md"
                    trailing={<span aria-hidden>←</span>}
                  >
                    שלחו
                  </NewsButton>
                </div>
              </form>
            </div>
            <p className={styles.figNote}>FIG. 4 · טור הקוראים.</p>
          </figure>
        </div>
      </div>
    </section>
  );
}
