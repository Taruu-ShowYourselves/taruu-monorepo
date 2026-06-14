'use client';

import React, { useId } from 'react';
import clsx from 'clsx';
import styles from './PressInput.module.css';

interface BaseProps {
  /** Mono kicker label rendered above the field. */
  label?: React.ReactNode;
  /** Error message; red rule + message row when set. */
  error?: string | null;
  /** Helper meta under the field (mono, faint). */
  hint?: React.ReactNode;
  className?: string;
}

type InputProps = BaseProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> & { multiline?: false };
type TextareaProps = BaseProps &
  Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> & { multiline: true };

/**
 * Press input: hard-edge box, 2px ink border, mono text, kicker label above,
 * red focus + error rule. Mobile-first (full-width, comfortable tap target).
 */
export function PressInput(props: InputProps | TextareaProps) {
  const { label, error, hint, className, multiline, id, ...rest } = props as
    & BaseProps
    & { multiline?: boolean; id?: string }
    & Record<string, unknown>;
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
      {multiline ? (
        <textarea
          id={fieldId}
          className={styles.control}
          aria-invalid={invalid || undefined}
          {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          id={fieldId}
          className={styles.control}
          aria-invalid={invalid || undefined}
          {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
        />
      )}
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
