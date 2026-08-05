'use client';

import React, { useRef } from 'react';
import { motion, useMotionValue, useMotionTemplate } from 'framer-motion';
import clsx from 'clsx';
import { useReducedMotion } from '@/hooks';
import styles from './GlassCard.module.css';

type GlassVariant = 'static' | 'interactive' | 'spotlight' | 'press';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: GlassVariant;
  /** Spotlight tint, defaults to brand blue */
  glow?: 'blue' | 'green' | 'purple' | 'amber' | 'brand';
  children: React.ReactNode;
}

const glowRGB: Record<string, string> = {
  blue: '37, 99, 235',
  green: '16, 185, 129',
  purple: '139, 92, 246',
  amber: '245, 158, 11',
  brand: '59, 130, 246',
};

/**
 * Liquid-glass surface. `spotlight` tracks the cursor to illuminate the border
 * (motion values only - no React re-renders). Falls back to a static glass
 * surface under reduced motion or on touch.
 *
 * `press` is the newsprint-era glass: `--np-glass-*` tokens, hard 2px ink
 * border, `--np-radius-card`, no hover physics - the live-money layer of the
 * brutalist tech-press system. Luminous variants stay untouched (legacy).
 */
export function GlassCard({
  variant = 'static',
  glow = 'brand',
  children,
  className,
  ...rest
}: GlassCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const mx = useMotionValue(-200);
  const my = useMotionValue(-200);

  const isSpotlight = variant === 'spotlight' && !reducedMotion;
  const background = useMotionTemplate`radial-gradient(220px circle at ${mx}px ${my}px, rgba(${glowRGB[glow]}, 0.18), transparent 70%)`;

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSpotlight || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };

  const handleLeave = () => {
    mx.set(-200);
    my.set(-200);
  };

  return (
    <div
      ref={ref}
      className={clsx(
        styles.card,
        variant === 'interactive' && styles.interactive,
        variant === 'spotlight' && styles.spotlight,
        variant === 'press' && styles.press,
        className
      )}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      {...rest}
    >
      {isSpotlight ? (
        <motion.span aria-hidden className={styles.spot} style={{ background }} />
      ) : null}
      <div className={styles.inner}>{children}</div>
    </div>
  );
}
