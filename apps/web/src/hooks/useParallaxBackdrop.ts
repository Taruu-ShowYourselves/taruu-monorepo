'use client';

import { useEffect, useRef } from 'react';
import { useMotionValueEvent, useScroll } from 'framer-motion';
import { useReducedMotion } from './useReducedMotion';

/**
 * Depth of each backdrop layer, as a fraction of the section's own height.
 * Negative drifts against the scroll (further away), positive drifts with it.
 */
export interface ParallaxDepths {
  /** The ruled grid sitting furthest back. */
  back?: number;
  /** The ghost numeral, just behind the type. */
  fore?: number;
}

const BACK_VAR = '--np-parallax-back';
const FORE_VAR = '--np-parallax-fore';

/**
 * Drives a press section's two backdrop layers at different rates as the
 * section crosses the viewport.
 *
 * The hook writes offsets to custom properties rather than transforming
 * anything itself, because both layers are pseudo-elements - that keeps every
 * section's backdrop entirely in its own stylesheet and leaves this file with
 * one job: turning scroll position into two numbers.
 *
 * Attach the returned ref to the scrolling section. Offsets are expressed in
 * pixels against the section's measured height, so a tall section and a short
 * one drift proportionally rather than by the same absolute amount.
 */
export function useParallaxBackdrop<T extends HTMLElement>(
  { back = -0.05, fore = 0.12 }: ParallaxDepths = {}
) {
  const ref = useRef<T>(null);
  const reducedMotion = useReducedMotion();

  // 0 when the section's top meets the bottom of the viewport, 1 when its
  // bottom leaves the top - the full pass, not just the part that is on screen.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  useMotionValueEvent(scrollYProgress, 'change', (progress) => {
    const element = ref.current;
    if (!element || reducedMotion) return;

    // Centre the travel on the section, so a layer sits at its designed
    // position when the section is centred and drifts either side of it.
    const travel = (progress - 0.5) * 2;
    const height = element.offsetHeight;

    element.style.setProperty(BACK_VAR, `${travel * back * height}px`);
    element.style.setProperty(FORE_VAR, `${travel * fore * height}px`);
  });

  // A preference switched on mid-session must return the layers to rest, not
  // freeze them wherever the last scroll event left them.
  useEffect(() => {
    const element = ref.current;
    if (!element || !reducedMotion) return;

    element.style.removeProperty(BACK_VAR);
    element.style.removeProperty(FORE_VAR);
  }, [reducedMotion]);

  return ref;
}
