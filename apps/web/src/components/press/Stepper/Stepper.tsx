'use client';

import React from 'react';
import clsx from 'clsx';
import type { Locale } from '@/lib/i18n';
import styles from './Stepper.module.css';

interface Step {
  /** Short mono label, e.g. "בחירה", "אימות", "תשלום". */
  label: string;
}

interface StepperProps {
  steps: Step[];
  /** Zero-based index of the active step. */
  current: number;
  locale?: Locale;
  className?: string;
}

interface StepperCopy {
  ariaLabel: string;
}

const COPY: Record<Locale, StepperCopy> = {
  he: { ariaLabel: 'שלבים' },
  en: { ariaLabel: 'Steps' },
};

/**
 * Press flow stepper: numbered cells separated by ink rules. Completed steps
 * show a ✓ glyph, the active step is red, future steps faint. Mono numerals.
 * Mobile-first: numerals always visible, labels hide on the narrowest widths.
 */
export function Stepper({ steps, current, locale = 'he', className }: StepperProps) {
  const t = COPY[locale];
  return (
    <ol className={clsx(styles.stepper, className)} aria-label={t.ariaLabel}>
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'todo';
        return (
          <li
            key={s.label}
            className={clsx(styles.step, styles[state])}
            aria-current={state === 'active' ? 'step' : undefined}
          >
            <span className={styles.marker} aria-hidden>
              {state === 'done' ? '✓' : String(i + 1).padStart(2, '0')}
            </span>
            <span className={styles.label}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
