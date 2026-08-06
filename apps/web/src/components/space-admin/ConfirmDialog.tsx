'use client';

import React, { useEffect, useId, useState } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { NewsButton } from '@/components/press/NewsButton';
import { PressInput } from '@/components/press/PressInput/PressInput';
import type { Locale } from '@/lib/i18n';
import disabledStyles from './disabledButton.module.css';
import kicker from './kicker.module.css';
import styles from './ConfirmDialog.module.css';

export const REASON_MIN_LENGTH = 10;
export const REASON_MAX_LENGTH = 500;

/**
 * The disabled-state contract (D17/D27) on its own, for every permitted
 * `disabled` control in this phase — including the ones that are not `ink`:
 * `PressTable`'s `outline` pagination and the dispatch send, which is
 * `red`/`lg`.
 *
 * Safe on any variant. It paints only the disabled and disabled-hover states.
 */
export const disabledButtonClass: string = disabledStyles.control;

/**
 * The disabled contract PLUS the dense-`ink` hover fix (D23).
 *
 * Apply this one to `variant="ink"` controls ONLY. No `outline` control and no
 * `red` control ever takes a red or red-dark fill: `outline` already inverts
 * to ink at 16.66:1, and `red` inverts to ink at the same ratio, so the D23
 * override would LOWER compliant contrast on both — the mistake the spec
 * caught and reverted once. Those controls take `disabledButtonClass`.
 */
export const confirmButtonClass = `${disabledStyles.control} ${styles.confirmBtn}`;

interface ConfirmDialogCopy {
  kickerAudited: string;
  kickerIrreversible: string;
  reasonLabel: string;
  reasonError: string;
  cancelLabel: string;
  unblockHint: string;
  pendingLabel: string;
}

const COPY: Record<Locale, ConfirmDialogCopy> = {
  he: {
    kickerAudited: 'פעולה מתועדת · AUDITED',
    kickerIrreversible: 'פעולה בלתי הפיכה · IRREVERSIBLE',
    reasonLabel: 'נימוק ההחלטה (חובה)',
    reasonError: 'נדרש נימוק — לפחות 10 תווים.',
    cancelLabel: 'ביטול',
    unblockHint: 'הנימוק נדרש כדי להמשיך.',
    pendingLabel: '…שולח',
  },
  en: {
    kickerAudited: 'RECORDED ACTION · AUDITED',
    kickerIrreversible: 'CANNOT BE UNDONE · IRREVERSIBLE',
    reasonLabel: 'Reason for the decision (required)',
    reasonError: 'A reason is required — at least 10 characters.',
    cancelLabel: 'Cancel',
    unblockHint: 'The reason is required to continue.',
    pendingLabel: 'Sending…',
  },
};

interface ConfirmDialogBaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale?: Locale;
  /** The question, e.g. `לאשר ולפרסם את ההצעה?`. */
  heading: string;
  /** What happens. */
  body: string;
  /** The action verb — never `אישור` and never `OK`. */
  confirmLabel: string;
  reasonLabel?: string;
  reasonError?: string;
  placeholder?: string;
  cancelLabel?: string;
  /**
   * Rule B: every disabled control carries visible text naming what unblocks
   * it. The escalation dialog overrides this, since its field is a request
   * rather than a decision reason.
   */
  unblockHint?: string;
  /** Request in flight: the confirm label swaps and the control disables. */
  pending?: boolean;
  pendingLabel?: string;
  /** Server failure. The dialog stays open and the typed reason is preserved. */
  error?: string | null;
  onConfirm: (reason: string) => void;
}

/**
 * `irreversible` means: THE ADMIN CANNOT UNDO THE EFFECT FROM THIS DASHBOARD.
 * It does not mean "it is written to the audit log" — that is true of every
 * action here, so audit-permanence cannot be the test or the label means
 * nothing. Exactly three actions qualify in this phase:
 *
 *   approve (publishes to residents and creates the ₪50 obligation),
 *   reject  (terminal for that submission),
 *   send    (delivered to devices, cannot be recalled).
 *
 * Everything else — grant, revoke, suspend, reinstate, hide, unhide, flag,
 * unflag, request-changes, escalate — has an inverse reachable from this same
 * dashboard and is therefore `audited`. Do not re-label suspension: it sets a
 * nullable `suspended_at` and clearing it restores access.
 */
