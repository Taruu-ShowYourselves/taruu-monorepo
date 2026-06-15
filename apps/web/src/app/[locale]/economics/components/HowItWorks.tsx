'use client';

import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks';
import styles from './HowItWorks.module.css';

const EASE = [0.2, 0, 0, 1] as const;

type IconName =
  | 'shield'
  | 'eye'
  | 'vote'
  | 'badge'
  | 'chart'
  | 'wallet'
  | 'globe'
  | 'coin'
  | 'trend';

interface Step {
  number: string;
  title: string;
  description: string;
  icon: IconName;
}

/** Hard-edged ink glyphs — crisp strokes, no rounding. */
function Glyph({ name }: { name: IconName }) {
  const common = {
    viewBox: '0 0 24 24',
    width: 22,
    height: 22,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    'aria-hidden': true,
    focusable: false,
    shapeRendering: 'crispEdges' as const,
  };
  switch (name) {
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 3 5 6v5c0 4.5 3 8 7 9 4-1 7-4.5 7-9V6l-7-3Z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case 'eye':
      return (
        <svg {...common}>
          <path d="M3 12 7 7h10l4 5-4 5H7l-4-5Z" />
          <rect x="10" y="10" width="4" height="4" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'vote':
      return (
        <svg {...common}>
          <rect x="4" y="13" width="16" height="7" />
          <path d="M8 13V6h8v7" />
          <path d="M10 16h4" />
        </svg>
      );
    case 'badge':
      return (
        <svg {...common}>
          <rect x="7" y="4" width="10" height="10" />
          <path d="M9 14l-2 6 5-3 5 3-2-6" />
        </svg>
      );
    case 'chart':
      return (
        <svg {...common}>
          <path d="M4 4v16h16" />
          <rect x="7" y="12" width="3" height="5" fill="currentColor" stroke="none" />
          <rect x="12" y="9" width="3" height="8" fill="currentColor" stroke="none" />
          <rect x="17" y="6" width="3" height="11" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'wallet':
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="13" />
          <path d="M3 10h18" />
          <rect x="15" y="13" width="3" height="2" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'globe':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" />
          <path d="M4 12h16M12 4v16" />
        </svg>
      );
    case 'coin':
      return (
        <svg {...common}>
          <rect x="4" y="6" width="16" height="14" />
          <path d="M4 11h16" />
          <rect x="14" y="14" width="3" height="3" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'trend':
    default:
      return (
        <svg {...common}>
          <path d="M4 17l5-5 4 3 7-8" />
          <path d="M20 7v4M20 7h-4" />
        </svg>
      );
  }
}

const residentSteps: Step[] = [
  { number: '1', title: 'אימות זהות', description: 'התחברות עם Google, אימות טלפון ומיקום ב-GPS', icon: 'shield' },
  { number: '2', title: 'צפייה בהצבעות פעילות', description: 'נושאים בעיר שלך שדורשים הכרעה', icon: 'eye' },
  { number: '3', title: 'תשלום ₪3 והצבעה', description: 'בחירת העמדה שאתה מאמין בה', icon: 'vote' },
  { number: '4', title: 'תעודת מצביע מאומת', description: 'הוכחה דיגיטלית להשתתפות שלך', icon: 'badge' },
  { number: '5', title: 'מעקב אחר הקרן', description: 'רואים את הכסף נאסף בזמן אמת', icon: 'chart' },
];

const supporterSteps: Step[] = [
  { number: '1', title: 'חיבור ארנק', description: 'חיבור ארנק לתמיכה מכל מקום בעולם', icon: 'wallet' },
  { number: '2', title: 'גילוי נושאים מובילים', description: 'נושאים אזרחיים שחשובים לך', icon: 'globe' },
  { number: '3', title: 'רכישת BAGS ב-bags.fm', description: 'תמיכה בנושאים שאתה מאמין בהם', icon: 'coin' },
  { number: '4', title: 'מסחר לפי הסנטימנט', description: 'הערך משקף את מידת התמיכה בנושא', icon: 'trend' },
  { number: '5', title: 'תעודת תומך קהילתי', description: 'תג שמתקבל בסיום ההצבעה', icon: 'badge' },
];

function Track({
  icon,
  title,
  badge,
  steps,
  delay,
  reduced,
}: {
  icon: IconName;
  title: string;
  badge: string;
  steps: Step[];
  delay: number;
  reduced: boolean;
}) {
  return (
    <motion.article
      className={styles.track}
      initial={reduced ? false : { opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
      whileInView={{ opacity: 1, clipPath: 'inset(0 0 0 0)' }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: reduced ? 0 : 0.4, ease: EASE, delay: reduced ? 0 : delay }}
    >
      <div className={styles.trackHeader}>
        <span className={styles.trackIcon} aria-hidden>
          <Glyph name={icon} />
        </span>
        <h3 className={styles.trackTitle}>{title}</h3>
        <span className={styles.trackBadge}>{badge}</span>
      </div>

      <ol className={styles.stepsList}>
        {steps.map((step) => (
          <li key={step.number} className={styles.stepItem}>
            <span className={styles.stepNumber} aria-hidden>
              {step.number.padStart(2, '0')}
            </span>
            <div className={styles.stepContent}>
              <h4 className={styles.stepTitle}>
                <span className={styles.stepIcon} aria-hidden>
                  <Glyph name={step.icon} />
                </span>
                {step.title}
              </h4>
              <p className={styles.stepDescription}>{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </motion.article>
  );
}

export function HowItWorks() {
  const reduced = useReducedMotion();

  return (
    <section className={styles.howItWorks} aria-labelledby="how-title">
      <div className={styles.inner}>
        <header className={styles.head}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            שני מסלולים · TWO TRACKS
          </span>
          <h2 id="how-title" className={styles.headline}>
            איך משתתפים — כתושב או <span className={styles.red}>כתומך.</span>
          </h2>
          <p className={styles.standfirst}>
            תושב מקומי שמצביע בנושאים של העיר שלו, או תומך חיצוני שמזרים משאבים לנושא שחשוב לו.
          </p>
        </header>

        <div className={styles.tracks}>
          <Track
            icon="shield"
            title="לתושבים"
            badge="מצביעים מאומתים"
            steps={residentSteps}
            delay={0.1}
            reduced={reduced}
          />
          <Track
            icon="globe"
            title="לתומכים"
            badge="תמיכה מכל העולם"
            steps={supporterSteps}
            delay={0.2}
            reduced={reduced}
          />
        </div>

        {/* Fee split — ink block callout */}
        <div className={styles.feeNote}>
          <span className={styles.feeNum}>70%</span>
          <div className={styles.feeBody}>
            <p className={styles.feeTitle}>
              מכל עמלות המסחר זורמים לקרן הקהילתית של הרשות
            </p>
            <span className={styles.feeSub}>30% מממנים את התחזוקה והפיתוח של הפלטפורמה</span>
          </div>
        </div>
      </div>
    </section>
  );
}
