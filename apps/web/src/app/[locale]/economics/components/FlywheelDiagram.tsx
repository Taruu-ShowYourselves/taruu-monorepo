'use client';

import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks';
import type { Locale } from '@/lib/i18n';
import styles from './FlywheelDiagram.module.css';

const EASE = [0.2, 0, 0, 1] as const;

type IconName = 'resident' | 'coin' | 'globe' | 'trade' | 'split' | 'award';

interface FlywheelStep {
  id: string;
  title: string;
  description: string;
  icon: IconName;
}

/** Hard-edged ink ledger glyphs - crisp strokes, no rounding. */
function StepIcon({ name }: { name: IconName }) {
  const common = {
    viewBox: '0 0 32 32',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    'aria-hidden': true,
    focusable: false,
    shapeRendering: 'crispEdges' as const,
    className: styles.glyph,
  };
  switch (name) {
    case 'resident':
      return (
        <svg {...common}>
          <rect x="11" y="5" width="10" height="10" />
          <path d="M5 27 V21 H27 V27" />
        </svg>
      );
    case 'coin':
      return (
        <svg {...common}>
          <rect x="5" y="6" width="22" height="20" />
          <path d="M5 12 H27" />
          <rect x="19" y="17" width="4" height="4" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'globe':
      return (
        <svg {...common}>
          <rect x="5" y="5" width="22" height="22" />
          <path d="M5 16 H27 M16 5 V27" />
        </svg>
      );
    case 'trade':
      return (
        <svg {...common}>
          <path d="M5 22 L13 14 L19 18 L27 8" />
          <path d="M27 8 H21 M27 8 V14" />
        </svg>
      );
    case 'split':
      return (
        <svg {...common}>
          <path d="M16 5 V14" />
          <path d="M16 14 L8 24 M16 14 L24 24" />
          <rect x="5" y="24" width="6" height="3" fill="currentColor" stroke="none" />
          <rect x="21" y="24" width="6" height="3" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'award':
    default:
      return (
        <svg {...common}>
          <rect x="9" y="5" width="14" height="14" />
          <path d="M11 19 L9 27 L16 23 L23 27 L21 19" />
        </svg>
      );
  }
}

interface FlywheelCopy {
  kicker: string;
  headlineLead: string;
  headlineAccent: string;
  steps: FlywheelStep[];
  resultLabel: string;
  resultLead: string;
  resultNum: string;
  resultTail: string;
  revenueTitle: string;
  colStream: string;
  colSource: string;
  colAllocation: string;
  revenueStreams: { stream: string; source: string; allocation: string }[];
  noteHead: string;
  sustainabilityPoints: string[];
  /** Connector between nodes; the loop glyph is direction-neutral. */
  connector: string;
}

const COPY: Record<Locale, FlywheelCopy> = {
  he: {
    kicker: 'גלגל התנופה · THE LEDGER LOOP',
    headlineLead: 'כל הצבעה מפעילה מחזור כלכלי',
    headlineAccent: 'סביב הנושא.',
    steps: [
      { id: 'local', title: 'תושב מקומי', description: 'מצביע חינם, מאומת זהות ו-GPS', icon: 'resident' },
      { id: 'coin', title: 'BAG נוצר ב-bags.fm', description: 'ההצבעה נרשמת בבלוקצ\'יין', icon: 'coin' },
      { id: 'external', title: 'תומך חיצוני', description: 'מזהה נושא שחשוב לו', icon: 'globe' },
      { id: 'trade', title: 'קונה את ה-BAG', description: 'תמיכה שמייצרת עמלות', icon: 'trade' },
      { id: 'fees', title: 'עמלות מחולקות', description: '70% לקרן הרשות, 30% לפלטפורמה', icon: 'split' },
      { id: 'result', title: 'תוצאה נקבעת', description: 'תעודה דיגיטלית לכל משתתף', icon: 'award' },
    ],
    resultLabel: 'התוצאה',
    resultLead: 'הצבעה ',
    resultNum: 'אחת',
    resultTail: ' יכולה לרכז מאחורי הנושא משאבים אמיתיים, לא רק קול.',
    revenueTitle: 'זרמי הכנסה',
    colStream: 'זרם',
    colSource: 'מקור',
    colAllocation: 'הקצאה',
    revenueStreams: [
      { stream: 'יצירת הצבעה', source: '₪50 להצבעה חדשה', allocation: 'תפעול הפלטפורמה' },
      { stream: 'עמלות מסחר', source: '1% על כל עסקה', allocation: '70% לקרן · 30% לפלטפורמה' },
      { stream: 'רכישות חיצוניות', source: 'תמיכה → BAGS ב-bags.fm', allocation: '100% לקופת הקרן' },
    ],
    noteHead: 'ללא תלות במשקיעים חיצוניים',
    sustainabilityPoints: [
      'הפלטפורמה מתקיימת מהיום הראשון',
      'הרשויות מרוויחות, לא מוציאות',
      'התושבים מצביעים ומקבלים תעודה דיגיטלית',
      'תומכים חיצוניים מקבלים נכס סחיר ושקוף',
    ],
    connector: '←',
  },
  en: {
    kicker: 'THE LEDGER LOOP',
    headlineLead: 'Every vote sets an economic cycle turning',
    headlineAccent: 'around the topic.',
    steps: [
      { id: 'local', title: 'Local resident', description: 'Votes free, identity and GPS verified', icon: 'resident' },
      { id: 'coin', title: 'A BAG is created on bags.fm', description: 'The vote is recorded on the blockchain', icon: 'coin' },
      { id: 'external', title: 'Outside backer', description: 'Spots a topic that matters to them', icon: 'globe' },
      { id: 'trade', title: 'Buys the BAG', description: 'Support that generates fees', icon: 'trade' },
      { id: 'fees', title: 'Fees are split', description: "70% to the municipality's fund, 30% to the platform", icon: 'split' },
      { id: 'result', title: 'A result is set', description: 'A digital certificate for every participant', icon: 'award' },
    ],
    resultLabel: 'The result',
    resultLead: '',
    resultNum: 'One',
    resultTail: ' vote can gather real resources behind a topic, not just a voice.',
    revenueTitle: 'Revenue streams',
    colStream: 'Stream',
    colSource: 'Source',
    colAllocation: 'Allocation',
    revenueStreams: [
      { stream: 'Creating a vote', source: '₪50 per new vote', allocation: 'Platform operations' },
      { stream: 'Trading fees', source: '1% on every transaction', allocation: '70% to the fund · 30% to the platform' },
      { stream: 'Outside purchases', source: 'Support → BAGS on bags.fm', allocation: '100% to the fund' },
    ],
    noteHead: 'No dependence on outside investors',
    sustainabilityPoints: [
      'The platform sustains itself from day one',
      'Municipalities earn rather than spend',
      'Residents vote and receive a digital certificate',
      'Outside backers receive a tradable, transparent asset',
    ],
    connector: '→',
  },
};

export function FlywheelDiagram({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  const flywheelSteps = t.steps;
  const reduced = useReducedMotion();

  return (
    <section className={styles.flywheel} aria-labelledby="flywheel-title">
      <div className={styles.inner}>
        <header className={styles.head}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            {t.kicker}
          </span>
          <h2 id="flywheel-title" className={styles.headline}>
            {t.headlineLead} <span className={styles.red}>{t.headlineAccent}</span>
          </h2>
        </header>

        {/* Numbered cyclical ledger - boxed nodes connected by red arrows */}
        <ol className={styles.steps}>
          {flywheelSteps.map((step, index) => (
            <motion.li
              key={step.id}
              className={styles.step}
              initial={reduced ? false : { opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
              whileInView={{ opacity: 1, clipPath: 'inset(0 0 0 0)' }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: reduced ? 0 : 0.36, ease: EASE, delay: reduced ? 0 : 0.06 * index }}
            >
              <div className={styles.stepTop}>
                <span className={styles.stepNumber} aria-hidden>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className={styles.stepGlyph} aria-hidden>
                  <StepIcon name={step.icon} />
                </span>
              </div>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepDescription}>{step.description}</p>
              {/* Red connector to the next node; last loops back to the top. */}
              <span
                className={`${styles.connector} ${index === flywheelSteps.length - 1 ? styles.connectorLoop : ''}`}
                aria-hidden
              >
                {index === flywheelSteps.length - 1 ? '↺' : t.connector}
              </span>
            </motion.li>
          ))}
        </ol>

        {/* Result highlight - ink block callout */}
        <div className={styles.result}>
          <span className={styles.resultLabel}>{t.resultLabel}</span>
          <p className={styles.resultValue}>
            {t.resultLead}
            <span className={styles.resultNum}>{t.resultNum}</span>
            {t.resultTail}
          </p>
        </div>

        {/* Revenue streams - boxed ledger table */}
        <div className={styles.revenue}>
          <h3 className={styles.sectionTitle}>{t.revenueTitle}</h3>
          <div className={styles.table} role="table" aria-label={t.revenueTitle}>
            <div className={`${styles.row} ${styles.rowHead}`} role="row">
              <span role="columnheader">{t.colStream}</span>
              <span role="columnheader">{t.colSource}</span>
              <span role="columnheader">{t.colAllocation}</span>
            </div>
            {t.revenueStreams.map((item) => (
              <div key={item.stream} className={styles.row} role="row">
                <span className={styles.cellStream} role="cell">{item.stream}</span>
                <span className={styles.cellSource} role="cell">{item.source}</span>
                <span className={styles.cellAlloc} role="cell">{item.allocation}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sustainability note - red block pull-quote + checklist */}
        <div className={styles.note}>
          <span className={styles.noteHead}>{t.noteHead}</span>
          <ul className={styles.noteList}>
            {t.sustainabilityPoints.map((point) => (
              <li key={point} className={styles.noteItem}>
                <span className={styles.check} aria-hidden>✓</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
