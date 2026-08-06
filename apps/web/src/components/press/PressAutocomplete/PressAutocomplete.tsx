'use client';

import React, { useId } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import clsx from 'clsx';
import type { Locale } from '@/lib/i18n';
import styles from './PressAutocomplete.module.css';

interface Option {
  value: string;
  label: string;
}

interface PressAutocompleteProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  /** Fires on every keystroke with the raw input text (live filtering). */
  onInputChange?: (text: string) => void;
  placeholder?: string;
  noOptionsText?: string;
  locale?: Locale;
  className?: string;
}

interface PressAutocompleteCopy {
  noOptions: string;
}

const COPY: Record<Locale, PressAutocompleteCopy> = {
  he: { noOptions: 'לא נמצאו תוצאות' },
  en: { noOptions: 'No results found' },
};

const inputSx = {
  '& .MuiOutlinedInput-root': {
    fontFamily: 'var(--np-font-meta)',
    fontSize: 'var(--text-base)',
    color: 'var(--np-ink)',
    background:
      'linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0) 45%), var(--np-paper-box)',
    borderRadius: 'var(--np-radius-card)',
    boxShadow: 'var(--np-shadow-soft)',
    minHeight: '3rem',
    transition: 'box-shadow 200ms cubic-bezier(0.2,0,0,1), transform 200ms cubic-bezier(0.2,0,0,1)',
    '& .MuiOutlinedInput-notchedOutline': {
      border: 'var(--np-rule) solid var(--np-ink)',
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: 'var(--np-ink-soft)',
    },
    '&.Mui-focused': {
      transform: 'translateY(-1px)',
      boxShadow: 'var(--np-shadow-soft), var(--np-focus-ring)',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      border: 'var(--np-rule) solid var(--np-red)',
    },
  },
  '& .MuiOutlinedInput-input::placeholder': {
    color: 'var(--np-ink-faint)',
    opacity: 1,
  },
} as const;

const paperSx = {
  fontFamily: 'var(--np-font-meta)',
  background: 'var(--np-paper-box)',
  border: 'var(--np-rule) solid var(--np-ink)',
  borderRadius: 'var(--np-radius-card)',
  boxShadow: 'var(--np-shadow-float)',
  marginTop: '6px',
  '& .MuiAutocomplete-option': {
    fontFamily: 'var(--np-font-meta)',
    fontSize: 'var(--text-base)',
    color: 'var(--np-ink)',
    minHeight: '2.5rem',
  },
  '& .MuiAutocomplete-option.Mui-focused': {
    backgroundColor: 'color-mix(in srgb, var(--np-red) 8%, transparent)',
  },
  '& .MuiAutocomplete-option[aria-selected="true"]': {
    backgroundColor: 'var(--np-ink)',
    color: 'var(--np-paper)',
  },
  '& .MuiAutocomplete-noOptions': {
    fontFamily: 'var(--np-font-meta)',
    color: 'var(--np-ink-faint)',
  },
} as const;

/**
 * Searchable press combobox (MUI Autocomplete under newsprint chrome).
 * Same field anatomy as PressInput/PressSelect: label above, hint/error below.
 */
export function PressAutocomplete({
  label,
  hint,
  error,
  options,
  value,
  onChange,
  onInputChange,
  placeholder,
  noOptionsText,
  locale = 'he',
  className,
}: PressAutocompleteProps) {
  const t = COPY[locale];
  const fieldId = useId();
  const invalid = Boolean(error);
  const selected = options.find((o) => o.value === value) ?? null;

  return (
    <div className={clsx(styles.field, invalid && styles.invalid, className)}>
      {label ? (
        <label htmlFor={fieldId} className={styles.label}>
          {label}
        </label>
      ) : null}
      <Autocomplete
        id={fieldId}
        options={options}
        value={selected}
        onChange={(_e, option) => onChange(option?.value ?? '')}
        onInputChange={
          onInputChange ? (_e, text) => onInputChange(text) : undefined
        }
        getOptionLabel={(o) => o.label}
        isOptionEqualToValue={(a, b) => a.value === b.value}
        noOptionsText={noOptionsText ?? t.noOptions}
        fullWidth
        slotProps={{ paper: { sx: paperSx } }}
        sx={inputSx}
        renderInput={(params) => (
          <TextField {...params} placeholder={placeholder} error={invalid} />
        )}
      />
      {error ? <p className={styles.error}>{error}</p> : null}
      {hint && !error ? <p className={styles.hint}>{hint}</p> : null}
    </div>
  );
}
