'use client';

import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks';
import styles from './MicroProgress.module.css';

interface MicroProgressProps {
  /** Progress value from 0 to 100 */
  value: number;
  /** Visual variant */
  variant?: 'primary' | 'secondary' | 'success';
  /** Size of the progress bar */
  size?: 'sm' | 'md' | 'lg';
  /** Show pulse animation when in progress */
  showPulse?: boolean;
  /** Show percentage label */
  showLabel?: boolean;
  /** Custom class name */
  className?: string;
  /** Accessible label */
  'aria-label'?: string;
}

export function MicroProgress({
  value,
  variant = 'primary',
  size = 'md',
  showPulse = false,
  showLabel = false,
  className,
  'aria-label': ariaLabel,
}: MicroProgressProps) {
  const prefersReducedMotion = useReducedMotion();
  const clampedValue = Math.min(100, Math.max(0, value));
  const isComplete = clampedValue >= 100;
  const isInProgress = clampedValue > 0 && clampedValue < 100;

  return (
    <div
      className={`${styles.container} ${styles[size]} ${className || ''}`}
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel || `Progress: ${clampedValue}%`}
    >
      <div className={`${styles.track} ${styles[variant]}`}>
        <motion.div
          className={styles.fill}
          initial={{ scaleX: 0 }}
          animate={{
            scaleX: clampedValue / 100,
            // Subtle pulse when in progress and not reduced motion
            opacity:
              showPulse && isInProgress && !prefersReducedMotion
                ? [1, 0.85, 1]
                : 1,
          }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : {
                  scaleX: {
                    type: 'spring',
                    stiffness: 100,
                    damping: 20,
                  },
                  opacity: {
                    duration: 1.5,
                    repeat: showPulse && isInProgress ? Infinity : 0,
                    ease: 'easeInOut',
                  },
                }
          }
          style={{ originX: 1 }} // RTL - scale from right
        />
      </div>
      {showLabel && (
        <motion.span
          className={styles.label}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
        >
          {Math.round(clampedValue)}%
        </motion.span>
      )}
    </div>
  );
}

/**
 * Circular micro-progress indicator
 */
interface CircularProgressProps {
  /** Progress value from 0 to 100 */
  value: number;
  /** Size in pixels */
  size?: number;
  /** Stroke width */
  strokeWidth?: number;
  /** Visual variant */
  variant?: 'primary' | 'secondary' | 'success';
  /** Custom class name */
  className?: string;
}

export function CircularProgress({
  value,
  size = 40,
  strokeWidth = 4,
  variant = 'primary',
  className,
}: CircularProgressProps) {
  const prefersReducedMotion = useReducedMotion();
  const clampedValue = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (clampedValue / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      className={`${styles.circular} ${styles[variant]} ${className || ''}`}
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {/* Track */}
      <circle
        className={styles.circularTrack}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* Fill */}
      <motion.circle
        className={styles.circularFill}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : {
                type: 'spring',
                stiffness: 100,
                damping: 20,
              }
        }
        style={{
          transform: 'rotate(-90deg)',
          transformOrigin: '50% 50%',
        }}
      />
    </svg>
  );
}
