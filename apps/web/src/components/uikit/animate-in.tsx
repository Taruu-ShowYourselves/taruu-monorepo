'use client';

import { useEffect, useRef, type HTMLAttributes } from 'react';
import { animate, stagger } from 'animejs';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Staggered rise-in for children marked `data-animate` (falls back to all
 * direct children). Same entrance mechanic as PressFormCard, reusable around
 * any server-rendered block.
 */
export function AnimateIn({
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || prefersReducedMotion()) return;

    const marked = root.querySelectorAll<HTMLElement>('[data-animate]');
    const targets =
      marked.length > 0 ? marked : (Array.from(root.children) as HTMLElement[]);
    if (targets.length === 0) return;

    const animation = animate(targets, {
      translateY: [14, 0],
      opacity: [0, 1],
      delay: stagger(60),
      duration: 500,
      ease: 'outExpo',
    });

    return () => {
      animation.cancel();
    };
  }, []);

  return (
    <div ref={ref} {...rest}>
      {children}
    </div>
  );
}
