'use client';

import React from 'react';
import clsx from 'clsx';
import styles from './Stepper.module.css';

interface Step {
  /** Short mono label, e.g. "בחירה", "אימות", "תשלום". */
  label: string;
}

interface StepperProps {
  steps: Step[];
  /** Zero-based index of the active step. */
  current: number;
  className?: string;
}

/**
 * Press flow stepper: numbered cells separated by ink rules. Completed steps
 * show a ✓ glyph, the active step is red, future steps faint. Mono numerals.
 * Mobile-first: numerals always visible, labels hide on the narrowest widths.
 */
export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <ol className={clsx(styles.stepper, className)} aria-label="שלבים">
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
