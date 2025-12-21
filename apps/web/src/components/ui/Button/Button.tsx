'use client';

import React from 'react';
import clsx from 'clsx';
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
}: ButtonProps) {
  const isDisabled = disabled || isLoading;
  const normalizedSize = sizeMap[size] || size;

  return (
    <button
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
          {leftIcon ? <span className={styles.icon}>{leftIcon}</span> : null}
          <span className={styles.text}>{children}</span>
          {rightIcon ? <span className={styles.icon}>{rightIcon}</span> : null}
        </>
      )}
    </button>
  );
}
