'use client';

import React from 'react';
import clsx from 'clsx';
import styles from './Card.module.css';

type CardVariant = 'default' | 'elevated' | 'outlined' | 'filled';
type CardPadding = 'none' | 'sm' | 'md' | 'lg' | 'xl';

interface CardProps {
  variant?: CardVariant;
  padding?: CardPadding;
  interactive?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Card({
  variant = 'default',
  padding = 'md',
  interactive = false,
  className,
  children,
}: CardProps) {
  return (
    <div
      className={clsx(
        styles.card,
        styles[variant],
        styles[`padding-${padding}`],
        interactive && styles.interactive,
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div className={clsx(styles.header, className)}>
      {children}
    </div>
  );
}

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return (
    <div className={clsx(styles.content, className)}>
      {children}
    </div>
  );
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div className={clsx(styles.footer, className)}>
      {children}
    </div>
  );
}
