'use client';

import { forwardRef, ReactNode } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import clsx from 'clsx';
import styles from './Typography.module.css';

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type HeadingWeight = 'medium' | 'semibold' | 'bold' | 'extrabold' | 'black';
type HeadingColor = 'primary' | 'secondary' | 'muted' | 'inverse' | 'accent';

interface HeadingProps extends Omit<HTMLMotionProps<'h1'>, 'children'> {
  level: HeadingLevel;
  as?: `h${HeadingLevel}`;
  weight?: HeadingWeight;
  color?: HeadingColor;
  align?: 'start' | 'center' | 'end';
  animate?: boolean;
  children: ReactNode;
}

const headingTags = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
  4: 'h4',
  5: 'h5',
  6: 'h6',
} as const;

export const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(
  (
    {
      level,
      as,
      weight = 'bold',
      color = 'primary',
      align,
      animate = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const Tag = as || headingTags[level];

    const combinedClassName = clsx(
      styles.heading,
      styles[`heading-${level}`],
      styles[`weight-${weight}`],
      styles[`heading-color-${color}`],
      align && styles[`align-${align}`],
      className
    );

    if (animate) {
      const MotionTag = motion[Tag as keyof typeof motion];
      return (
        <MotionTag
          ref={ref}
          className={combinedClassName}
          {...props}
        >
          {children}
        </MotionTag>
      );
    }

    const StaticTag = Tag as any;
    return (
      <StaticTag ref={ref} className={combinedClassName} {...props}>
        {children}
      </StaticTag>
    );
  }
);

Heading.displayName = 'Heading';
