'use client';

import React from 'react';
import clsx from 'clsx';
import { NewsButton } from '@/components/press/NewsButton';
import type { Locale } from '@/lib/i18n';
import kicker from './kicker.module.css';
import styles from './Panels.module.css';

/**
 * The three non-happy-path panels, one implementation each. Surfaces must not
 * hand-roll variants of these - the State Matrix names exactly these three.
 */

export interface EmptyPanelProps {
  heading: string;
  body: string;
  /** Optional mono kicker, e.g. for a filter-no-results panel. */
  kicker?: React.ReactNode;
  /** Optional reset affordance, e.g. `הצגת הכול` / `ניקוי חיפוש`. */
  action?: React.ReactNode;
  className?: string;
}

/** Heading and body are props: every surface supplies its own empty copy. */
export function EmptyPanel({
  heading,
  body,
  kicker: kickerText,
  action,
  className,
}: EmptyPanelProps) {
  return (
    <div className={clsx(styles.panel, className)}>
      {kickerText ? (
        <span className={kicker.kicker}>
          <span aria-hidden className={kicker.tick}>
            ■
          </span>
          {kickerText}
        </span>
      ) : null}
      <h2 className={styles.heading}>{heading}</h2>
      <p className={styles.body}>{body}</p>
      {action ? <div className={styles.actions}>{action}</div> : null}
    </div>
  );
}

interface ErrorPanelCopy {
  kicker: string;
  defaultBody: string;
  retryLabel: string;
}

const ERROR_COPY: Record<Locale, ErrorPanelCopy> = {
  he: {
    kicker: 'שגיאה · ERROR',
    defaultBody:
      'לא הצלחנו לטעון את הנתונים. הנתונים עצמם לא נפגעו - נסו שוב; אם זה חוזר, פנו למנהל-על.',
    retryLabel: 'נסו שוב',
  },
  en: {
    kicker: 'SOMETHING WENT WRONG · ERROR',
    defaultBody:
      'We could not load the data. The data itself is intact - try again; if this recurs, contact a super-admin.',
    retryLabel: 'Try again',
  },
};

export interface ErrorPanelProps {
  /** Retry affordance. Omit to render the panel without a CTA. */
  onRetry?: () => void;
  /** Override for a surface with its own error sentence (e.g. the audit log). */
  body?: string;
  retryLabel?: string;
  locale?: Locale;
  className?: string;
}

export function ErrorPanel({
  onRetry,
  body,
  retryLabel,
  locale = 'he',
  className,
}: ErrorPanelProps) {
  const t = ERROR_COPY[locale];
  return (
    <div className={clsx(styles.panel, className)} role="alert">
      <span className={kicker.kicker}>
        <span aria-hidden className={kicker.tick}>
          ■
        </span>
        {t.kicker}
      </span>
      <p className={styles.body}>{body ?? t.defaultBody}</p>
      {onRetry ? (
        <div className={styles.actions}>
          <NewsButton variant="outline" onClick={onRetry}>
            {retryLabel}
          </NewsButton>
        </div>
      ) : null}
    </div>
  );
}

export interface NoPermissionPanelProps {
  /**
   * Opens the escalation `ConfirmDialog`. Required, because SPACE-09 makes
   * `פנייה למנהל-על` a real path rather than a decorative button - and this
   * is the one control rendered regardless of capability, including to a
   * suspended admin holding nothing at all.
   */
  onEscalate: () => void;
  className?: string;
}

export function NoPermissionPanel({ onEscalate, className }: NoPermissionPanelProps) {
  return (
    <div className={clsx(styles.panel, className)}>
      <span className={kicker.kicker}>
        <span aria-hidden className={kicker.tick}>
          ■
        </span>
        אין הרשאה · NO ACCESS
      </span>
      <h2 className={styles.heading}>אין לכם גישה לחלק הזה</h2>
      <p className={styles.body}>
        החשבון שלכם לא מחזיק את ההרשאה הנדרשת במרחב הזה, או שהגישה הושעתה. אם זו
        טעות - פנו למנהל-על.
      </p>
      <div className={styles.actions}>
        <NewsButton variant="outline" onClick={onEscalate}>
          פנייה למנהל-על
        </NewsButton>
      </div>
      <p className={styles.note}>
        ההרשאות נבדקות בשרת בכל בקשה. הסתרת כפתור אינה מה שמגן על הנתונים.
      </p>
    </div>
  );
}
