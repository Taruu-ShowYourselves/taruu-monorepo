'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { GradientText } from '@/components/ui/GradientText';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Text, Heading } from '@/components/ui/Typography';
import { AnimatedFadeInUp, AnimatedWords } from '@/components/animations';
import { useReducedMotion } from '@/hooks';
import type { Locale } from '@/lib/i18n';
import styles from './MoneyTransparency.module.css';

const EASE = [0.22, 1, 0.36, 1] as const;

/** Shekel mark - clean inline glyph, no emoji. */
function Shekel({ className }: { className?: string }) {
  return (
    <span className={className} aria-hidden>
      ₪
    </span>
  );
}

/**
 * MoneyTransparency - neutralizes the "why pay?" objection around the ₪3 vote
 * fee. The centerpiece is an instantly-legible split of ₪3 → ₪2 (community
 * fund, green) + ₪1 (operations, blue) rendered as a proportional bar that
 * fills on inView, plus two proportionally-sized glass cards (≈2fr / 1fr).
 *
 * Deliberately jargon-free. Isolated client leaf; bar fill + entrance pause
 * under reduced motion.
 */
export function MoneyTransparency({ locale }: { locale?: Locale }) {
  const reduced = useReducedMotion();
  const economicsHref = `/${locale ?? 'he'}/economics`;

  return (
    <section className={styles.section} aria-labelledby="money-transparency-title">
      <span className={styles.auraGreen} aria-hidden />
      <span className={styles.auraBlue} aria-hidden />

      <div className={styles.container}>
        <header className={styles.head}>
          <AnimatedFadeInUp>
            <Eyebrow>
              <span className={styles.eyebrowInner}>
                <Shekel className={styles.eyebrowShekel} />3, ולמה זה לא קנס
              </span>
            </Eyebrow>
          </AnimatedFadeInUp>

          <Heading level={2} id="money-transparency-title" className={styles.title}>
            <AnimatedWords text="הכסף שלכם נשאר בקהילה." />
            <span className={styles.titleAccent}>
              <GradientText variant="green" animated>
                עד השקל האחרון.
              </GradientText>
            </span>
          </Heading>

          <AnimatedFadeInUp delay={0.1}>
            <Text as="p" size="lg" color="secondary" className={styles.body}>
              דמי ההשתתפות (<Shekel className={styles.inlineShekel} />3) הם מה שהופך קליק
              לעמדה רצינית, וגם מה שמממן את הקהילה עצמה:
            </Text>
          </AnimatedFadeInUp>
        </header>

        <AnimatedFadeInUp delay={0.15} className={styles.visualWrap}>
          {/* Proportional split bar: 2/3 green + 1/3 blue */}
          <div
            className={styles.bar}
            role="img"
            aria-label="מתוך שלושה שקלים: שני שקלים לקרן קהילתית, שקל אחד לתפעול ופיתוח"
          >
            <motion.div
              className={styles.barFund}
              initial={reduced ? false : { transform: 'scaleX(0)' }}
              whileInView={{ transform: 'scaleX(1)' }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
            >
              <span className={styles.barLabel}>
                <Shekel className={styles.barShekel} />2
              </span>
            </motion.div>
            <motion.div
              className={styles.barOps}
              initial={reduced ? false : { transform: 'scaleX(0)' }}
              whileInView={{ transform: 'scaleX(1)' }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.55, ease: EASE, delay: 0.45 }}
            >
              <span className={styles.barLabel}>
                <Shekel className={styles.barShekel} />1
              </span>
            </motion.div>
          </div>

          {/* Proportionally-sized cards: fund (larger) + ops (smaller) */}
          <div className={styles.cards}>
            <motion.article
              className={`${styles.card} ${styles.cardFund}`}
              initial={reduced ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.15 }}
            >
              <div className={styles.cardHead}>
                <span className={`${styles.cardAmount} ${styles.cardAmountFund}`}>
                  <Shekel className={styles.cardShekel} />2
                </span>
                <svg className={styles.cardArrow} viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                  <path
                    d="M14 6l-6 6 6 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <h3 className={styles.cardTitle}>קרן קהילתית</h3>
              </div>
              <p className={styles.cardText}>
                נשמרים בנאמנות לטובת הנושאים שלכם: ייעוץ מקצועי, קידום האינטרס הציבורי,
                פעולה בשטח.
              </p>
            </motion.article>

            <motion.article
              className={`${styles.card} ${styles.cardOps}`}
              initial={reduced ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.3 }}
            >
              <div className={styles.cardHead}>
                <span className={`${styles.cardAmount} ${styles.cardAmountOps}`}>
                  <Shekel className={styles.cardShekel} />1
                </span>
                <svg className={styles.cardArrow} viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                  <path
                    d="M14 6l-6 6 6 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <h3 className={styles.cardTitle}>תפעול ופיתוח</h3>
              </div>
              <p className={styles.cardText}>תחזוקה ופיתוח של הפלטפורמה.</p>
            </motion.article>
          </div>
        </AnimatedFadeInUp>

        <AnimatedFadeInUp delay={0.2} className={styles.trust}>
          <span className={styles.trustIcon} aria-hidden>
            <svg viewBox="0 0 24 24" width="18" height="18">
              <rect
                x="5"
                y="11"
                width="14"
                height="9"
                rx="2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <path
                d="M8 11V8a4 4 0 0 1 8 0v3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
              <circle cx="12" cy="15.5" r="1.4" fill="currentColor" />
            </svg>
          </span>
          <Text as="p" size="base" weight="medium" className={styles.trustText}>
            כל הוצאה מהקרן מתועדת ופומבית. בלי חדרים סגורים, גם פה.
          </Text>
        </AnimatedFadeInUp>

        <AnimatedFadeInUp delay={0.25}>
          <Link href={economicsHref} className={styles.cta}>
            איך עובדת הכלכלה האזרחית
            <svg className={styles.ctaArrow} viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path
                d="M19 12H5M11 6l-6 6 6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </AnimatedFadeInUp>
      </div>
    </section>
  );
}
