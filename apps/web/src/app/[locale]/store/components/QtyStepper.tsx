'use client';

import type { Locale } from '@/lib/i18n';
import styles from './QtyStepper.module.css';

interface QtyStepperCopy {
  group: string;
  decrease: string;
  increase: string;
}

const COPY: Record<Locale, QtyStepperCopy> = {
  he: {
    group: 'כמות',
    decrease: 'הפחתת כמות',
    increase: 'הוספת כמות',
  },
  en: {
    group: 'Quantity',
    decrease: 'Decrease quantity',
    increase: 'Increase quantity',
  },
};

interface QtyStepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  /** Accessible label for the control group. */
  label?: string;
  locale?: Locale;
}

/**
 * Hard-edge mono quantity stepper: [−] [n] [+]. Thumb-friendly tap targets,
 * clamps to [min, max]. Tabular numerals.
 */
export function QtyStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  label,
  locale = 'he',
}: QtyStepperProps) {
  const t = COPY[locale];
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const dec = () => onChange(clamp(value - 1));
  const inc = () => onChange(clamp(value + 1));

  return (
    <div className={styles.stepper} role="group" aria-label={label ?? t.group}>
      <button
        type="button"
        className={styles.btn}
        onClick={dec}
        disabled={value <= min}
        aria-label={t.decrease}
      >
        −
      </button>
      <span className={styles.value} aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={styles.btn}
        onClick={inc}
        disabled={value >= max}
        aria-label={t.increase}
      >
        +
      </button>
    </div>
  );
}