type ConfirmDialogProps =
  | (ConfirmDialogBaseProps & {
      kind: 'audited';
      /** Optional: used where a permanent record is worth stating anyway. */
      consequence?: string;
    })
  | (ConfirmDialogBaseProps & {
      kind: 'irreversible';
      /** Required by the compiler on this kind — the plate must state it. */
      consequence: string;
    });

export type { ConfirmDialogProps };

/**
 * Confirmation with a required reason (SPACE-04), painted with press tokens
 * over a Radix `AlertDialog` (focus trap, `Escape`, scroll lock, RTL).
 *
 * Initial focus is the reason textarea, never the confirm button. The confirm
 * button is NOT `AlertDialog.Action`: Action closes the dialog on click, and
 * on a server failure this dialog must stay open with the typed text intact.
 */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const {
    kind,
    open,
    onOpenChange,
    heading,
    body,
    consequence,
    confirmLabel,
    placeholder,
    pending = false,
    error,
    onConfirm,
    locale = 'he',
  } = props;

  const t = COPY[locale];
  const reasonLabel = props.reasonLabel ?? t.reasonLabel;
  const reasonError = props.reasonError ?? t.reasonError;
  const cancelLabel = props.cancelLabel ?? t.cancelLabel;
  const unblockHint = props.unblockHint ?? t.unblockHint;
  const pendingLabel = props.pendingLabel ?? t.pendingLabel;

  const reasonId = useId();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) {
      setReason('');
      setTouched(false);
    }
  }, [open]);

  const trimmed = reason.trim();
  const valid =
    trimmed.length >= REASON_MIN_LENGTH && trimmed.length <= REASON_MAX_LENGTH;
  const irreversible = kind === 'irreversible';

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        {/* AlertDialog deliberately ignores outside pointer events, so the
            backdrop cancel is wired on the overlay itself. */}
        <AlertDialog.Overlay
          className={styles.backdrop}
          onClick={() => {
            if (!pending) onOpenChange(false);
          }}
        />
        <AlertDialog.Content
          className={styles.positioner}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            document.getElementById(reasonId)?.focus();
          }}
        >
          <div className={irreversible ? styles.plateIrreversible : styles.plate}>
            <span className={kicker.kicker}>
              <span aria-hidden className={kicker.tick}>
                ■
              </span>
              {irreversible ? t.kickerIrreversible : t.kickerAudited}
            </span>

            <AlertDialog.Title className={styles.heading}>{heading}</AlertDialog.Title>
            <AlertDialog.Description className={styles.body}>
              {body}
            </AlertDialog.Description>

            {consequence ? <p className={styles.consequence}>{consequence}</p> : null}

            <hr className={styles.rule} />

            <PressInput
              multiline
              id={reasonId}
              rows={4}
              value={reason}
              maxLength={REASON_MAX_LENGTH}
              placeholder={placeholder}
              label={reasonLabel}
              error={touched && !valid ? reasonError : null}
              onBlur={() => setTouched(true)}
              onChange={(event) => setReason(event.target.value)}
            />

            <p className={styles.counter}>
              {reason.length}/{REASON_MAX_LENGTH}
            </p>

            {error ? (
              <p className={styles.error} role="alert">
                <span aria-hidden>✕ </span>
                {error}
              </p>
            ) : null}

            <hr className={styles.rule} />

            <div className={styles.actions}>
              <NewsButton
                variant="ink"
                className={confirmButtonClass}
                disabled={!valid || pending}
                onClick={() => onConfirm(trimmed)}
              >
                {pending ? pendingLabel : confirmLabel}
              </NewsButton>

              <AlertDialog.Cancel asChild>
                {/* `outline`, so it takes the disabled appearance WITHOUT the
                    D23 hover fill. Before 05-15 split the two, this button
                    could not have the appearance at all without also taking a
                    red hover — so while a request was in flight it looked
                    exactly like an enabled control. */}
                <NewsButton
                  variant="outline"
                  className={disabledButtonClass}
                  disabled={pending}
                >
                  {cancelLabel}
                </NewsButton>
              </AlertDialog.Cancel>
            </div>

            {!valid ? <p className={styles.unblockHint}>{unblockHint}</p> : null}
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
