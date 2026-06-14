'use client';

import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks';
import styles from './FlywheelDiagram.module.css';

const EASE = [0.2, 0, 0, 1] as const;

type IconName = 'resident' | 'coin' | 'globe' | 'trade' | 'split' | 'award';

interface FlywheelStep {
  id: string;
  title: string;
  description: string;
  icon: IconName;
}

/** Hard-edged ink ledger glyphs — crisp strokes, no rounding. */
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

const flywheelSteps: FlywheelStep[] = [
  { id: 'local', title: 'תושב מקומי', description: 'משלם ₪3 ומצביע', icon: 'resident' },
  { id: 'coin', title: 'Issue Coin נוצר', description: 'ההצבעה נרשמת בבלוקצ\'יין', icon: 'coin' },
  { id: 'external', title: 'תומך חיצוני', description: 'מזהה נושא שחשוב לו', icon: 'globe' },
  { id: 'trade', title: 'קונה Issue Coins', description: 'תמיכה שמייצרת עמלות', icon: 'trade' },
  { id: 'fees', title: 'עמלות מחולקות', description: '70% לקרן הרשות, 30% לפלטפורמה', icon: 'split' },
  { id: 'result', title: 'תוצאה נקבעת', description: 'תעודה דיגיטלית לכל משתתף', icon: 'award' },
];

const revenueStreams = [
  { stream: 'יצירת הצבעה', source: '₪50 להצבעה חדשה', allocation: 'תפעול הפלטפורמה' },
  { stream: 'השתתפות בהצבעה', source: '₪3 לכל הצבעה', allocation: '70% לקרן · 30% לפלטפורמה' },
  { stream: 'עמלות מסחר', source: '1% על כל עסקה', allocation: '70% לקרן · 30% לפלטפורמה' },
  { stream: 'רכישות חיצוניות', source: 'תמיכה → Issue Coins', allocation: '100% לקופת הקרן' },
];

const sustainabilityPoints = [
  'הפלטפורמה מתקיימת מהיום הראשון',
  'הרשויות מרוויחות, לא מוציאות',
  'התושבים מצביעים — ומחזיקים תעודה בעלת ערך',
  'תומכים חיצוניים מקבלים נכס סחיר ושקוף',
];

export function FlywheelDiagram() {
  const reduced = useReducedMotion();

  return (
    <section className={styles.flywheel} aria-labelledby="flywheel-title">
      <div className={styles.inner}>
        <header className={styles.head}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            גלגל התנופה · THE LEDGER LOOP
          </span>
          <h2 id="flywheel-title" className={styles.headline}>
            כל הצבעה מפעילה מחזור כלכלי <span className={styles.red}>שמכפיל השפעה.</span>
          </h2>
        </header>

        {/* Numbered cyclical ledger — boxed nodes connected by red arrows */}
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
                {index === flywheelSteps.length - 1 ? '↺' : '←'}
              </span>
            </motion.li>
          ))}
        </ol>

        {/* Result highlight — ink block callout */}
        <div className={styles.result}>
          <span className={styles.resultLabel}>התוצאה</span>
          <p className={styles.resultValue}>
            הצבעה של <span className={styles.resultNum}>₪3</span> יכולה לרכז מאחורי הנושא
            משאבים אמיתיים — לא רק קול.
          </p>
        </div>

        {/* Revenue streams — boxed ledger table */}
        <div className={styles.revenue}>
          <h3 className={styles.sectionTitle}>זרמי הכנסה</h3>
          <div className={styles.table} role="table" aria-label="זרמי הכנסה">
            <div className={`${styles.row} ${styles.rowHead}`} role="row">
              <span role="columnheader">זרם</span>
              <span role="columnheader">מקור</span>
              <span role="columnheader">הקצאה</span>
            </div>
            {revenueStreams.map((item) => (
              <div key={item.stream} className={styles.row} role="row">
                <span className={styles.cellStream} role="cell">{item.stream}</span>
                <span className={styles.cellSource} role="cell">{item.source}</span>
                <span className={styles.cellAlloc} role="cell">{item.allocation}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sustainability note — red block pull-quote + checklist */}
        <div className={styles.note}>
          <span className={styles.noteHead}>ללא תלות במשקיעים חיצוניים</span>
          <ul className={styles.noteList}>
            {sustainabilityPoints.map((point) => (
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
