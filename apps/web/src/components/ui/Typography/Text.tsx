'use client';

import React from 'react';
import clsx from 'clsx';
import styles from './Typography.module.css';

type TextSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl';
type TextWeight = 'light' | 'regular' | 'medium' | 'semibold' | 'bold';
type TextColor = 'primary' | 'secondary' | 'muted' | 'inverse' | 'accent' | 'success' | 'error';

interface TextProps {
  as?: 'p' | 'span' | 'div' | 'label';
  size?: TextSize;
  weight?: TextWeight;
  color?: TextColor;
  align?: 'start' | 'center' | 'end';
  truncate?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function Text({
  as: Component = 'p',
  size = 'base',
  weight = 'regular',
  color = 'secondary',
  align,
  truncate = false,
  className,
  children,
}: TextProps) {
  const combinedClassName = clsx(
    styles.text,
    styles[`size-${size}`],
    styles[`weight-${weight}`],
    styles[`color-${color}`],
    align && styles[`align-${align}`],
    truncate && styles.truncate,
    className
  );

  return (
    <Component className={combinedClassName}>
      {children}
    </Component>
  );
}
