'use client';

import { useEffect, useRef } from 'react';
import { animate, utils } from 'animejs';

const NP_EASE = 'cubicBezier(0.2, 0, 0, 1)';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface PulseCounterProps {
  /** Final integer value. */
  value: number;
  className?: string;
}

/**
 * Mono counter that ticks 0→value once on first view (M1): 700ms, `--np-ease`
 * hard-out, integers only. SSR prints the final number (honest without JS);
 * reduced motion never rewinds it.
 */
export function PulseCounter({ value, className }: PulseCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || value <= 0 || prefersReducedMotion()) return;

    el.textContent = '0';

    const state = { n: 0 };
    let animation: ReturnType<typeof animate> | null = null;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        animation = animate(state, {
          n: value,
          duration: 700,
          ease: NP_EASE,
          modifier: utils.round(0),
          onUpdate: () => {
            el.textContent = state.n.toLocaleString('he-IL');
          },
        });
      },
      { rootMargin: '-40px 0px' }
    );
    io.observe(el);

    return () => {
      io.disconnect();
      if (animation) animation.cancel();
      el.textContent = value.toLocaleString('he-IL');
    };
  }, [value]);

  return (
    <span ref={ref} className={className}>
      {value.toLocaleString('he-IL')}
    </span>
  );
}
