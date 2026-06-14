'use client';

import React from 'react';
import clsx from 'clsx';
import styles from './Segmented.module.css';

interface Segment<T extends string> {
  value: T;
  label: React.ReactNode;
}

interface SegmentedProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Active fill colour. */
  variant?: 'ink' | 'red';
  /** ARIA label for the group. */
  'aria-label'?: string;
  className?: string;
}

/**
 * Press segmented control: boxed row with ink hairlines between cells, active
 * cell inverts to an ink/red fill. Mono labels. Mobile-first: wraps/scrolls,
 * full-width.
 */
export function Segmented<T extends string>({
  segments,
  value,
  onChange,
  variant = 'ink',
  className,
  ...rest
}: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={rest['aria-label']}
      className={clsx(styles.group, styles[variant], className)}
    >
      {segments.map((s) => {
        const active = s.value === value;
        return (
          <button
            key={s.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={clsx(styles.cell, active && styles.active)}
            onClick={() => onChange(s.value)}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
