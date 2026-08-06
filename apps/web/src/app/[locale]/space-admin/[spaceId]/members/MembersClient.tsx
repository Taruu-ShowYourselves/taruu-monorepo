'use client';

/**
 * The interactive half of Surface 3.
 *
 * Everything this island renders comes from `SpaceMember`, which is the
 * privacy allow-list itself: a display name, a join date, a membership state
 * and the capabilities granted in this space. Nothing derived from an identity
 * document reaches it, and nothing may be added here that the contract does
 * not already name — widening what is shown is a privacy decision made in the
 * contract, not a convenience taken in a cell renderer.
 *
 * Two absences are load-bearing:
 *
 *   1. A capability control the admin does not hold is NOT RENDERED. Never
 *      disabled, never greyed (Interaction Contract 1, Rule A).
 *   2. A suspended member offers reinstatement and nothing else. Changing the
 *      capabilities of someone who cannot act is meaningless and would write
 *      audit rows nobody can interpret later.
 *
 * Suspension itself is a reversible act — it sets a nullable column and
 * reinstatement clears it — so its confirmation is `audited`. The plate
 * reserved for acts the admin cannot undo from this dashboard belongs to
 * approve, reject and send, and this surface has none of those.
 */

import React, { useCallback, useEffect, useId, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { SpaceMember } from '@sync/shared/contracts';
import { NewsButton } from '@/components/press/NewsButton';
import { PressInput } from '@/components/press/PressInput/PressInput';
import { PressSelect } from '@/components/press/PressSelect/PressSelect';
import {
  ClampedText,
  ConfirmDialog,
  EmptyPanel,
  ErrorPanel,
  PressTable,
  StatusChip,
  rowFlashClass,
  ROW_FLASH_MS,
  type PressTableColumn,
} from '@/components/space-admin';
import { EscalationDialog } from '@/components/space-admin/EscalationDialog';
import { serverSentence } from '@/components/space-admin/serverSentence';
import {
  CAPABILITIES,
  CAPABILITY_LABELS_HE,
  ROLE_PRESETS,
  ROLE_PRESET_LABELS_HE,
  expandPreset,
  type Capability,
  type RolePreset,
} from '@/server/domain/space/capability';
import type { Locale } from '@/lib/i18n';
import styles from './page.module.css';

// ---------------------------------------------------------------------------
// Surface state
// ---------------------------------------------------------------------------

/**
 * `spaceName` rides on the `ok` branch alone, because it is used only by the
 * table caption and the caption only exists when there is a table. A denial
 * carries no space identity at all.
 */
export type MembersSurfaceState =
  | {
      kind: 'ok';
      spaceName: string;
      members: readonly SpaceMember[];
      total: number;
    }
  | { kind: 'denied' }
  | { kind: 'failed' };

export interface MembersClientProps {
  spaceId: string;
  /** The search term already applied by the server. Mirrors `?search=`. */
  search: string;
  canGrant: boolean;
  canRevoke: boolean;
  canSuspend: boolean;
  state: MembersSurfaceState;
  locale?: Locale;
}

// ---------------------------------------------------------------------------
// Confirmations
// ---------------------------------------------------------------------------

type PendingAction =
  | { kind: 'grant'; member: SpaceMember; capability: Capability; viaRole?: RolePreset }
  | { kind: 'revoke'; member: SpaceMember; capability: Capability }
  | { kind: 'suspend'; member: SpaceMember }
  | { kind: 'reinstate'; member: SpaceMember };

interface DialogCopy {
  heading: string;
  body: string;
  consequence?: string;
  confirmLabel: string;
  announcement: string;
  placeholder?: string;
}

interface MembersDialogDeck {
  grant: {
    heading: string;
    body: (name: string, capability: string) => string;
    confirmLabel: string;
    announcement: (name: string) => string;
  };
  revoke: {
    heading: string;
    body: (name: string, capability: string) => string;
    consequence: string;
    confirmLabel: string;
    announcement: (name: string) => string;
  };
  suspend: {
    heading: (name: string) => string;
    body: string;
    consequence: string;
    confirmLabel: string;
    announcement: (name: string) => string;
  };
  reinstate: {
    heading: (name: string) => string;
    body: string;
    confirmLabel: string;
    announcement: (name: string) => string;
  };
}

interface MembersCopy {
  reasonPlaceholder: string;
  /**
   * The FALLBACK when the failure carries no sentence of its own — a network
   * error, or a status whose body is structural English. No string in the copy
   * deck covers it (the deck's error sentence is about a failed *load*), so
   * this one is written in its voice: what did not happen, and where to go if
   * it repeats.
   *
   * A 409 does carry a sentence, and it is rendered instead of this one. Those
   * sentences are the repository's own — `החבר/ה כבר מושעה/ית במרחב הזה.`,
   * `ההרשאה כבר אינה פעילה.` — and this line would contradict them: they mean
   * the state already exists, while this one says nothing happened and nothing
   * was recorded. See `serverSentence` for which codes qualify.
   */
  actionFailed: string;
  pendingLabel: string;
  capabilityLabels: Record<Capability, string>;
  roleLabels: Record<RolePreset, string>;
  dialog: MembersDialogDeck;
  columnMember: string;
  columnJoined: string;
  columnCapabilities: string;
  columnStatus: string;
  columnActions: string;
  hideDetails: string;
  showDetails: string;
  chipSuspended: string;
  chipActive: string;
  actionReinstate: string;
  actionManage: string;
  actionSuspend: string;
  detailJoined: string;
  detailCapabilities: string;
  detailNoCapabilities: string;
  detailMemberId: string;
  searchLabel: string;
  searchPlaceholder: string;
  emptyHeading: string;
  emptyBody: string;
  noMatchHeading: string;
  noMatchBody: string;
  clearSearch: string;
  tableDescription: (spaceName: string) => string;
  totalMembers: (total: number) => string;
  editorHeading: (name: string) => string;
  roleLabel: string;
  rolePlaceholder: string;
  presetNote: string;
  granted: string;
  notGranted: string;
  revokeCapability: string;
  grantCapability: string;
  close: string;
}

const COPY: Record<Locale, MembersCopy> = {
  he: {
    reasonPlaceholder:
      'למה הכרעתם כך? הנימוק נשמר ביומן ואי אפשר לערוך אותו אחר כך.',
    actionFailed:
      'הפעולה לא בוצעה ולא נרשמה ביומן. נסו שוב; אם זה חוזר — פנו למנהל־על.',
    pendingLabel: '…שומר',
    capabilityLabels: CAPABILITY_LABELS_HE,
    roleLabels: ROLE_PRESET_LABELS_HE,
    dialog: {
      grant: {
        heading: 'להעניק את ההרשאה?',
        body: (name, capability) =>
          `${name} יוכל/תוכל מעכשיו: ${capability} — במרחב הזה בלבד.`,
        confirmLabel: 'העניקו הרשאה',
        announcement: (name) => `ההרשאה הוענקה ל־${name}.`,
      },
      revoke: {
        heading: 'לשלול את ההרשאה?',
        body: (name, capability) => `${name} יאבד/תאבד מיד את היכולת: ${capability}.`,
        consequence: 'הפעולה נכנסת לתוקף מיד ונרשמת ביומן לצמיתות.',
        confirmLabel: 'שללו הרשאה',
        announcement: (name) => `ההרשאה נשללה מ־${name}.`,
      },
      suspend: {
        heading: (name) => `להשעות את ${name} במרחב?`,
        body: 'הגישה למרחב הזה נחסמת מיד. אפשר לבטל את ההשעיה בהמשך.',
        consequence: 'ההיסטוריה, ההחלטות והתיעוד נשמרים במלואם ואינם נמחקים.',
        confirmLabel: 'השעו במרחב',
        announcement: (name) => `${name} הושעה/תה במרחב. ההיסטוריה נשמרה.`,
      },
      reinstate: {
        heading: (name) => `לבטל את ההשעיה של ${name}?`,
        // Literally true, and deliberately narrow: reinstatement restores the
        // grants the suspension itself took, matched on the suspension's own
        // timestamp. A capability revoked before the suspension stays revoked.
        body: 'הגישה למרחב הזה תחזור מיד, עם אותן הרשאות שהיו לפני ההשעיה.',
        confirmLabel: 'בטלו השעיה',
        announcement: (name) => `ההשעיה של ${name} בוטלה.`,
      },
    },
    columnMember: 'חבר/ה',
    columnJoined: 'הצטרפ/ה',
    columnCapabilities: 'הרשאות',
    columnStatus: 'סטטוס',
    columnActions: 'פעולות',
    hideDetails: 'הסתר',
    showDetails: 'הצג פרטים',
    chipSuspended: 'מושעה/ית',
    chipActive: 'פעיל/ה',
    actionReinstate: 'ביטול השעיה',
    actionManage: 'ניהול הרשאות',
    actionSuspend: 'השעיה במרחב',
    detailJoined: 'הצטרפ/ה',
    detailCapabilities: 'הרשאות',
    detailNoCapabilities: 'אין הרשאות במרחב הזה',
    detailMemberId: 'מזהה חבר/ה',
    searchLabel: 'חיפוש חבר/ה',
    searchPlaceholder: '…שם או מזהה',
    emptyHeading: 'אין עדיין חברים במרחב',
    emptyBody: 'כשתושבים יצטרפו למרחב הזה, הם יופיעו כאן.',
    noMatchHeading: 'לא נמצאו חברים תואמים',
    noMatchBody: 'נסו שם אחר, או נקו את החיפוש.',
    clearSearch: 'ניקוי חיפוש',
    tableDescription: (spaceName) =>
      `חברי המרחב ${spaceName} וההרשאות שלהם. כל שורה כוללת שם, מועד הצטרפות, מצב חברות והרשאות שהוענקו.`,
    totalMembers: (total) => `${total} חברים במרחב`,
    editorHeading: (name) => `ניהול הרשאות — ${name}`,
    roleLabel: 'תפקיד',
    rolePlaceholder: '…בחרו תפקיד',
    presetNote: 'התפקיד כולל את ההרשאות הבאות. כל הרשאה מוענקת בנפרד ובאישור נפרד.',
    granted: 'מוענק',
    notGranted: 'לא מוענק',
    revokeCapability: 'שלילת הרשאה',
    grantCapability: 'הענקת הרשאה',
    close: 'סגירה',
  },
  en: {
    reasonPlaceholder:
      'Why did you decide this way? The reason is recorded in the log and cannot be edited later.',
    actionFailed:
      'The action was not carried out and nothing was recorded in the log. Try again; if it recurs — contact a super-admin.',
    pendingLabel: 'Saving…',
    capabilityLabels: {
      'proposal.read': 'Review proposals',
      'proposal.approve': 'Approve and publish proposals',
      'proposal.reject': 'Reject proposals',
      'member.read': 'View the member list',
      'member.suspend': 'Suspend members in the space',
      'grant.create': 'Grant permissions',
      'grant.revoke': 'Revoke permissions',
      'content.moderate': 'Moderate content',
      'metrics.read': 'View aggregate metrics',
      'notification.send': 'Send notifications to residents',
      'audit.read': 'View the audit log',
    },
    roleLabels: {
      space_admin: 'Space admin',
      space_reviewer: 'Proposal reviewer',
      space_moderator: 'Content moderator',
      space_communicator: 'Notifications officer',
      space_observer: 'Observer',
    },
    dialog: {
      grant: {
        heading: 'Grant this permission?',
        body: (name, capability) =>
          `${name} will now be able to: ${capability} — in this space only.`,
        confirmLabel: 'Grant permission',
        announcement: (name) => `The permission was granted to ${name}.`,
      },
      revoke: {
        heading: 'Revoke this permission?',
        body: (name, capability) =>
          `${name} will immediately lose the ability to: ${capability}.`,
        consequence:
          'The action takes effect immediately and is permanently recorded in the log.',
        confirmLabel: 'Revoke permission',
        announcement: (name) => `The permission was revoked from ${name}.`,
      },
      suspend: {
        heading: (name) => `Suspend ${name} in this space?`,
        body: 'Access to this space is blocked immediately. The suspension can be lifted later.',
        consequence:
          'History, decisions and records are retained in full and are not deleted.',
        confirmLabel: 'Suspend in space',
        announcement: (name) =>
          `${name} was suspended in this space. Their history was retained.`,
      },
      reinstate: {
        heading: (name) => `Lift the suspension of ${name}?`,
        body: 'Access to this space is restored immediately, with the same permissions held before the suspension.',
        confirmLabel: 'Lift suspension',
        announcement: (name) => `The suspension of ${name} was lifted.`,
      },
    },
    columnMember: 'Member',
    columnJoined: 'Joined',
    columnCapabilities: 'Permissions',
    columnStatus: 'Status',
    columnActions: 'Actions',
    hideDetails: 'Hide',
    showDetails: 'Show details',
    chipSuspended: 'Suspended',
    chipActive: 'Active',
    actionReinstate: 'Lift suspension',
    actionManage: 'Manage permissions',
    actionSuspend: 'Suspend in space',
    detailJoined: 'Joined',
    detailCapabilities: 'Permissions',
    detailNoCapabilities: 'No permissions in this space',
    detailMemberId: 'Member ID',
    searchLabel: 'Member search',
    searchPlaceholder: 'Name or ID…',
    emptyHeading: 'No members in this space yet',
    emptyBody: 'When residents join this space, they will appear here.',
    noMatchHeading: 'No matching members found',
    noMatchBody: 'Try another name, or clear the search.',
    clearSearch: 'Clear search',
    tableDescription: (spaceName) =>
      `Members of the ${spaceName} space and their permissions. Each row includes a name, join date, membership status and the permissions granted.`,
    totalMembers: (total) => `${total} members in this space`,
    editorHeading: (name) => `Manage permissions — ${name}`,
    roleLabel: 'Role',
    rolePlaceholder: 'Choose a role…',
    presetNote:
      'This role includes the following permissions. Each permission is granted separately, with its own confirmation.',
    granted: 'Granted',
    notGranted: 'Not granted',
    revokeCapability: 'Revoke permission',
    grantCapability: 'Grant permission',
    close: 'Close',
  },
};

const dialogCopy = (action: PendingAction, t: MembersCopy): DialogCopy => {
  const name = action.member.displayName;
  switch (action.kind) {
    case 'grant':
      return {
        heading: t.dialog.grant.heading,
        body: t.dialog.grant.body(name, t.capabilityLabels[action.capability]),
        confirmLabel: t.dialog.grant.confirmLabel,
        announcement: t.dialog.grant.announcement(name),
        placeholder: t.reasonPlaceholder,
      };
    case 'revoke':
      return {
        heading: t.dialog.revoke.heading,
        body: t.dialog.revoke.body(name, t.capabilityLabels[action.capability]),
        consequence: t.dialog.revoke.consequence,
        confirmLabel: t.dialog.revoke.confirmLabel,
        announcement: t.dialog.revoke.announcement(name),
        placeholder: t.reasonPlaceholder,
      };
    case 'suspend':
      return {
        heading: t.dialog.suspend.heading(name),
        body: t.dialog.suspend.body,
        consequence: t.dialog.suspend.consequence,
        confirmLabel: t.dialog.suspend.confirmLabel,
        announcement: t.dialog.suspend.announcement(name),
        placeholder: t.reasonPlaceholder,
      };
    case 'reinstate':
      return {
        heading: t.dialog.reinstate.heading(name),
        body: t.dialog.reinstate.body,
        confirmLabel: t.dialog.reinstate.confirmLabel,
        announcement: t.dialog.reinstate.announcement(name),
        placeholder: t.reasonPlaceholder,
      };
  }
};

interface Request {
  path: string;
  method: 'POST' | 'DELETE';
  body: Record<string, unknown>;
}

const toRequest = (spaceId: string, action: PendingAction, reason: string): Request => {
  const base = `/api/space-admin/${spaceId}`;
  switch (action.kind) {
    case 'grant':
      return {
        path: `${base}/grants`,
        method: 'POST',
        body: {
          userId: action.member.id,
          capability: action.capability,
          grantedViaRole: action.viaRole,
          reason,
        },
      };
    case 'revoke':
      return {
        path: `${base}/grants`,
        method: 'DELETE',
        body: { userId: action.member.id, capability: action.capability, reason },
      };
    case 'suspend':
      return {
        path: `${base}/members/suspension`,
        method: 'POST',
        body: { userId: action.member.id, reason },
      };
    case 'reinstate':
      return {
        path: `${base}/members/suspension`,
        method: 'DELETE',
        body: { userId: action.member.id, reason },
      };
  }
};

// ---------------------------------------------------------------------------
// Surface
// ---------------------------------------------------------------------------

const SEARCH_DEBOUNCE_MS = 300;

const PRESET_VALUES = Object.keys(ROLE_PRESETS) as RolePreset[];

export function MembersClient({
  spaceId,
  search,
  canGrant,
  canRevoke,
  canSuspend,
  state,
  locale = 'he',
}: MembersClientProps) {
  const t = COPY[locale];
  const router = useRouter();
  const pathname = usePathname();
  const detailsIdBase = useId();
  const editorId = useId();

  const presetOptions = PRESET_VALUES.map((preset) => ({
    value: preset,
    label: t.roleLabels[preset],
  }));

  const [term, setTerm] = useState(search);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editorFor, setEditorFor] = useState<string | null>(null);
  const [preset, setPreset] = useState<RolePreset | ''>('');
  const [action, setAction] = useState<PendingAction | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // The affected row settles out of a paper-2 flash after a decision. Both the
  // class and the duration come from `PressTable`, so the timer that clears
  // the class and the animation that plays under it cannot drift; the
  // reduced-motion opt-out ships with the class rather than living here, so it
  // can be applied unconditionally.
  useEffect(() => {
    if (flashKey === null) return;
    const timer = setTimeout(() => setFlashKey(null), ROW_FLASH_MS);
    return () => clearTimeout(timer);
  }, [flashKey]);

  // Search lives in the query string, so a filtered view stays linkable and
  // back-button-correct. Debounced, because the server re-reads on every push.
  useEffect(() => {
    if (term.trim() === search) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (term.trim()) params.set('search', term.trim());
      const query = params.toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term, search, pathname, router]);

  const closeDialog = useCallback(() => {
    if (submitting) return;
    setAction(null);
    setFailure(null);
  }, [submitting]);

  const runAction = useCallback(
    async (pending: PendingAction, reason: string) => {
      setSubmitting(true);
      setFailure(null);
      try {
        const request = toRequest(spaceId, pending, reason);
        const response = await fetch(request.path, {
          method: request.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request.body),
        });
        if (!response.ok) {
          // The dialog stays open with the reason intact and shows the
          // server's own sentence where it has one — a 409 here means the
          // state already exists, which the generic line would deny.
          const payload: unknown = await response.json().catch(() => null);
          setFailure(serverSentence(payload) ?? t.actionFailed);
          return;
        }
        setAction(null);
        setAnnouncement(dialogCopy(pending, t).announcement);
        setFlashKey(pending.member.id);
        startTransition(() => router.refresh());
      } catch {
        setFailure(t.actionFailed);
      } finally {
        setSubmitting(false);
      }
    },
    [router, spaceId, t]
  );

  const activeCopy = action ? dialogCopy(action, t) : null;

  const dialog =
    action && activeCopy ? (
      <ConfirmDialog
        kind="audited"
        open
        onOpenChange={(next) => {
          if (!next) closeDialog();
        }}
        heading={activeCopy.heading}
        body={activeCopy.body}
        consequence={activeCopy.consequence}
        confirmLabel={activeCopy.confirmLabel}
        placeholder={activeCopy.placeholder}
        pending={submitting}
        pendingLabel={t.pendingLabel}
        error={failure}
        onConfirm={(reason) => {
          void runAction(action, reason);
        }}
      />
    ) : null;

  const live = (
    <p aria-live="polite" className={styles.srOnly}>
      {announcement}
    </p>
  );

  // The refused surface is `EscalationDialog`'s own `no-permission` shape: it
  // renders `NoPermissionPanel` and owns the escalation path behind its CTA.
  // The decision dialog above is not reachable here — none of its four actions
  // has a trigger on a page with no table.
  if (state.kind === 'denied') {
    return <EscalationDialog spaceId={spaceId} trigger="no-permission" />;
  }

  if (state.kind === 'failed') {
    return (
      <>
        {live}
        <ErrorPanel onRetry={() => startTransition(() => router.refresh())} />
        {dialog}
      </>
    );
  }

  const { members, total, spaceName } = state;
  const editorMember = members.find((member) => member.id === editorFor) ?? null;

  const openEditor = (member: SpaceMember) => {
    setPreset('');
    setEditorFor((current) => (current === member.id ? null : member.id));
  };

  const columns: readonly PressTableColumn<SpaceMember>[] = [
    {
      key: 'member',
      header: t.columnMember,
      primary: true,
      cell: (member) => {
        const isExpanded = expanded === member.id;
        return (
          <div className={styles.memberCell}>
            <ClampedText lines={1} title={member.displayName}>
              {member.displayName}
            </ClampedText>
            <button
              type="button"
              className={styles.disclosure}
              aria-expanded={isExpanded}
              aria-controls={
                isExpanded ? `${detailsIdBase}-${member.id}` : undefined
              }
              onClick={() => setExpanded(isExpanded ? null : member.id)}
            >
              {isExpanded ? t.hideDetails : t.showDetails}
              <span aria-hidden>{isExpanded ? ' ▴' : ' ▾'}</span>
            </button>
          </div>
        );
      },
    },
    {
      key: 'joined',
      header: t.columnJoined,
      secondary: true,
      cell: (member) => (
        <span className={styles.mono}>
          {new Date(member.joinedAt).toLocaleDateString('he-IL')}
        </span>
      ),
    },
    {
      key: 'capabilities',
      header: t.columnCapabilities,
      secondary: true,
      // A count, never a raw capability identifier. The localized labels live
      // in the row disclosure and in the management panel.
      cell: (member) => (
        <span className={styles.mono}>{member.capabilities.length}</span>
      ),
    },
    {
      key: 'status',
      header: t.columnStatus,
      cell: (member) =>
        member.suspended ? (
          <StatusChip tone="suspended">{t.chipSuspended}</StatusChip>
        ) : (
          <StatusChip>{t.chipActive}</StatusChip>
        ),
    },
    {
      key: 'actions',
      header: t.columnActions,
      omitFromDetails: true,
      cell: (member) => (
        <div className={styles.rowActions}>
          {member.suspended ? (
            canSuspend ? (
              <NewsButton
                variant="outline"
                size="sm"
                onClick={() => setAction({ kind: 'reinstate', member })}
              >
                {t.actionReinstate}
              </NewsButton>
            ) : null
          ) : (
            <>
              {canGrant || canRevoke ? (
                <NewsButton
                  variant="outline"
                  size="sm"
                  aria-expanded={editorFor === member.id}
                  aria-controls={editorFor === member.id ? editorId : undefined}
                  onClick={() => openEditor(member)}
                >
                  {t.actionManage}
                </NewsButton>
              ) : null}
              {canSuspend ? (
                <NewsButton
                  variant="outline"
                  size="sm"
                  onClick={() => setAction({ kind: 'suspend', member })}
                >
                  {t.actionSuspend}
                </NewsButton>
              ) : null}
            </>
          )}
        </div>
      ),
    },
  ];

  const renderExpansion = (member: SpaceMember) => (
    <div id={`${detailsIdBase}-${member.id}`} className={styles.details}>
      <dl className={styles.detailsList}>
        <dt>{t.detailJoined}</dt>
        <dd>{new Date(member.joinedAt).toLocaleDateString('he-IL')}</dd>

        <dt>{t.detailCapabilities}</dt>
        <dd>
          {member.capabilities.length === 0
            ? t.detailNoCapabilities
            : member.capabilities
                .map((capability) => t.capabilityLabels[capability])
                .join(' · ')}
        </dd>

        <dt>{t.detailMemberId}</dt>
        <dd>
          <span dir="ltr" className={styles.latin}>
            {member.id}
          </span>
        </dd>
      </dl>
    </div>
  );

  const searching = search.length > 0;
  const empty = members.length === 0;

  return (
    <>
      {live}

      <div className={styles.search}>
        <PressInput
          type="search"
          label={t.searchLabel}
          placeholder={t.searchPlaceholder}
          value={term}
          onChange={(event) => setTerm(event.target.value)}
        />
      </div>

      {empty && !searching ? (
        <EmptyPanel heading={t.emptyHeading} body={t.emptyBody} />
      ) : empty ? (
        <EmptyPanel
          heading={t.noMatchHeading}
          body={t.noMatchBody}
          action={
            <NewsButton variant="outline" onClick={() => setTerm('')}>
              {t.clearSearch}
            </NewsButton>
          }
        />
      ) : (
        <>
          <PressTable
            columns={columns}
            rows={members}
            rowKey={(member) => member.id}
            description={t.tableDescription(spaceName)}
            loading={isPending}
            renderExpansion={renderExpansion}
            expandedKey={expanded}
            onExpandedKeyChange={setExpanded}
            rowClassName={(member) =>
              member.id === flashKey ? rowFlashClass : undefined
            }
          />
          <p className={styles.total}>{t.totalMembers(total)}</p>
        </>
      )}

      {editorMember ? (
        <section
          id={editorId}
          className={styles.editor}
          aria-labelledby={`${editorId}-heading`}
        >
          <h3 id={`${editorId}-heading`} className={styles.editorHeading}>
            {t.editorHeading(editorMember.displayName)}
          </h3>

          <PressSelect
            label={t.roleLabel}
            placeholder={t.rolePlaceholder}
            value={preset}
            options={presetOptions}
            onChange={(event) => setPreset(event.target.value as RolePreset)}
          />

          {preset ? (
            <div className={styles.presetPreview}>
              <p className={styles.presetNote}>{t.presetNote}</p>
              <ul className={styles.presetList}>
                {expandPreset(preset).map((capability) => (
                  <li key={capability}>{t.capabilityLabels[capability]}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <ul className={styles.manifest}>
            {CAPABILITIES.map((capability) => {
              const granted = editorMember.capabilities.includes(capability);
              return (
                <li key={capability} className={styles.manifestRow}>
                  <span aria-hidden className={styles.manifestMark}>
                    {granted ? '✓' : '✕'}
                  </span>
                  <span className={styles.manifestLabel}>
                    {t.capabilityLabels[capability]}
                  </span>
                  <span className={styles.manifestState}>
                    {granted ? t.granted : t.notGranted}
                  </span>
                  {granted && canRevoke ? (
                    <NewsButton
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setAction({ kind: 'revoke', member: editorMember, capability })
                      }
                    >
                      {t.revokeCapability}
                    </NewsButton>
                  ) : null}
                  {!granted && canGrant ? (
                    <NewsButton
                      variant="ink"
                      size="sm"
                      className={styles.inkBtn}
                      onClick={() =>
                        setAction({
                          kind: 'grant',
                          member: editorMember,
                          capability,
                          viaRole: preset === '' ? undefined : preset,
                        })
                      }
                    >
                      {t.grantCapability}
                    </NewsButton>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <NewsButton variant="outline" onClick={() => setEditorFor(null)}>
            {t.close}
          </NewsButton>
        </section>
      ) : null}

      {dialog}
    </>
  );
}
