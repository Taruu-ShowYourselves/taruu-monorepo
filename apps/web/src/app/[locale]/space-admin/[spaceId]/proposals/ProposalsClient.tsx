'use client';

import React, { useCallback, useEffect, useId, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import type { Decision, ProposalDetail, ProposalSummary } from '@sync/shared/contracts';
import { NewsButton } from '@/components/press/NewsButton';
import {
  ClampedText,
  ConfirmDialog,
  EmptyPanel,
  ErrorPanel,
  PressTable,
  StatusChip,
  confirmButtonClass,
  rowFlashClass,
  ROW_FLASH_MS,
  type PressTableColumn,
} from '@/components/space-admin';
import { ProposalDetailPanel } from '@/components/space-admin/ProposalDetailPanel';
import { serverSentence } from '@/components/space-admin/serverSentence';
import {
  PROPOSAL_STATUS_LABELS_HE,
  proposalChipTone,
} from '@/components/space-admin/proposalStatusLabels';
import styles from './page.module.css';

/**
 * The interactive half of Surface 2.
 *
 * Three things about this file are load-bearing and easy to undo by accident:
 *
 * 1. A self-submitted row renders LOCK TEXT and no decision buttons. That is
 *    object-level authority, so Rule A governs and the controls are absent
 *    rather than present-but-inert — an inert one would wrongly imply the
 *    admin could unblock it themselves.
 * 2. The proposal title cell is the ONLY expansion trigger. There is no second
 *    toggle and no second accessible name for the same disclosure.
 * 3. Neither the conflict sentence nor the charge-decline sentence is typed
 *    here. Both are defined once on the server and arrive in the error body;
 *    re-typing either would create a second copy of a string that a screenshot
 *    review is the only thing likely to catch drifting.
 */

export type ProposalsFilter =
  | 'in_review'
  | 'draft'
  | 'changes_requested'
  | 'rejected'
  | 'active'
  | 'all';

export const PROPOSAL_FILTERS: readonly ProposalsFilter[] = [
  'in_review',
  'draft',
  'changes_requested',
  'rejected',
  'active',
  'all',
];

/** The queue opens on what needs a decision. */
export const DEFAULT_PROPOSAL_FILTER: ProposalsFilter = 'in_review';

/** The five chips of the copy deck. `all` is reachable but is not a chip. */
const FILTER_CHIPS: readonly { value: ProposalsFilter; label: string }[] = [
  { value: 'in_review', label: 'בבדיקה' },
  { value: 'draft', label: 'טיוטה' },
  { value: 'changes_requested', label: 'הוחזרו לתיקון' },
  { value: 'rejected', label: 'נדחו' },
  { value: 'active', label: 'אושרו' },
];

interface DecisionCopy {
  kind: 'audited' | 'irreversible';
  heading: string;
  body: string;
  consequence?: string;
  confirmLabel: string;
  announcement: string;
}

/**
 * Approve and reject are `irreversible`; returning for changes is `audited`,
 * because the submitter can resubmit.
 *
 * The approve body says the fee is CREATED at approval. The port records a
 * pending obligation and moves no money today, so the stronger verb would
 * promise something the code does not do — and the weaker one stays true after
 * the card-on-file rail ships, so the sentence never needs revisiting.
 */
const DECISION_COPY: Record<Decision, DecisionCopy> = {
  approve: {
    kind: 'irreversible',
    heading: 'לאשר ולפרסם את ההצעה?',
    body: 'ההצעה תתפרסם לתושבי המרחב ותיפתח להצבעה. עם האישור ייווצר חיוב של ₪50 למגיש/ה — החיוב נוצר רק עכשיו, ולא בעת ההגשה.',
    consequence: 'הפרסום והחיוב אינם ניתנים לביטול מהלוח הזה.',
    confirmLabel: 'אשרו ופרסמו',
    announcement: 'ההצעה אושרה ופורסמה. הפעולה נרשמה ביומן.',
  },
  request_changes: {
    kind: 'audited',
    heading: 'להחזיר את ההצעה לתיקון?',
    body: 'ההצעה תחזור למגיש עם הנימוק שלכם ולא תתפרסם עד שתוגש מחדש.',
    confirmLabel: 'החזירו לתיקון',
    announcement: 'ההצעה הוחזרה לתיקון. הפעולה נרשמה ביומן.',
  },
  reject: {
    kind: 'irreversible',
    heading: 'לדחות את ההצעה?',
    body: 'ההצעה לא תתפרסם.',
    consequence: 'הדחייה והנימוק נרשמים ביומן לצמיתות. אי אפשר לבטל.',
    confirmLabel: 'דחו את ההצעה',
    announcement: 'ההצעה נדחתה. הפעולה נרשמה ביומן.',
  },
};

const REASON_PLACEHOLDER =
  'למה הכרעתם כך? הנימוק נשמר ביומן ואי אפשר לערוך אותו אחר כך.';

/**
 * Network / unexpected-status fallback, phrased in the deck's error voice. The
 * deck has no sentence for "the request never reached the server", and a
 * dialog that closes on a failure it cannot describe loses the typed reason.
 */
const ACTION_FAILED_HE = 'הפעולה לא הושלמה. נסו שוב; אם זה חוזר — פנו למנהל־על.';

const toSummary = (detail: ProposalDetail): ProposalSummary => ({
  id: detail.id,
  title: detail.title,
  status: detail.status,
  submitterId: detail.submitterId,
  submitterDisplayName: detail.submitterDisplayName,
  submittedAt: detail.submittedAt,
  hidden: detail.hidden,
  flagged: detail.flagged,
  selfSubmitted: detail.selfSubmitted,
});

/**
 * A deep-linked proposal must always have a row to expand under. Approved
 * proposals whose start date has not arrived sit in a status no filter chip
 * selects, so the merged "show all" read can legitimately not contain the
 * subject of an audit-log link. Seeding it keeps `?proposal={id}` from opening
 * a panel with nothing above it.
 */
function withDeepLinked(
  proposals: readonly ProposalSummary[],
  detail: ProposalDetail | null,
): ProposalSummary[] {
  if (!detail || proposals.some((row) => row.id === detail.id)) return [...proposals];
  return [toSummary(detail), ...proposals];
}

// ---------------------------------------------------------------------------
// The review queue
// ---------------------------------------------------------------------------

export interface ProposalsClientProps {
  spaceId: string;
  spaceName: string;
  status: ProposalsFilter;
  proposals: readonly ProposalSummary[];
  /** Holds `proposal.approve`. */
  canApprove: boolean;
  /** Holds `proposal.reject` — which also governs returning for changes. */
  canReject: boolean;
  /** Holds `content.moderate`. */
  canModerate: boolean;
  /** Resolved server-side from `?proposal={id}`. */
  initialDetail: ProposalDetail | null;
  /** `?proposal={id}` did not resolve inside this space. */
  deepLinkMissing: boolean;
}

export function ProposalsClient({
  spaceId,
  spaceName,
  status,
  proposals,
  canApprove,
  canReject,
  canModerate,
  initialDetail,
  deepLinkMissing,
}: ProposalsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const panelBase = useId();
  const [isPending, startTransition] = useTransition();

  const [rows, setRows] = useState<ProposalSummary[]>(() =>
    withDeepLinked(proposals, initialDetail),
  );
  const [expandedId, setExpandedId] = useState<string | null>(initialDetail?.id ?? null);
  const [detail, setDetail] = useState<ProposalDetail | null>(initialDetail);
  const [detailFailed, setDetailFailed] = useState(false);
  /** Bumped to re-run the detail read after a failure the admin retried. */
  const [detailAttempt, setDetailAttempt] = useState(0);

  const [decisionFor, setDecisionFor] = useState<{ id: string; decision: Decision } | null>(
    null,
  );
  const [decisionPending, setDecisionPending] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ message?: string } | null>(null);

  const [flashId, setFlashId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const panelIdFor = useCallback(
    (proposalId: string) => `${panelBase}-${proposalId}`,
    [panelBase],
  );

  // A new server render replaces the queue wholesale.
  useEffect(() => {
    setRows(withDeepLinked(proposals, initialDetail));
  }, [proposals, initialDetail]);

  // Announce the end of a filter transition, per the skeleton→loaded contract.
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !isPending) {
      setAnnouncement(`הטעינה הושלמה. מוצגות ${rows.length} רשומות.`);
    }
    wasPending.current = isPending;
  }, [isPending, rows.length]);

  // The row carries a summary; the panel needs the body. One read per expand,
  // and again after a content action, which clears `detail` to force it.
  useEffect(() => {
    if (!expandedId || detail?.id === expandedId) return;
    let cancelled = false;
    setDetailFailed(false);

    fetch(`/api/space-admin/${spaceId}/proposals/${expandedId}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error())))
      .then((loaded: ProposalDetail) => {
        if (cancelled) return;
        setDetail(loaded);
        setRows((current) =>
          current.map((row) => (row.id === loaded.id ? toSummary(loaded) : row)),
        );
      })
      .catch(() => {
        if (!cancelled) setDetailFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [detail?.id, detailAttempt, expandedId, spaceId]);

  // Deep link: bring the opened panel into view once.
  const scrolled = useRef(false);
  useEffect(() => {
    if (scrolled.current || !initialDetail) return;
    scrolled.current = true;
    document.getElementById(panelIdFor(initialDetail.id))?.scrollIntoView({ block: 'center' });
  }, [initialDetail, panelIdFor]);

  useEffect(() => {
    if (!flashId) return;
    const timer = window.setTimeout(() => setFlashId(null), ROW_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [flashId]);

  const navigate = useCallback(
    (next: ProposalsFilter) => {
      const search = next === DEFAULT_PROPOSAL_FILTER ? '' : `?status=${next}`;
      startTransition(() => router.push(`${pathname}${search}`));
    },
    [pathname, router],
  );

  const toggleExpanded = useCallback((proposalId: string) => {
    // One panel at a time, so two reason fields are never open together.
    setExpandedId((current) => (current === proposalId ? null : proposalId));
  }, []);

  const collapse = useCallback(() => setExpandedId(null), []);

  const submitDecision = useCallback(
    async (reason: string) => {
      if (!decisionFor) return;
      const copy = DECISION_COPY[decisionFor.decision];
      setDecisionPending(true);
      setDecisionError(null);

      try {
        const response = await fetch(
          `/api/space-admin/${spaceId}/proposals/${decisionFor.id}/decide`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ decision: decisionFor.decision, reason }),
          },
        );
        const payload = (await response.json().catch(() => null)) as
          | (Partial<ProposalDetail> & { error?: string })
          | null;

        if (response.ok && payload?.id) {
          const updated = payload as ProposalDetail;
          setRows((current) =>
            current.map((row) => (row.id === updated.id ? toSummary(updated) : row)),
          );
          setDetail((current) => (current?.id === updated.id ? updated : current));
          setFlashId(updated.id);
          setAnnouncement(copy.announcement);
          setDecisionFor(null);
          return;
        }

        if (response.status === 409) {
          // The sentence is the server's own conflict constant, arriving on
          // the wire. It is rendered, never re-typed.
          setConflict({ message: payload?.error });
          setDecisionFor(null);
          return;
        }

        // 402 is the declined creation fee; 403 is a refused self-review. In
        // both the dialog stays open with the reason intact and shows the
        // server's sentence. `serverSentence` is what decides "has a sentence":
        // an unreasoned 403 answers the English literal `Forbidden`, and
        // printing that into a Hebrew dialog reads as a crash, not an answer.
        setDecisionError(serverSentence(payload) ?? ACTION_FAILED_HE);
      } catch {
        setDecisionError(ACTION_FAILED_HE);
      } finally {
        setDecisionPending(false);
      }
    },
    [decisionFor, spaceId],
  );

  const openDecision = useCallback((proposalId: string, decision: Decision) => {
    setDecisionError(null);
    setDecisionFor({ id: proposalId, decision });
  }, []);

  const renderActions = useCallback(
    (row: ProposalSummary) => {
      if (row.selfSubmitted) {
        return <p className={styles.lock}>הצעה שהגשתם — ההכרעה שמורה למנהל אחר.</p>;
      }
      // Only a proposal actually under review is decidable. On a decided row
      // the actions are absent for the same reason they are absent on a
      // self-submitted one: the admin cannot take them.
      if (row.status !== 'in_review') return null;

      return (
        <div className={styles.rowActions}>
          {canApprove ? (
            <NewsButton
              variant="ink"
              className={clsx(styles.rowBtn, confirmButtonClass)}
              onClick={() => openDecision(row.id, 'approve')}
            >
              אישור ופרסום
            </NewsButton>
          ) : null}
          {canReject ? (
            <>
              <NewsButton
                variant="outline"
                className={styles.rowBtn}
                onClick={() => openDecision(row.id, 'request_changes')}
              >
                החזרה לתיקון
              </NewsButton>
              <NewsButton
                variant="outline"
                className={styles.rowBtn}
                onClick={() => openDecision(row.id, 'reject')}
              >
                דחייה
              </NewsButton>
            </>
          ) : null}
        </div>
      );
    },
    [canApprove, canReject, openDecision],
  );

  const columns: readonly PressTableColumn<ProposalSummary>[] = [
    {
      key: 'title',
      header: 'הצעה',
      primary: true,
      cell: (row) => {
        const expanded = expandedId === row.id;
        return (
          <button
            type="button"
            className={styles.titleTrigger}
            aria-expanded={expanded}
            aria-controls={expanded ? panelIdFor(row.id) : undefined}
            onClick={() => toggleExpanded(row.id)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && expanded) collapse();
            }}
          >
            <ClampedText lines={2}>{row.title}</ClampedText>
          </button>
        );
      },
    },
    {
      key: 'submitter',
      header: 'מגיש/ה',
      secondary: true,
      cell: (row) => <ClampedText lines={1}>{row.submitterDisplayName}</ClampedText>,
    },
    {
      key: 'submitted',
      header: 'הוגשה',
      secondary: true,
      cell: (row) => (
        <span className={styles.mono}>
          {new Date(row.submittedAt).toLocaleDateString('he-IL')}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'סטטוס',
      cell: (row) => (
        <StatusChip tone={proposalChipTone(row.status)}>
          {PROPOSAL_STATUS_LABELS_HE[row.status]}
        </StatusChip>
      ),
    },
    {
      key: 'actions',
      header: 'פעולות',
      omitFromDetails: true,
      cell: renderActions,
    },
  ];

  const decisionCopy = decisionFor ? DECISION_COPY[decisionFor.decision] : null;
  const dialogBase = decisionCopy
    ? {
        open: true,
        onOpenChange: (next: boolean) => {
          if (!next && !decisionPending) {
            setDecisionFor(null);
            setDecisionError(null);
          }
        },
        heading: decisionCopy.heading,
        body: decisionCopy.body,
        confirmLabel: decisionCopy.confirmLabel,
        placeholder: REASON_PLACEHOLDER,
        pending: decisionPending,
        pendingLabel: '…שומר',
        error: decisionError,
        onConfirm: submitDecision,
      }
    : null;

  const empty =
    status === DEFAULT_PROPOSAL_FILTER ? (
      <EmptyPanel
        heading="אין הצעות בבדיקה"
        body="כשתושב יגיש הצעה חדשה במרחב הזה, היא תופיע כאן להכרעה."
      />
    ) : (
      <EmptyPanel
        heading="אין הצעות בסטטוס הזה"
        body="נסו סינון אחר."
        action={
          <NewsButton variant="outline" onClick={() => navigate('all')}>
            הצגת הכול
          </NewsButton>
        }
      />
    );

  return (
    <div className={styles.queue}>
      <div className={styles.filters} role="group" aria-label="סינון לפי סטטוס">
        {FILTER_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            className={clsx(styles.chip, status === chip.value && styles.chipActive)}
            aria-pressed={status === chip.value}
            onClick={() => navigate(chip.value)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {deepLinkMissing ? <ErrorPanel body="ההצעה לא נמצאה במרחב הזה." /> : null}

      {conflict ? (
        <ErrorPanel
          body={conflict.message}
          retryLabel="רענון הרשימה"
          onRetry={() => {
            setConflict(null);
            startTransition(() => router.refresh());
          }}
        />
      ) : null}

      <p className={styles.srOnly} aria-live="polite">
        {announcement}
      </p>

      {!isPending && rows.length === 0 ? (
        empty
      ) : (
        <PressTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={isPending}
          description={`הצעות במרחב ${spaceName}, ממוינות לפי מועד הגשה. כל שורה כוללת את שם ההצעה, המגיש/ה, מועד ההגשה, הסטטוס והפעולות הזמינות לכם.`}
          expandedKey={expandedId}
          onExpandedKeyChange={setExpandedId}
          rowClassName={(row) => (row.id === flashId ? rowFlashClass : undefined)}
          renderExpansionRow={(row, columnCount) => {
            if (detail?.id === row.id) {
              return (
                <ProposalDetailPanel
                  proposal={detail}
                  canModerate={canModerate}
                  spaceId={spaceId}
                  panelId={panelIdFor(row.id)}
                  columnCount={columnCount}
                  onCollapse={collapse}
                  onModerated={() => setDetail(null)}
                />
              );
            }
            return (
              <tr className={styles.detailPending}>
                <td id={panelIdFor(row.id)} colSpan={columnCount}>
                  {detailFailed ? (
                    <ErrorPanel onRetry={() => setDetailAttempt((n) => n + 1)} />
                  ) : (
                    <p className={styles.mono}>…טוען</p>
                  )}
                </td>
              </tr>
            );
          }}
        />
      )}

      {dialogBase && decisionCopy ? (
        decisionCopy.kind === 'irreversible' ? (
          <ConfirmDialog
            {...dialogBase}
            kind="irreversible"
            consequence={decisionCopy.consequence ?? ''}
          />
        ) : (
          <ConfirmDialog {...dialogBase} kind="audited" />
        )
      ) : null}
    </div>
  );
}
