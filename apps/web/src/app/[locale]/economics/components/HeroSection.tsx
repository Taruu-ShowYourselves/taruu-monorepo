'use client';

import type { Locale } from '@/lib/i18n';
import styles from './HeroSection.module.css';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';

const WHATSAPP_LINK = WHATSAPP_FOUNDERS_LINK;

/** Hard-edged ink ballot/coin glyphs for the flow diagram - no rounding. */
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
      // Ascending bars - real resources.
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

/**
 * Red mechanical arrow connector (CSS-driven color, hard strokes).
 *
 * Drawn pointing left, which is forward in RTL. The English edition reads the
 * other way, so it mirrors — an arrow that points backwards down the flow is
 * worse than no arrow.
 */
function Arrow({ flip }: { flip: boolean }) {
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
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path d="M38 12 H6" />
      <path d="M14 4 L6 12 L14 20" />
    </svg>
  );
}

interface HeroCopy {
  kicker: string;
  edition: string;
  headlineLead: string;
  headlineAccent: string;
  standfirst: string;
  foundersCta: string;
  howItWorks: string;
  flowHead: string;
  flowAria: string;
  flow: { kind: 'vote' | 'fund' | 'impact'; label: string }[];
  /** Direction-semantic arrow: Hebrew ←, English →. */
  arrow: string;
}

const COPY: Record<Locale, HeroCopy> = {
  he: {
    kicker: 'הכלכלה האזרחית · ECONOMICS',
    edition: 'תַּרְאוּ · גיליון כלכלה',
    headlineLead: 'איך הצבעה אחת בונה קהילה',
    headlineAccent: 'שמשפיעה.',
    standfirst:
      'כל הצבעה מקבלת BAG משלה ב-bags.fm: מטבע ממים מבוסס בלוקצ׳יין שמאפשר לאנשים מבחוץ להשקיע בתנועה הכלכלית של ההצבעה, בדיוק כמו במניה, ולתמוך בביצוע ההחלטה של הרוב. ככל שה-BAG גדל, כך לנושא יותר משאבים אמיתיים מאחוריו. כל עסקה גלויה.',
    foundersCta: 'קבוצת המייסדים',
    howItWorks: 'איך זה עובד ↓',
    flowHead: 'מסלול ההשפעה · THE FLOW',
    flowAria: 'הצבעה זורמת אל קרן קהילתית ואל השפעה אמיתית',
    flow: [
      { kind: 'vote', label: 'הצבעה' },
      { kind: 'fund', label: 'קרן קהילתית' },
      { kind: 'impact', label: 'השפעה אמיתית' },
    ],
    arrow: '←',
  },
  en: {
    kicker: 'CIVIC ECONOMICS',
    edition: 'Taruu · the economics edition',
    headlineLead: 'How one vote builds a community',
    headlineAccent: 'that carries weight.',
    standfirst:
      'Every vote gets its own BAG on bags.fm: a blockchain-based meme coin that lets outsiders invest in the economic momentum of the vote, much as they would in a share, and back carrying out the majority decision. The larger the BAG grows, the more real resources stand behind the topic. Every transaction is visible.',
    foundersCta: 'The founders group',
    howItWorks: 'How it works ↓',
    flowHead: 'THE FLOW',
    flowAria: 'A vote flows into a community fund and into real impact',
    flow: [
      { kind: 'vote', label: 'Vote' },
      { kind: 'fund', label: 'Community fund' },
      { kind: 'impact', label: 'Real impact' },
    ],
    arrow: '→',
  },
};

export function HeroSection({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  const FLOW = t.flow;

  return (
    <section className={styles.hero} aria-labelledby="econ-hero-title">
      <div className={styles.inner}>
        <div className={styles.dateline}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            {t.kicker}
          </span>
          <span className={styles.edition} aria-hidden>
            {t.edition}
          </span>
        </div>

        <hr className="np-rule-heavy" />

        <div className={styles.grid}>
          <div className={styles.story}>
            <h1 id="econ-hero-title" className={styles.headline}>
              {t.headlineLead} <span className={styles.red}>{t.headlineAccent}</span>
            </h1>

            <p className={styles.standfirst}>{t.standfirst}</p>

            <div className={styles.actions}>
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.primaryBtn}
              >
                <span className={styles.btnLabel}>{t.foundersCta}</span>
                <span aria-hidden className={styles.btnTrailing}>
                  {t.arrow}
                </span>
              </a>
              <a href="#flywheel" className={styles.textLink}>
                {t.howItWorks}
              </a>
            </div>
          </div>

          {/* Mechanical money-flow press diagram */}
          <aside className={styles.colFlow}>
            <span className={styles.flowHead}>{t.flowHead}</span>
            <ol className={styles.flow} aria-label={t.flowAria}>
              {FLOW.map((n, i) => (
                <li key={n.label} className={styles.flowItem}>
                  <div className={styles.node}>
                    <span className={styles.nodeNum} aria-hidden>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className={styles.nodeGlyphWrap}>
                      <FlowGlyph kind={n.kind} />
                    </span>
                    <span className={styles.nodeLabel}>{n.label}</span>
                  </div>
                  {i < FLOW.length - 1 ? (
                    <span className={styles.arrowWrap} aria-hidden>
                      <Arrow flip={locale !== 'he'} />
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
