'use client';

import { motion } from 'framer-motion';
import { NewsButton } from '@/components/press';
import { Receipt } from '@/components/press';
import { useReducedMotion } from '@/hooks';
import { VOTE_COST, CREATE_VOTE_COST } from '@sync/shared';
import styles from './PricingContent.module.css';

const WHATSAPP_URL = 'https://chat.whatsapp.com/FITvea9IVsn2Ljie1yCrAc';

/** Mono trust line items — the "no fine print" rate-card footer. */
const TRUST_ITEMS = ['אין מנוי', 'אין דמי חבר', 'אין אותיות קטנות'] as const;

/** Spec-sheet line items under each rate block. ✓ = included. */
const PARTICIPATION_SPEC = [
  'עמלה חד-פעמית להצבעה מאומתת בנושא מקומי',
  'זהות ו-GPS · חתום בבלוקצ׳יין',
  'התמונה המלאה פתוחה לכולם',
] as const;

const CREATE_SPEC = [
  'פרסום הצבעה חדשה ברשות שלכם',
  'כולל אפשרויות בחירה ולוח זמנים לסיום',
  'מונע ספאם · שומר על איכות הנושאים',
] as const;

/**
 * Pricing — Brutalist Tech-Press "rate card / spec sheet". Two hard-edged
 * boxed rate blocks (₪3 participation, ₪50 create-vote) with BIG mono prices
 * and ink-ruled line items. The ₪3 split (₪2 community fund / ₪1 operations)
 * is shown as a press Receipt. A mono trust strip kills fine-print anxiety;
 * one red primary "join the pilot" NewsButton closes.
 *
 * Hebrew-only, RTL logical props, mobile-first single column → two-up rate
 * cards with a vertical ink column rule ≥768px. The one revealed figure (the
 * price stamp-in) pauses under reduced motion.
 */
export function PricingContent() {
  const reduced = useReducedMotion();

  const stamp = reduced
    ? {}
    : {
        initial: { clipPath: 'inset(0 100% 0 0)' },
        whileInView: { clipPath: 'inset(0 0 0 0)' },
        viewport: { once: true, margin: '-80px' },
        transition: { duration: 0.35, ease: [0.2, 0, 0, 1] as const },
      };

  return (
    <main className={`np-page ${styles.page}`} dir="rtl">
      <div className={`np-container ${styles.container}`}>
        {/* ---------- Masthead block: kicker · headline · standfirst ---------- */}
        <header className={styles.head}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            תמחור · RATE CARD
          </span>

          <h2 className={styles.title}>
            פשוט, שקוף, <span className={styles.red}>בלי הפתעות.</span>
          </h2>

          <p className={styles.standfirst}>
            ₪{VOTE_COST} להשתתפות בהצבעה (₪2 לקרן הקהילתית, ₪1 לתפעול). ₪
            {CREATE_VOTE_COST} ליצירת הצבעה חדשה. אין מנוי, אין דמי חבר, אין
            אותיות קטנות.
          </p>
        </header>

        <div className={`np-rule-heavy ${styles.headRule}`} aria-hidden />

        {/* ---------- Two rate blocks ---------- */}
        <div className={styles.cards}>
          {/* RATE 01 — ₪3 participation */}
          <section className={styles.card}>
            <header className={styles.cardHead}>
              <span className={styles.rateNo}>01</span>
              <span className={styles.rateTag}>השתתפות בהצבעה</span>
            </header>

            <div className={styles.priceRow}>
              <motion.span className={styles.price} {...stamp}>
                <span className={styles.priceShekel} aria-hidden>
                  ₪
                </span>
                {VOTE_COST}
              </motion.span>
              <span className={styles.priceUnit}>/ הצבעה</span>
            </div>

            <ul className={styles.specList}>
              {PARTICIPATION_SPEC.map((item) => (
                <li key={item} className={styles.specItem}>
                  <span className={styles.specMark} aria-hidden>
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            {/* ₪3 split shown as a press receipt: ₪2 fund / ₪1 ops */}
            <Receipt
              className={styles.receipt}
              kicker="פירוט · ₪3"
              rows={[
                { label: 'קרן הקהילתית', value: '₪2' },
                { label: 'תפעול ופיתוח', value: '₪1' },
                { label: 'סה״כ להצבעה', value: '₪3', strong: true },
              ]}
              footer="מאומת · חתום בבלוקצ׳יין · בלי עמלות נסתרות"
            />
          </section>

          {/* RATE 02 — ₪50 create a vote */}
          <section className={styles.card}>
            <header className={styles.cardHead}>
              <span className={styles.rateNo}>02</span>
              <span className={styles.rateTag}>יצירת הצבעה חדשה</span>
            </header>

            <div className={styles.priceRow}>
              <motion.span className={styles.price} {...stamp}>
                <span className={styles.priceShekel} aria-hidden>
                  ₪
                </span>
                {CREATE_VOTE_COST}
              </motion.span>
              <span className={styles.priceUnit}>/ הצבעה</span>
            </div>

            <ul className={styles.specList}>
              {CREATE_SPEC.map((item) => (
                <li key={item} className={styles.specItem}>
                  <span className={styles.specMark} aria-hidden>
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            <div className={styles.note}>
              <span className={styles.noteMark} aria-hidden>
                ●
              </span>
              עמלה חד-פעמית. כל הצבעה היא נושא אמיתי שמישהו עומד מאחוריו —
              בלי ספאם, בלי רעש.
            </div>
          </section>
        </div>

        {/* ---------- Trust strip (mono, no fine print) ---------- */}
        <div className={styles.trustStrip}>
          <span className={styles.trustHead}>אין אותיות קטנות</span>
          <ul className={styles.trustList}>
            {TRUST_ITEMS.map((item, i) => (
              <li key={item} className={styles.trustItem}>
                {i > 0 && (
                  <span className={styles.trustSep} aria-hidden>
                    ·
                  </span>
                )}
                <span className={styles.trustMark} aria-hidden>
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* ---------- CTA ---------- */}
        <div className={styles.ctaWrap}>
          <h3 className={styles.ctaTitle}>רוצים לשמוע עוד?</h3>
          <p className={styles.ctaBody}>
            הצטרפו לקבוצת המייסדים — בלי התחייבות, בלי תשלום מראש.
          </p>
          <NewsButton
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            variant="red"
            size="lg"
            trailing={<span aria-hidden>←</span>}
          >
            קבוצת המייסדים
          </NewsButton>
        </div>
      </div>
    </main>
  );
}
