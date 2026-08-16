'use client';

import type { Locale } from '@/lib/i18n';
import styles from './Pillars.module.css';

interface PillarsProps {
  locale?: Locale;
}

interface Pillar {
  no: string;
  kicker: string;
  body: string;
  glyph: 'measure' | 'verify' | 'broadcast';
}

interface PillarsCopy {
  kicker: string;
  headline: string;
  headlineRed: string;
  pillars: readonly Pillar[];
}

const COPY: Record<Locale, PillarsCopy> = {
  he: {
    kicker: 'המנגנון · בשלוש מילים',
    headline: 'שלושה דברים שהופכים דעה',
    headlineRed: 'לכוח.',
    pillars: [
      {
        no: '01',
        kicker: 'מודדים',
        body: 'כמה באמת תומכים, כמה מתנגדים. לא תחושת בטן ולא מי שצועק חזק: מספר מדויק.',
        glyph: 'measure',
      },
      {
        no: '02',
        kicker: 'מאמתים',
        body: 'כל קול הוא תושב אמיתי אחד: זהות ו-GPS, חתום בבלוקצ׳יין. בלי בוטים ובלי כפילויות.',
        glyph: 'verify',
      },
      {
        no: '03',
        kicker: 'מנגישים',
        body: 'התמונה המלאה פתוחה לכולם, לתושבים ולמועצה כאחד. בלי חדרים סגורים.',
        glyph: 'broadcast',
      },
    ],
  },
  en: {
    kicker: 'THE MECHANISM · IN THREE WORDS',
    headline: 'Three things that turn an opinion',
    headlineRed: 'into power.',
    pillars: [
      {
        no: '01',
        kicker: 'Measure',
        body: 'How many are truly in favor, how many are against. Not a gut feeling and not whoever shouts loudest: a precise number.',
        glyph: 'measure',
      },
      {
        no: '02',
        kicker: 'Verify',
        body: 'Every vote is one real resident: identity and GPS, sealed on the blockchain. No bots and no duplicates.',
        glyph: 'verify',
      },
      {
        no: '03',
        kicker: 'Publish',
        body: 'The full picture is open to everyone, residents and council alike. No closed rooms.',
        glyph: 'broadcast',
      },
    ],
  },
};

function Glyph({ kind }: { kind: Pillar['glyph'] }) {
  // Hard-edged ink SVG glyphs - no rounding, crisp strokes.
  const common = {
    width: 40,
    height: 40,
    viewBox: '0 0 40 40',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.5,
    'aria-hidden': true,
    focusable: false,
    shapeRendering: 'crispEdges' as const,
  };

  switch (kind) {
    case 'measure':
      // Bar chart - three ascending bars on a baseline.
      return (
        <svg className={styles.glyph} {...common}>
          <path d="M4 36 H36" />
          <rect x="6" y="24" width="7" height="12" fill="currentColor" stroke="none" />
          <rect x="16.5" y="14" width="7" height="22" fill="currentColor" stroke="none" />
          <rect x="27" y="6" width="7" height="30" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'verify':
      // Shield with check.
      return (
        <svg className={styles.glyph} {...common}>
          <path d="M20 4 L34 9 V19 C34 28 27 34 20 37 C13 34 6 28 6 19 V9 Z" />
          <path d="M14 20 L18 25 L27 14" />
        </svg>
      );
    case 'broadcast':
    default:
      // Broadcast - central node with radiating arcs.
      return (
        <svg className={styles.glyph} {...common}>
          <rect x="16" y="16" width="8" height="8" fill="currentColor" stroke="none" />
          <path d="M11 11 C7.5 14.5 7.5 25.5 11 29" />
          <path d="M29 11 C32.5 14.5 32.5 25.5 29 29" />
          <path d="M6 6 C0 12 0 28 6 34" />
          <path d="M34 6 C40 12 40 28 34 34" />
        </svg>
      );
  }
}

export function Pillars({ locale = 'he' }: PillarsProps) {
  const t = COPY[locale];

  return (
    <section className={styles.pillars} aria-labelledby="pillars-headline">
      <div className={styles.inner}>
        <header className={styles.head}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            {t.kicker}
          </span>
          <h2 id="pillars-headline" className={styles.headline}>
            {t.headline} <span className={styles.red}>{t.headlineRed}</span>
          </h2>
        </header>

        <div className={styles.columns}>
          {t.pillars.map((p) => (
            <article key={p.no} className={styles.box}>
              <div className={styles.boxTop}>
                <span className={styles.no} aria-hidden>
                  {p.no}
                </span>
                <span className={styles.glyphWrap}>
                  <Glyph kind={p.glyph} />
                </span>
              </div>

              <h3 className={styles.title}>{p.kicker}</h3>

              <hr className={styles.rule} aria-hidden />

              <p className={styles.body}>{p.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
