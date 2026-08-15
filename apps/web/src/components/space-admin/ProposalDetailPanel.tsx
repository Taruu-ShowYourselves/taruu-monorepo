'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import type { ContentAction, ProposalDetail } from '@sync/shared/contracts';
import { NewsButton } from '@/components/press/NewsButton';
import { ConfirmDialog } from './ConfirmDialog';
import styles from './ProposalDetailPanel.module.css';

/**
 * The proposal detail panel (Surface 2, D18 + D25).
 *
 * It is a `<tr>` immediately after the proposal's row, holding a single
 * `<td colSpan>` - the same device as the responsive row disclosure, reused at
 * every width rather than only on narrow screens. Table semantics survive, and
 * on this surface the panel IS the row disclosure: the generic details toggle
 * is not additionally rendered, so there is exactly one expansion per row.
 *
 * It is deliberately NOT a route (the "no seventh route" decision) and NOT a
 * dialog (`ConfirmDialog` is already the modal layer, and stacking a
 * confirmation on top of a modal is bad practice).
 *
 * The panel is also where the permitted-content controls live, which is what
 * gives the `לנהל תוכן מותר` capability somewhere to act. An admin without
 * that capability still opens the panel and still reads the proposal; the four
 * controls are simply absent (Rule A), never present-but-inert.
 *
 * The decision actions stay in the ROW, not here - approve, return and reject
 * must be reachable without expanding anything.
 */

/** POST body of `/api/space-admin/{spaceId}/proposals/{voteId}/content`. */
interface ContentControl {
  action: ContentAction;
  /** Row-level button label. */
  label: string;
  heading: string;
  body: string;
  confirmLabel: string;
  /** `aria-live="polite"` string once the server has accepted the action. */
  announcement: string;
}

/**
 * All four are `kind="audited"`: each has its inverse in this same panel, so
 * none of them is irreversible from this dashboard. Hide/unhide and flag/unflag
 * are mutually exclusive at render time - a hidden item never offers hide.
 */
const CONTENT_CONTROLS: Record<ContentAction, ContentControl> = {
  hide: {
    action: 'hide',
    label: 'הסתרת תוכן',
    heading: 'להסתיר את התוכן מהתושבים?',
    body: 'התוכן לא יוצג לתושבי המרחב. ההצעה עצמה נשארת בתור ההכרעה.',
    confirmLabel: 'הסתירו את התוכן',
    announcement: 'התוכן הוסתר מהתושבים.',
  },
  unhide: {
    action: 'unhide',
    label: 'ביטול הסתרה',
    heading: 'להחזיר את התוכן לתצוגה?',
    body: 'התוכן יוצג שוב לתושבי המרחב.',
    confirmLabel: 'החזירו לתצוגה',
    announcement: 'התוכן הוחזר לתצוגה.',
  },
  flag: {
    action: 'flag',
    label: 'סימון לבדיקה',
    heading: 'לסמן את התוכן לבדיקה?',
    body: 'התוכן יסומן לבדיקה ויישאר גלוי לתושבים. הסימון נרשם ביומן.',
    confirmLabel: 'סמנו לבדיקה',
    announcement: 'התוכן סומן לבדיקה.',
  },
  unflag: {
    action: 'unflag',
    label: 'ביטול סימון',
    heading: 'לבטל את הסימון לבדיקה?',
    body: 'הסימון יוסר. התוכן נשאר גלוי לתושבים כפי שהיה.',
    confirmLabel: 'בטלו את הסימון',
    announcement: 'הסימון לבדיקה בוטל.',
  },
};

const REASON_PLACEHOLDER =
  'למה הכרעתם כך? הנימוק נשמר ביומן ואי אפשר לערוך אותו אחר כך.';

/**
 * Network / unexpected-status fallback. The copy deck has no sentence for "the
 * request never reached the server", and a dialog that closes on a failure it
 * cannot describe would lose the typed reason silently. Phrased to match the
 * deck's own error voice.
 */
const ACTION_FAILED_HE = 'הפעולה לא הושלמה. נסו שוב; אם זה חוזר - פנו למנהל־על.';

export interface ProposalDetailPanelProps {
  proposal: ProposalDetail;
  /** Holds `content.moderate`. False ⇒ the four controls are absent (Rule A). */
  canModerate: boolean;
  spaceId: string;
  /** A content action succeeded; the caller re-reads the proposal. */
  onModerated: () => void;
  /** Id of the panel cell. The row's title button points `aria-controls` here. */
  panelId: string;
  columnCount: number;
  /**
   * Collapse the panel. Beyond the plan's prop list because the keyboard
   * contract - `Escape` collapses and returns focus to the title button - is
   * unimplementable without a way to tell the owner of `expandedKey`.
   */
  onCollapse: () => void;
}

