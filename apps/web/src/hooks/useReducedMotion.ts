'use client';

import { useState, useEffect } from 'react';

/**
 * Hook to detect user's reduced motion preference
 * Returns true if the user prefers reduced motion
 *
 * Usage:
 * const prefersReducedMotion = useReducedMotion();
 *
 * // In Framer Motion
 * <motion.div animate={prefersReducedMotion ? {} : { scale: 1.1 }} />
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check for SSR
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Set initial value
    setPrefersReducedMotion(mediaQuery.matches);

    // Listen for changes
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return prefersReducedMotion;
}

/**
 * Get animation props that respect reduced motion
 * Returns empty object if reduced motion is preferred
 */
export function getMotionProps<T extends object>(
  props: T,
  prefersReducedMotion: boolean
): T | Record<string, never> {
  return prefersReducedMotion ? {} : props;
}
