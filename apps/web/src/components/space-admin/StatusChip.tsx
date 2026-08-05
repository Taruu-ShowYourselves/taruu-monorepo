import React from 'react';
import clsx from 'clsx';
import styles from './StatusChip.module.css';

/**
 * Three appearances and no more (D24):
 *
 * - `review`    — `בבדיקה`, the single chip meaning "this needs your decision".
 *                 `--np-red-ink` TEXT with a `--np-red` hairline border on
 *                 paper-box (10.32:1 text, 3:1 border). Never a red fill: a
 *                 red-filled chip with paper text is 4.03:1 at 13.3px.
 * - `suspended` — `מושעה/ית`. Inverted ink (16.66:1). It means "switched off",
 *                 not "urgent", so it is deliberately not red.
 * - `neutral`   — everything else (`טיוטה`, `הוחזרה לתיקון`, `נדחתה`,
 *                 `אושרה ופורסמה`, `פעיל/ה`): ink outline.
 */
export type StatusChipTone = 'review' | 'suspended' | 'neutral';

export interface StatusChipProps {
  children: React.ReactNode;
  tone?: StatusChipTone;
  className?: string;
}

export function StatusChip({ children, tone = 'neutral', className }: StatusChipProps) {
  return <span className={clsx(styles.chip, styles[tone], className)}>{children}</span>;
}
