'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { NewsButton } from '@/components/press/NewsButton';
import { ConfirmDialog } from './ConfirmDialog';
import { NoPermissionPanel } from './Panels';
import styles from './EscalationDialog.module.css';

/**
 * `פנייה למנהל־על` - the SPACE-09 escalation path (D21).
 *
 * TWO PROPERTIES, BOTH LOAD-BEARING. A later "consistency" pass must not
 * quietly undo either one:
 *
 * 1. It writes a server-side record. It posts to the escalations endpoint and
 *    is deliberately NOT a mail-client link: a link opens the admin's own mail
 *    app, leaves nothing behind on our side, and an escalation about a wrongly
 *    suspended admin is exactly the case that has to be recorded somewhere the
 *    platform can see it. The endpoint answers every caller identically and
 *    writes only the platform escalation row - never a space's audit log.
 *
 * 2. It is rendered REGARDLESS OF CAPABILITY, including to a suspended admin
 *    and to a member holding nothing at all. Every other control on this
 *    dashboard is absent unless its capability is held (Rule A); gating this
 *    one the same way would mean the people who most need it are precisely the
 *    people who cannot reach it.
 */

/**
 * `cta` is the overview's escalation panel: a lone secondary button.
 * `no-permission` is the refused surface: `NoPermissionPanel` with its own CTA
 * wired to this dialog, which is why that panel's `onEscalate` is required.
 */
export type EscalationTrigger = 'cta' | 'no-permission';

export interface EscalationDialogProps {
  spaceId: string;
  trigger?: EscalationTrigger;
  className?: string;
}

/** Copy-deck strings, each kept on one line so it stays one greppable literal. */
const HEADING = 'פנייה למנהל־על';
const BODY = 'הפנייה נשלחת למנהלי הפלטפורמה יחד עם שם המרחב ועם החשבון שלכם.';
const FIELD_LABEL = 'מה תרצו לבקש? (חובה)';
const FIELD_ERROR = 'נדרש תיאור - לפחות 10 תווים.';
const PLACEHOLDER =
  'תארו מה חסם אתכם - למשל הרשאה שאתם צריכים, או השעיה שנראית לכם שגויה.';
const CONFIRM = 'שלחו פנייה';
const UNBLOCK_HINT = 'התיאור נדרש כדי להמשיך.';
const SENT = 'הפנייה נשלחה. מנהל־על יקבל אותה עם פרטי המרחב.';

/**
 * Two failures worth telling apart: the limiter is five an hour per user, and
 * "try again" is bad advice to someone who has just been told to wait.
 */
const FAILED = 'הפנייה לא נשלחה. נסו שוב; אם זה חוזר, נסו שוב מאוחר יותר.';
const RATE_LIMITED = 'נשלחו כבר חמש פניות בשעה האחרונה. נסו שוב בעוד שעה.';

export function EscalationDialog({
  spaceId,
  trigger = 'cta',
  className,
}: EscalationDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (body: string) => {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/space-admin/${spaceId}/escalations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });

      if (!response.ok) {
        // The dialog stays open and the typed text survives - losing a
        // description someone had to write twice is its own small injustice.
        setError(response.status === 429 ? RATE_LIMITED : FAILED);
        return;
      }

      setOpen(false);
      setSent(true);
    } catch {
      setError(FAILED);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={clsx(styles.wrap, className)}>
      {trigger === 'no-permission' ? (
        <NoPermissionPanel onEscalate={() => setOpen(true)} />
      ) : (
        <NewsButton variant="outline" onClick={() => setOpen(true)}>
          {HEADING}
        </NewsButton>
      )}

      {/* Present from first render: a live region added at the same moment as
          its text is not reliably announced. Empty, it renders nothing. */}
      <p className={styles.sent} aria-live="polite">
        {sent ? SENT : ''}
      </p>

      <ConfirmDialog
        kind="audited"
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError(null);
        }}
        heading={HEADING}
        body={BODY}
        reasonLabel={FIELD_LABEL}
        reasonError={FIELD_ERROR}
        unblockHint={UNBLOCK_HINT}
        placeholder={PLACEHOLDER}
        confirmLabel={CONFIRM}
        pending={pending}
        error={error}
        onConfirm={(reason) => {
          void submit(reason);
        }}
      />
    </div>
  );
}
