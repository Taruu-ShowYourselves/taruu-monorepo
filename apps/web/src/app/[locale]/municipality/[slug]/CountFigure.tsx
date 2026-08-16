'use client';

import { useEffect, useRef } from 'react';
import { animate, utils } from 'animejs';

const NP_EASE = 'cubicBezier(0.2, 0, 0, 1)';

interface CountFigureProps {
  /** null = not measured; prints the dash and never counts. */
  value: number | null;
  locale: string;
  className?: string;
  /** Printed instead of a number when the figure is unmeasured. */
  dash?: string;
  /** Suffix glued to the counted number, e.g. '%'. */
  suffix?: string;
  /** Prints a leading '+' for a positive signed score. */
  signed?: boolean;
}

const render = (
  n: number,
  { locale, suffix, signed }: Pick<CountFigureProps, 'locale' | 'suffix' | 'signed'>
): string => {
  const sign = signed && n > 0 ? '+' : '';
  return `${sign}${n.toLocaleString(locale)}${suffix ?? ''}`;
};

/**
 * A figure that counts up to itself once it is actually on screen.
 *
 * The server prints the final number, so the page is correct before any JS
 * runs and correct for a reader who has asked for reduced motion; the count
 * is an enhancement on top of a finished figure, never the thing that
 * produces it. It runs once - a number that re-counts every time it scrolls
 * back into view reads as a slot machine, not a measurement.
 */
export function CountFigure({
  value,
  locale,
  className,
  dash = '-',
  suffix,
  signed,
}: CountFigureProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || value === null || value === 0 || done.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let animation: ReturnType<typeof animate> | null = null;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting) || done.current) return;
        done.current = true;
        observer.disconnect();

        /* Signed scores count from zero in their own direction; counts start
           at zero because that is where the city started. */
        const state = { n: 0 };
        animation = animate(state, {
          n: value,
          duration: 900,
          ease: NP_EASE,
          modifier: utils.round(0),
          onUpdate: () => {
            el.textContent = render(state.n, { locale, suffix, signed });
          },
          onComplete: () => {
            el.textContent = render(value, { locale, suffix, signed });
          },
        });
      },
      { threshold: 0.4 }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      animation?.cancel();
      el.textContent =
        value === null ? dash : render(value, { locale, suffix, signed });
    };
  }, [value, locale, suffix, signed, dash]);

  return (
    <span ref={ref} className={className}>
      {value === null ? dash : render(value, { locale, suffix, signed })}
    </span>
  );
}
