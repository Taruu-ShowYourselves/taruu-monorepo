'use client';

import { useEffect, useRef } from 'react';
import { animate, utils } from 'animejs';
import clsx from 'clsx';
import styles from './ShareBar.module.css';

const NP_EASE = 'cubicBezier(0.2, 0, 0, 1)';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface ShareBarProps {
  /** Fill percentage, 0–100. */
  pct: number;
  /** Extra class on the track (parents control sizing). */
  className?: string;
}

/**
 * Hard-rectangle red tally bar (M2): fills 0→pct once on first view, animejs
 * engine, `--np-ease` hard-out. SSR renders the final width so the bar is
 * honest without JS; under reduced motion it never moves. Width animation is
 * the one sanctioned non-transform exception (runs once, off the critical
 * path - site-wide TallyBar precedent).
 */
export function ShareBar({ pct, className }: ShareBarProps) {
  const fillRef = useRef<HTMLSpanElement>(null);
  const target = Math.max(0, Math.min(100, pct));

  useEffect(() => {
    const el = fillRef.current;
    if (!el || prefersReducedMotion() || target === 0) return;

    el.style.width = '0%';

    let animation: ReturnType<typeof animate> | null = null;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        animation = animate(el, {
          width: `${target}%`,
          duration: 600,
          ease: NP_EASE,
        });
      },
      { rootMargin: '-40px 0px' }
    );
    io.observe(el);

    return () => {
      io.disconnect();
      if (animation) animation.cancel();
      utils.remove(el);
      el.style.width = `${target}%`;
    };
  }, [target]);

  return (
    <span className={clsx(styles.track, className)} aria-hidden>
      <span
        ref={fillRef}
        className={styles.fill}
        style={{ width: `${target}%` }}
      />
    </span>
  );
}
