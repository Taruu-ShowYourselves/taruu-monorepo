'use client';

import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useReducedMotion } from '@/hooks';
import { buttonPress, buttonHover, iconNudge } from '@/lib/animations';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'link';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl' | 'small' | 'large';

const sizeMap: Record<string, string> = {
  small: 'sm',
  large: 'lg',
};

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  isFullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  /** Disable micro-animations (overrides system preference) */
  disableAnimation?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  isFullWidth = false,
  leftIcon,
  rightIcon,
  children,
  className,
  disabled,
  type = 'button',
  onClick,
  disableAnimation = false,
}: ButtonProps) {
  const prefersReducedMotion = useReducedMotion();
  const isDisabled = disabled || isLoading;
  const normalizedSize = sizeMap[size] || size;

  // Disable animations if user prefers reduced motion or explicitly disabled
  const shouldAnimate = !prefersReducedMotion && !disableAnimation && !isDisabled;

  return (
    <motion.button
      type={type}
      className={clsx(
        styles.button,
        styles[variant],
        styles[normalizedSize],
        isFullWidth && styles.fullWidth,
        isLoading && styles.loading,
        className
      )}
      disabled={isDisabled}
      onClick={onClick}
      whileHover={shouldAnimate ? buttonHover : undefined}
      whileTap={shouldAnimate ? buttonPress : undefined}
    >
      {isLoading ? (
        <span className={styles.spinner}>
          <svg
            className={styles.spinnerIcon}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="32"
              strokeDashoffset="32"
            />
          </svg>
        </span>
      ) : (
        <>
          {leftIcon ? (
            <motion.span
              className={styles.icon}
              whileHover={shouldAnimate ? iconNudge : undefined}
            >
              {leftIcon}
            </motion.span>
          ) : null}
          <span className={styles.text}>{children}</span>
          {rightIcon ? (
            <motion.span
              className={styles.icon}
              whileHover={shouldAnimate ? iconNudge : undefined}
            >
              {rightIcon}
            </motion.span>
          ) : null}
        </>
      )}
    </motion.button>
  );
}
