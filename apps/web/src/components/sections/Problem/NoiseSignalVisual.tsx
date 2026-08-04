'use client';

import { motion, useReducedMotion as useFramerReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import styles from './NoiseSignalVisual.module.css';

/**
 * The Problem visual: NOISE -> SIGNAL.
 *
 * Scattered, muted, slightly-rotated chat/shout bubbles (the loud, overlapping
 * crowd nobody can read) sit above. As the section scrolls into view they soften
 * and recede, while a single calm measured bar + number sharpens below - the
 * "quiet majority finally given a number" moment.
 *
 * Isolated client leaf. The noise drift, fade-resolve and number count-up all
 * collapse to a clean static end-state under reduced motion.
 */

interface Bubble {
  /** inline-position 0..100 (logical, mirrored for RTL by CSS) */
  x: number;
  /** block-position 0..100 */
  y: number;
  scale: number;
  rotate: number;
  /** dim chatter glyph - three muted dots */
  tone: 'a' | 'b' | 'c';
}

// Organic, hand-placed scatter - deliberately uneven, never a grid.
const BUBBLES: Bubble[] = [
  { x: 10, y: 6, scale: 0.78, rotate: -8, tone: 'a' },
  { x: 58, y: 2, scale: 0.92, rotate: 6, tone: 'b' },
  { x: 82, y: 14, scale: 0.7, rotate: -5, tone: 'c' },
  { x: 30, y: 20, scale: 1, rotate: 4, tone: 'b' },
  { x: 4, y: 34, scale: 0.66, rotate: 9, tone: 'c' },
  { x: 66, y: 30, scale: 0.84, rotate: -7, tone: 'a' },
  { x: 44, y: 40, scale: 0.74, rotate: 3, tone: 'c' },
  { x: 88, y: 40, scale: 0.62, rotate: 11, tone: 'b' },
];

const TARGET = 73; // illustrative - the quiet majority, not a platform stat.

export function NoiseSignalVisual() {
  const reduced = useFramerReducedMotion();
  const [pct, setPct] = useState(reduced ? TARGET : 0);

  useEffect(() => {
    if (reduced) {
      setPct(TARGET);
      return;
    }
    let raf = 0;
    let started = false;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / 1300, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setPct(Math.round(eased * TARGET));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    // Begin after the signal has scrolled into focus.
    const id = window.setTimeout(() => {
      started = true;
      raf = requestAnimationFrame(tick);
    }, 900);
    return () => {
      window.clearTimeout(id);
      if (started) cancelAnimationFrame(raf);
    };
  }, [reduced]);

  return (
    <div className={styles.wrap}>
      {/* NOISE layer - scattered loud chatter that recedes */}
      <motion.div
        className={styles.noise}
        aria-hidden
        initial={reduced ? false : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        {BUBBLES.map((b, i) => (
          <motion.span
            key={i}
            className={`${styles.bubble} ${styles[`tone_${b.tone}`]}`}
            style={{
              insetInlineStart: `${b.x}%`,
              insetBlockStart: `${b.y}%`,
            }}
            initial={
              reduced
                ? false
                : { opacity: 0, scale: b.scale * 0.7, rotate: b.rotate * 1.6 }
            }
            whileInView={{
              // Resolve toward calm: settle, then quiet down and shrink slightly.
              opacity: [0, 1, 0.42],
              scale: [b.scale * 0.7, b.scale, b.scale * 0.92],
              rotate: [b.rotate * 1.6, b.rotate, b.rotate * 0.4],
            }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{
              duration: 1.6,
              delay: 0.1 + i * 0.06,
              ease: [0.22, 1, 0.36, 1],
              times: [0, 0.45, 1],
            }}
          >
            <svg viewBox="0 0 40 32" width="40" height="32" aria-hidden>
              <path
                d="M8 2h24a6 6 0 0 1 6 6v10a6 6 0 0 1-6 6H18l-8 6v-6H8a6 6 0 0 1-6-6V8a6 6 0 0 1 6-6Z"
                fill="currentColor"
                fillOpacity="0.14"
                stroke="currentColor"
                strokeOpacity="0.45"
                strokeWidth="1.4"
              />
              <circle cx="13" cy="13" r="1.7" fill="currentColor" fillOpacity="0.55" />
              <circle cx="20" cy="13" r="1.7" fill="currentColor" fillOpacity="0.55" />
              <circle cx="27" cy="13" r="1.7" fill="currentColor" fillOpacity="0.55" />
            </svg>
          </motion.span>
        ))}
      </motion.div>

      {/* SIGNAL layer - one clean measured element that sharpens */}
      <motion.div
        className={styles.signal}
        initial={reduced ? false : { opacity: 0, y: 20, filter: 'blur(6px)' }}
        whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.7, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className={styles.signalHead}>
          <span className={styles.signalLabel}>הרוב השקט</span>
          <span className={styles.signalPct}>{pct}%</span>
        </div>

        <div className={styles.track}>
          <motion.div
            className={styles.fill}
            initial={reduced ? false : { scaleX: 0 }}
            whileInView={{ scaleX: TARGET / 100 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 1.3, delay: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        <p className={styles.signalCaption}>
          קול אחד מדוד, ברור, שאי־אפשר להתעלם ממנו.
        </p>
      </motion.div>

      {/* Soft calming aura behind the signal */}
      <span className={styles.aura} aria-hidden />
    </div>
  );
}
