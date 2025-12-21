'use client';

import React from 'react';
import clsx from 'clsx';
import styles from './Typography.module.css';

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type HeadingWeight = 'medium' | 'semibold' | 'bold' | 'extrabold' | 'black';
type HeadingColor = 'primary' | 'secondary' | 'muted' | 'inverse' | 'accent';

interface HeadingProps {
  level: HeadingLevel;
  as?: `h${HeadingLevel}`;
  weight?: HeadingWeight;
  color?: HeadingColor;
  align?: 'start' | 'center' | 'end';
  className?: string;
  children: React.ReactNode;
}

const headingTags = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
  4: 'h4',
  5: 'h5',
  6: 'h6',
} as const;

export function Heading({
  level,
  as,
  weight = 'bold',
  color = 'primary',
  align,
  className,
  children,
}: HeadingProps) {
  const Tag = as || headingTags[level];

  const combinedClassName = clsx(
    styles.heading,
    styles[`heading-${level}`],
    styles[`weight-${weight}`],
    styles[`heading-color-${color}`],
    align && styles[`align-${align}`],
    className
  );

  const Component = Tag as any;
  return (
    <Component className={combinedClassName}>
      {children}
    </Component>
  );
}
