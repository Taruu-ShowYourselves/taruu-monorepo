'use client';

import React, { useId } from 'react';
import clsx from 'clsx';
import styles from './PressSelect.module.css';

interface Option {
  value: string;
  label: string;
}

interface PressSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'children'> {
  label?: React.ReactNode;
  error?: string | null;
  hint?: React.ReactNode;
  options: Option[];
  placeholder?: string;
  className?: string;
}

/**
 * Press select: hard-edge box with native select, mono text, ink ▾ caret,
 * red focus/error rule. Mobile-first full-width.
 */
export function PressSelect({
  label,
  error,
  hint,
  options,
  placeholder,
  className,
  id,
  ...rest
}: PressSelectProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const invalid = Boolean(error);

  return (
    <div className={clsx(styles.field, invalid && styles.invalid, className)}>
      {label ? (
        <label htmlFor={fieldId} className={styles.label}>
          {label}
        </label>
      ) : null}
      <div className={styles.wrap}>
        <select
          id={fieldId}
          className={styles.control}
          aria-invalid={invalid || undefined}
          {...rest}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className={styles.caret} aria-hidden>
          ▾
        </span>
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          <span aria-hidden>✕ </span>
          {error}
        </p>
      ) : hint ? (
        <p className={styles.hint}>{hint}</p>
      ) : null}
    </div>
  );
}
