'use client';

import { motion } from 'framer-motion';
import { NewsButton } from '@/components/press';
import { useReducedMotion } from '@/hooks';
import { CREATE_VOTE_COST, WHATSAPP_FOUNDERS_LINK } from '@sync/shared';
import type { Locale } from '@/lib/i18n';
import { localeDirections } from '@/lib/i18n';
import styles from './PricingContent.module.css';

const WHATSAPP_URL = WHATSAPP_FOUNDERS_LINK;

interface PricingCopy {
  kicker: string;
  title: string;
  titleRed: string;
  /** Standfirst text before the ₪ price figure (ends with the ₪ glyph). */
  standfirstBefore: string;
  /** Standfirst text after the price figure. */
  standfirstAfter: string;
  participationTag: string;
  participationPrice: string;
  priceUnit: string;
  /** Spec-sheet line items under each rate block. ✓ = included. */
  participationSpec: readonly string[];
  participationNote: string;
  createTag: string;
  createSpec: readonly string[];
  createNote: string;
  trustHead: string;
  /** Mono trust line items - the "no fine print" rate-card footer. */
  trustItems: readonly string[];
  ctaTitle: string;
  ctaBody: string;
  ctaButton: string;
  arrow: string;
}

const COPY: Record<Locale, PricingCopy> = {
  he: {
    kicker: 'תמחור · RATE CARD',
    title: 'פשוט, שקוף,',
    titleRed: 'בלי הפתעות.',
    standfirstBefore: 'ההצבעה חינם. ₪',
    standfirstAfter: ' ליצירת הצבעה חדשה. אין מנוי, אין דמי חבר, אין אותיות קטנות.',
    participationTag: 'השתתפות בהצבעה',
    participationPrice: 'חינם',
    priceUnit: '/ הצבעה',
    participationSpec: [
      'הצבעה מאומתת בנושא מקומי, בלי תשלום',
      'זהות ו-GPS · חתום בבלוקצ׳יין',
      'התמונה המלאה פתוחה לכולם',
    ],
    participationNote:
      'בלי תשלום ובלי חסמים. נדרש רק אימות זהות ומיקום, כדי שכל קול ישויך לתושב אמיתי אחד.',
    createTag: 'יצירת הצבעה חדשה',
    createSpec: [
      'פרסום הצבעה חדשה ברשות שלכם',
      'כולל אפשרויות בחירה ולוח זמנים לסיום',
      'מונע ספאם · שומר על איכות הנושאים',
    ],
    createNote:
      'עמלה חד-פעמית. כל הצבעה היא נושא אמיתי שמישהו עומד מאחוריו. בלי ספאם, בלי רעש.',
    trustHead: 'אין אותיות קטנות',
    trustItems: ['אין מנוי', 'אין דמי חבר', 'אין אותיות קטנות'],
    ctaTitle: 'רוצים לשמוע עוד?',
    ctaBody: 'הצטרפו לקבוצת המייסדים. בלי התחייבות ובלי תשלום מראש.',
    ctaButton: 'קבוצת המייסדים',
    arrow: '←',
  },
  en: {
    kicker: 'PRICING · RATE CARD',
    title: 'Simple, transparent,',
    titleRed: 'no surprises.',
    standfirstBefore: 'Voting is free. ₪',
    standfirstAfter:
      ' (ILS) to create a new vote. No subscription, no membership fees, no fine print.',
    participationTag: 'Participating in a vote',
    participationPrice: 'Free',
    priceUnit: '/ vote',
    participationSpec: [
      'A verified vote on a local issue, at no charge',
      'Identity and GPS · sealed on the blockchain',
      'The full picture is open to everyone',
    ],
    participationNote:
      'No charge and no barriers. Only identity and location verification are required, so that every vote is tied to one real resident.',
    createTag: 'Creating a new vote',
    createSpec: [
      'Publish a new vote in your municipality',
      'Includes ballot options and a closing schedule',
      'Prevents spam · protects the quality of topics',
    ],
    createNote:
      'A one-time fee. Every vote is a real topic that someone stands behind. No spam, no noise.',
    trustHead: 'No fine print',
    trustItems: ['No subscription', 'No membership fees', 'No fine print'],
    ctaTitle: 'Want to hear more?',
    ctaBody: 'Join the founders group. No commitment and no payment up front.',
    ctaButton: 'The founders group',
    arrow: '→',
  },
};

