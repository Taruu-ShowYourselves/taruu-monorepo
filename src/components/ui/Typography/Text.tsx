'use client';

import { forwardRef, ElementType, ComponentPropsWithoutRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import clsx from 'clsx';
import styles from './Typography.module.css';

type TextSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl';
type TextWeight = 'light' | 'regular' | 'medium' | 'semibold' | 'bold';
type TextColor = 'primary' | 'secondary' | 'muted' | 'inverse' | 'accent' | 'success' | 'error';

interface TextProps extends Omit<HTMLMotionProps<'p'>, 'color'> {
  as?: 'p' | 'span' | 'div' | 'label';
  size?: TextSize;
  weight?: TextWeight;
  color?: TextColor;
  align?: 'start' | 'center' | 'end';
  truncate?: boolean;
  animate?: boolean;
}

export const Text = forwardRef<HTMLParagraphElement, TextProps>(
  (
    {
      as = 'p',
      size = 'base',
      weight = 'regular',
      color = 'secondary',
      align,
      truncate = false,
      animate = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const Component = animate ? motion[as as keyof typeof motion] : as;

    const combinedClassName = clsx(
      styles.text,
      styles[`size-${size}`],
      styles[`weight-${weight}`],
      styles[`color-${color}`],
      align && styles[`align-${align}`],
      truncate && styles.truncate,
      className
    );

    if (animate) {
      return (
        <motion.p
          ref={ref}
          className={combinedClassName}
          {...props}
        >
          {children}
        </motion.p>
      );
    }

    const StaticComponent = as;
    return (
      <StaticComponent
        ref={ref as any}
        className={combinedClassName}
        {...(props as ComponentPropsWithoutRef<typeof StaticComponent>)}
      >
        {children}
      </StaticComponent>
    );
  }
);

Text.displayName = 'Text';
