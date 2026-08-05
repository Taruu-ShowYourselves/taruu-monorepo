'use client';

import React, { useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';
import clsx from 'clsx';
import styles from './PressForm.module.css';

interface PressFormCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Skip the entrance stagger (e.g. for below-the-fold cards). */
  still?: boolean;
  /** Increment to trigger a rejection shake (e.g. on submit error). */
  shakeSignal?: number;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Elevated press form card. Children marked `data-field` (or, failing that,
 * all direct children) rise in with a staggered entrance; bump `shakeSignal`
 * for rejection feedback.
 */
export function PressFormCard({
  still = false,
  shakeSignal = 0,
  className,
  children,
  ...rest
}: PressFormCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || still || prefersReducedMotion()) return;

    const marked = root.querySelectorAll<HTMLElement>('[data-field]');
    const targets = marked.length > 0 ? marked : (Array.from(root.children) as HTMLElement[]);
    if (targets.length === 0) return;

    const animation = animate(targets, {
      translateY: [14, 0],
      opacity: [0, 1],
      delay: stagger(65),
      duration: 550,
      ease: 'outExpo',
    });

    return () => {
      animation.cancel();
    };
  }, [still]);

  useEffect(() => {
    if (shakeSignal > 0) pressShake(ref.current);
  }, [shakeSignal]);

  return (
    <div ref={ref} className={clsx(styles.card, className)} {...rest}>
      {children}
    </div>
  );
}

/**
 * Imperative rejection shake for any element (form card, field, button).
 */
export function pressShake(el: HTMLElement | null) {
  if (!el || prefersReducedMotion()) return;
  animate(el, {
    translateX: [0, -9, 8, -6, 4, -2, 0],
    duration: 480,
    ease: 'outQuad',
  });
}
