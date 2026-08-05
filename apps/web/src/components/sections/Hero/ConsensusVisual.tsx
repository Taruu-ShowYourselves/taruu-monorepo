'use client';

import { motion, useReducedMotion as useFramerReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import styles from './ConsensusVisual.module.css';

/**
 * Flagship hero visual: a floating glass "live vote" preview card. Shows the
 * product itself - an active local issue, a consensus bar filling to a result,
 * verified turnout, and a blockchain seal. Concrete > abstract: this is what
 * converts skeptics ("oh, THAT's what it does").
 *
 * Isolated client leaf. Perpetual float + bar fill pause under reduced motion.
 */
export function ConsensusVisual() {
  const reduced = useFramerReducedMotion();
  const target = 75; // illustrative result, not a platform stat
  const [pct, setPct] = useState(reduced ? target : 0);

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / 1400, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setPct(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    const id = window.setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, 700);
    return () => {
      window.clearTimeout(id);
      cancelAnimationFrame(raf);
    };
  }, [reduced]);

  return (
    <motion.div
      className={styles.wrap}
      initial={reduced ? false : { opacity: 0, y: 28, rotate: -1.5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className={styles.card}
        animate={reduced ? undefined : { y: [0, -10, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className={styles.head}>
          <span className={styles.live}>
            <span className={styles.liveDot} aria-hidden />
            הצבעה חיה
          </span>
          <span className={styles.place}>קריית טבעון</span>
        </div>

        <p className={styles.issue}>להוסיף מעבר חצייה מואר ברחוב הרצל, ליד בית הספר</p>

        <div className={styles.meter}>
          <div className={styles.meterRow}>
            <span className={styles.forLabel}>בעד</span>
            <span className={styles.pct}>{pct}%</span>
          </div>
          <div className={styles.track}>
            <motion.div
              className={styles.fill}
              initial={reduced ? false : { width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ ease: 'linear', duration: 0 }}
            />
          </div>
          <div className={styles.counts}>
            <span>268 בעד</span>
            <span>91 נגד</span>
          </div>
        </div>

        <div className={styles.foot}>
          <span className={styles.verified}>
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden>
              <path
                d="M9 12.5l2 2 4-4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.5" />
            </svg>
            359 תושבים מאומתים
          </span>
          <span className={styles.chain}>חתום בבלוקצ׳יין</span>
        </div>
      </motion.div>

      {/* Soft colored auras behind the card */}
      <span className={styles.auraA} aria-hidden />
      <span className={styles.auraB} aria-hidden />
    </motion.div>
  );
}
