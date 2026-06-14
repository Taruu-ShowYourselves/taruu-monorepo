'use client';

import styles from './HeroSection.module.css';

const WHATSAPP_LINK = 'https://chat.whatsapp.com/FITvea9IVsn2Ljie1yCrAc';

/** Hard-edged ink ballot/coin glyphs for the flow diagram — no rounding. */
function FlowGlyph({ kind }: { kind: 'vote' | 'fund' | 'impact' }) {
  const common = {
    viewBox: '0 0 40 40',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.4,
    'aria-hidden': true,
    focusable: false,
    shapeRendering: 'crispEdges' as const,
    className: styles.nodeGlyph,
  };
  switch (kind) {
    case 'vote':
      // Ballot into a box.
      return (
        <svg {...common}>
          <rect x="6" y="18" width="28" height="16" />
          <path d="M14 18 V8 H30 V18" />
          <path d="M18 26 H22" />
        </svg>
      );
    case 'fund':
      // Coin stack / fund vault.
      return (
        <svg {...common}>
          <rect x="7" y="10" width="26" height="20" />
          <path d="M7 16 H33" />
          <rect x="24" y="20" width="5" height="4" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'impact':
    default:
      // Ascending bars — real resources.
      return (
        <svg {...common}>
          <path d="M5 35 H35" />
          <rect x="8" y="24" width="6" height="11" fill="currentColor" stroke="none" />
          <rect x="17" y="16" width="6" height="19" fill="currentColor" stroke="none" />
          <rect x="26" y="8" width="6" height="27" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

/** Red mechanical arrow connector (CSS-driven color, hard strokes). */
function Arrow() {
  return (
    <svg
      className={styles.arrow}
      viewBox="0 0 40 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      aria-hidden
      focusable="false"
      shapeRendering="crispEdges"
    >
      {/* RTL: flow points to the inline-start (left). */}
      <path d="M38 12 H6" />
      <path d="M14 4 L6 12 L14 20" />
    </svg>
  );
}

const FLOW = [
  { kind: 'vote' as const, amount: '₪3', label: 'הצבעה' },
  { kind: 'fund' as const, label: 'קרן קהילתית' },
  { kind: 'impact' as const, label: 'השפעה אמיתית' },
];

export function HeroSection() {
  return (
    <section className={styles.hero} aria-labelledby="econ-hero-title">
      <div className={styles.inner}>
        <div className={styles.dateline}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            הכלכלה האזרחית · ECONOMICS
          </span>
          <span className={styles.edition} aria-hidden>
            תַּרְאוּ · גיליון כלכלה
          </span>
        </div>

        <hr className="np-rule-heavy" />

        <div className={styles.grid}>
          <div className={styles.story}>
            <h1 id="econ-hero-title" className={styles.headline}>
              איך 3 שקלים בונים קהילה <span className={styles.red}>שמשפיעה.</span>
            </h1>

            <p className={styles.standfirst}>
              כל הצבעה מזרימה כסף לקרן קהילתית ייעודית (Issue Coin) שמשרתת את הנושא
              עצמו. ככל שיותר תושבים תומכים — כך לנושא יותר משאבים אמיתיים מאחוריו.
              שקיפות מלאה, כל עסקה גלויה.
            </p>

            <div className={styles.actions}>
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.primaryBtn}
              >
                <span className={styles.btnLabel}>הצטרפו לפיילוט</span>
                <span aria-hidden className={styles.btnTrailing}>←</span>
              </a>
              <a href="#flywheel" className={styles.textLink}>
                איך זה עובד ↓
              </a>
            </div>
          </div>

          {/* Mechanical money-flow press diagram */}
          <aside className={styles.colFlow}>
            <span className={styles.flowHead}>מסלול ה-₪3 · THE FLOW</span>
            <ol
              className={styles.flow}
              aria-label="שלושה שקלים זורמים אל קרן קהילתית ואל השפעה אמיתית"
            >
              {FLOW.map((n, i) => (
                <li key={n.label} className={styles.flowItem}>
                  <div className={styles.node}>
                    <span className={styles.nodeNum} aria-hidden>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className={styles.nodeGlyphWrap}>
                      <FlowGlyph kind={n.kind} />
                    </span>
                    {n.amount ? (
                      <span className={styles.nodeAmount}>{n.amount}</span>
                    ) : null}
                    <span className={styles.nodeLabel}>{n.label}</span>
                  </div>
                  {i < FLOW.length - 1 ? (
                    <span className={styles.arrowWrap} aria-hidden>
                      <Arrow />
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </div>
    </section>
  );
}
