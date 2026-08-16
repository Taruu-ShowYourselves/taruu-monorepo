'use client';

import styles from './cheer-burst.module.css';

/**
 * CheerBurst - a one-shot paper confetti burst for a moment worth cheering:
 * an account verified, an onboarding finished.
 *
 * Render it when the success state renders and it plays once, on mount, then
 * sits inert - the particles end at opacity 0 and stay there, so it never
 * needs unmounting or a timer. Purely decorative: hidden from the
 * accessibility tree, gone entirely under prefers-reduced-motion (see the
 * module CSS), and positioned absolutely so it costs the layout nothing.
 *
 * The scatter is a fixed table, not Math.random: the burst is decoration
 * around a server-rendered success panel, and hydration must agree with the
 * server about every style attribute.
 */

interface Particle {
  /** Flight direction, degrees: 90 is straight up, 0 right, 180 left. */
  angle: number;
  /** Flight distance, rem. */
  dist: number;
  /** Stagger, ms. */
  delay: number;
  /** 0..2 - indexes the palette in the module CSS. */
  tone: number;
  /** Particle spin, degrees. */
  spin: number;
}

const PARTICLES: Particle[] = [
  { angle: 82, dist: 7.5, delay: 0, tone: 0, spin: 260 },
  { angle: 60, dist: 6, delay: 30, tone: 1, spin: -200 },
  { angle: 105, dist: 6.8, delay: 20, tone: 2, spin: 320 },
  { angle: 40, dist: 5.2, delay: 60, tone: 0, spin: -280 },
  { angle: 125, dist: 5.6, delay: 50, tone: 1, spin: 240 },
  { angle: 20, dist: 4.4, delay: 90, tone: 2, spin: 180 },
  { angle: 145, dist: 4.8, delay: 80, tone: 0, spin: -220 },
  { angle: 73, dist: 8.4, delay: 10, tone: 2, spin: -340 },
  { angle: 92, dist: 8, delay: 40, tone: 1, spin: 300 },
  { angle: 52, dist: 7, delay: 70, tone: 2, spin: 220 },
  { angle: 115, dist: 7.4, delay: 55, tone: 0, spin: -260 },
  { angle: 8, dist: 3.8, delay: 110, tone: 1, spin: 160 },
  { angle: 172, dist: 4, delay: 100, tone: 2, spin: -180 },
  { angle: 88, dist: 5, delay: 120, tone: 0, spin: 200 },
];

export function CheerBurst() {
  return (
    <span className={styles.burst} aria-hidden>
      {PARTICLES.map((p, index) => (
        <i
          key={index}
          className={styles.particle}
          data-tone={p.tone}
          style={
            {
              '--cheer-x': `${Math.cos((p.angle * Math.PI) / 180) * p.dist}rem`,
              '--cheer-y': `${-Math.sin((p.angle * Math.PI) / 180) * p.dist}rem`,
              '--cheer-delay': `${p.delay}ms`,
              '--cheer-spin': `${p.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}