export function ProposalDetailPanel({
  proposal,
  canModerate,
  spaceId,
  onModerated,
  panelId,
  columnCount,
  onCollapse,
}: ProposalDetailPanelProps) {
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const [bodyExpanded, setBodyExpanded] = useState(false);
  const [bodyOverflows, setBodyOverflows] = useState(false);
  const [pendingAction, setPendingAction] = useState<ContentAction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  // The expander only earns its place when the body actually clamps. Measured
  // rather than guessed at a character count, because the clamp is a line
  // count and line length depends on the viewport.
  useEffect(() => {
    const element = bodyRef.current;
    if (!element || bodyExpanded) return;
    setBodyOverflows(element.scrollHeight - element.clientHeight > 1);
  }, [proposal.body, bodyExpanded]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTableCellElement>) => {
      if (event.key !== 'Escape' || pendingAction !== null) return;
      event.stopPropagation();
      // Focus the trigger BEFORE collapsing: this subtree is about to unmount,
      // and focus left on a removed node falls back to <body>.
      document
        .querySelector<HTMLElement>(`[aria-controls="${panelId}"]`)
        ?.focus();
      onCollapse();
    },
    [onCollapse, panelId, pendingAction],
  );

  const control = pendingAction ? CONTENT_CONTROLS[pendingAction] : null;

  const submit = useCallback(
    async (reason: string) => {
      if (!control) return;
      setSubmitting(true);
      setDialogError(null);
      try {
        const response = await fetch(
          `/api/space-admin/${spaceId}/proposals/${proposal.id}/content`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: control.action, reason }),
          },
        );

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          // The dialog stays open with the typed reason intact, and renders
          // the server's own sentence rather than a second copy of it.
          setDialogError(payload?.error ?? ACTION_FAILED_HE);
          return;
        }

        setPendingAction(null);
        setAnnouncement(control.announcement);
        onModerated();
      } catch {
        setDialogError(ACTION_FAILED_HE);
      } finally {
        setSubmitting(false);
      }
    },
    [control, onModerated, proposal.id, spaceId],
  );

  const submittedAt = new Date(proposal.submittedAt).toLocaleString('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const hiddenSince = proposal.hiddenAt
    ? new Date(proposal.hiddenAt).toLocaleDateString('he-IL')
    : null;

  // Mutually exclusive pairs. A hidden item offers only the inverse.
  const controls: ContentControl[] = [
    proposal.hidden ? CONTENT_CONTROLS.unhide : CONTENT_CONTROLS.hide,
    proposal.flagged ? CONTENT_CONTROLS.unflag : CONTENT_CONTROLS.flag,
  ];

  return (
    <tr className={styles.row}>
      <td
        id={panelId}
        colSpan={columnCount}
        className={styles.cell}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.panel}>
          <h3 className={styles.title}>{proposal.title}</h3>

          {/* Submitter and submission time, and simultaneously the definition
              list that keeps the two columns dropped on narrow screens
              reachable. One list at every width rather than a mono line and a
              second copy of the same two values below the breakpoint. */}
          <dl className={styles.meta}>
            <dt>מגיש/ה</dt>
            <dd>{proposal.submitterDisplayName}</dd>
            <dt>הוגשה</dt>
            <dd>{submittedAt}</dd>
          </dl>

          {/* Hidden first when both apply. */}
          {proposal.hidden ? (
            <p className={styles.notice}>
              {`התוכן מוסתר מתושבי המרחב מאז ${hiddenSince ?? ''}. הנימוק נשמר ביומן.`}
            </p>
          ) : null}
          {proposal.flagged ? (
            <p className={styles.notice}>התוכן מסומן לבדיקה. הוא עדיין גלוי לתושבים.</p>
          ) : null}

          <div className={styles.bodyBlock}>
            <p
              ref={bodyRef}
              className={clsx(styles.body, !bodyExpanded && styles.bodyClamped)}
            >
              {proposal.body}
            </p>
            {/* Deliberately not the table's disclosure wording: this expander
                sits INSIDE the panel the title button opened, and two nested
                disclosures sharing an accessible name is a screen-reader
                defect. */}
            {bodyOverflows || bodyExpanded ? (
              <button
                type="button"
                className={styles.bodyToggle}
                aria-expanded={bodyExpanded}
                onClick={() => setBodyExpanded((open) => !open)}
              >
                {bodyExpanded ? 'הסתר' : 'הצג את הטקסט המלא'}
                <span aria-hidden>{bodyExpanded ? ' ▴' : ' ▾'}</span>
              </button>
            ) : null}
          </div>

          <hr className={styles.rule} />

          {/* Rule A: without the capability these are absent, not greyed out -
              and the panel above still renders, so the proposal is readable. */}
          {canModerate ? (
            <div className={styles.controls}>
              {controls.map((item) => (
                <NewsButton
                  key={item.action}
                  variant="outline"
                  size="sm"
                  className={styles.controlBtn}
                  onClick={() => {
                    setDialogError(null);
                    setPendingAction(item.action);
                  }}
                >
                  {item.label}
                </NewsButton>
              ))}
            </div>
          ) : null}

          <p className={styles.srOnly} aria-live="polite">
            {announcement}
          </p>

          {control ? (
            <ConfirmDialog
              kind="audited"
              open
              onOpenChange={(open) => {
                if (!open && !submitting) {
                  setPendingAction(null);
                  setDialogError(null);
                }
              }}
              heading={control.heading}
              body={control.body}
              confirmLabel={control.confirmLabel}
              placeholder={REASON_PLACEHOLDER}
              pending={submitting}
              pendingLabel="…שומר"
              error={dialogError}
              onConfirm={submit}
            />
          ) : null}
        </div>
      </td>
    </tr>
  );
}