interface PricingContentProps {
  locale?: Locale;
}

/**
 * Pricing - Brutalist Tech-Press "rate card / spec sheet". Two hard-edged
 * boxed rate blocks (free participation, ₪50 create-vote) with BIG mono
 * figures and ink-ruled line items. A mono trust strip kills fine-print
 * anxiety; one red primary "join the pilot" NewsButton closes.
 *
 * Bilingual (he/en), logical props follow the locale direction, mobile-first
 * single column → two-up rate cards with a vertical ink column rule ≥768px.
 * The one revealed figure (the price stamp-in) pauses under reduced motion.
 */
export function PricingContent({ locale = 'he' }: PricingContentProps) {
  const reduced = useReducedMotion();
  const t = COPY[locale];

  const stamp = reduced
    ? {}
    : {
        initial: { clipPath: 'inset(0 100% 0 0)' },
        whileInView: { clipPath: 'inset(0 0 0 0)' },
        viewport: { once: true, margin: '-80px' },
        transition: { duration: 0.35, ease: [0.2, 0, 0, 1] as const },
      };

  return (
    <main className={`np-page ${styles.page}`} dir={localeDirections[locale]}>
      <div className={`np-container ${styles.container}`}>
        {/* ---------- Masthead block: kicker · headline · standfirst ---------- */}
        <header className={styles.head}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            {t.kicker}
          </span>

          <h2 className={styles.title}>
            {t.title} <span className={styles.red}>{t.titleRed}</span>
          </h2>

          <p className={styles.standfirst}>
            {t.standfirstBefore}
            {CREATE_VOTE_COST}
            {t.standfirstAfter}
          </p>
        </header>

        <div className={`np-rule-heavy ${styles.headRule}`} aria-hidden />

        {/* ---------- Two rate blocks ---------- */}
        <div className={styles.cards}>
          {/* RATE 01 - free participation */}
          <section className={styles.card}>
            <header className={styles.cardHead}>
              <span className={styles.rateNo}>01</span>
              <span className={styles.rateTag}>{t.participationTag}</span>
            </header>

            <div className={styles.priceRow}>
              <motion.span className={styles.price} {...stamp}>
                {t.participationPrice}
              </motion.span>
              <span className={styles.priceUnit}>{t.priceUnit}</span>
            </div>

            <ul className={styles.specList}>
              {t.participationSpec.map((item) => (
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
              {t.participationNote}
            </div>
          </section>

          {/* RATE 02 - ₪50 create a vote */}
          <section className={styles.card}>
            <header className={styles.cardHead}>
              <span className={styles.rateNo}>02</span>
              <span className={styles.rateTag}>{t.createTag}</span>
            </header>

            <div className={styles.priceRow}>
              <motion.span className={styles.price} {...stamp}>
                <span className={styles.priceShekel} aria-hidden>
                  ₪
                </span>
                {CREATE_VOTE_COST}
              </motion.span>
              <span className={styles.priceUnit}>{t.priceUnit}</span>
            </div>

            <ul className={styles.specList}>
              {t.createSpec.map((item) => (
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
              {t.createNote}
            </div>
          </section>
        </div>

        {/* ---------- Trust strip (mono, no fine print) ---------- */}
        <div className={styles.trustStrip}>
          <span className={styles.trustHead}>{t.trustHead}</span>
          <ul className={styles.trustList}>
            {t.trustItems.map((item, i) => (
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
          <h3 className={styles.ctaTitle}>{t.ctaTitle}</h3>
          <p className={styles.ctaBody}>{t.ctaBody}</p>
          <NewsButton
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            variant="red"
            size="lg"
            trailing={<span aria-hidden>{t.arrow}</span>}
          >
            {t.ctaButton}
          </NewsButton>
        </div>
      </div>
    </main>
  );
}
