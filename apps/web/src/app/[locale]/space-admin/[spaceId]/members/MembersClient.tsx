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
  NoPermissionPanel,
  PressTable,
  StatusChip,
  type PressTableColumn,
} from '@/components/space-admin';
import {
  CAPABILITIES,
  CAPABILITY_LABELS_HE,
  ROLE_PRESETS,
  ROLE_PRESET_LABELS_HE,
  expandPreset,
  type Capability,
  type RolePreset,
} from '@/server/domain/space/capability';
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
}

// ---------------------------------------------------------------------------
// Confirmations
// ---------------------------------------------------------------------------

type PendingAction =
  | { kind: 'grant'; member: SpaceMember; capability: Capability; viaRole?: RolePreset }
  | { kind: 'revoke'; member: SpaceMember; capability: Capability }
  | { kind: 'suspend'; member: SpaceMember }
  | { kind: 'reinstate'; member: SpaceMember }
  | { kind: 'escalate' };

interface DialogCopy {
  heading: string;
  body: string;
  consequence?: string;
  confirmLabel: string;
  announcement: string;
  reasonLabel?: string;
  reasonError?: string;
  placeholder?: string;
  unblockHint?: string;
}

const REASON_PLACEHOLDER =
  'למה הכרעתם כך? הנימוק נשמר ביומן ואי אפשר לערוך אותו אחר כך.';

/**
 * The action failed on the server. No string in the copy deck covers this
 * case — the deck's error sentence is about a failed *load* — so this one is
 * written in its voice: what did not happen, and where to go if it repeats.
 */
const ACTION_FAILED_HE =
  'הפעולה לא בוצעה ולא נרשמה ביומן. נסו שוב; אם זה חוזר — פנו למנהל־על.';

const dialogCopy = (action: PendingAction): DialogCopy => {
  switch (action.kind) {
    case 'grant':
      return {
        heading: 'להעניק את ההרשאה?',
        body: `${action.member.displayName} יוכל/תוכל מעכשיו: ${CAPABILITY_LABELS_HE[action.capability]} — במרחב הזה בלבד.`,
        confirmLabel: 'העניקו הרשאה',
        announcement: `ההרשאה הוענקה ל־${action.member.displayName}.`,
        placeholder: REASON_PLACEHOLDER,
      };
    case 'revoke':
      return {
        heading: 'לשלול את ההרשאה?',
        body: `${action.member.displayName} יאבד/תאבד מיד את היכולת: ${CAPABILITY_LABELS_HE[action.capability]}.`,
        consequence: 'הפעולה נכנסת לתוקף מיד ונרשמת ביומן לצמיתות.',
        confirmLabel: 'שללו הרשאה',
        announcement: `ההרשאה נשללה מ־${action.member.displayName}.`,
        placeholder: REASON_PLACEHOLDER,
      };
    case 'suspend':
      return {
        heading: `להשעות את ${action.member.displayName} במרחב?`,
        body: 'הגישה למרחב הזה נחסמת מיד. אפשר לבטל את ההשעיה בהמשך.',
        consequence: 'ההיסטוריה, ההחלטות והתיעוד נשמרים במלואם ואינם נמחקים.',
        confirmLabel: 'השעו במרחב',
        announcement: `${action.member.displayName} הושעה/תה במרחב. ההיסטוריה נשמרה.`,
        placeholder: REASON_PLACEHOLDER,
      };
    case 'reinstate':
      return {
        heading: `לבטל את ההשעיה של ${action.member.displayName}?`,
        // Literally true, and deliberately narrow: reinstatement restores the
        // grants the suspension itself took, matched on the suspension's own
        // timestamp. A capability revoked before the suspension stays revoked.
        body: 'הגישה למרחב הזה תחזור מיד, עם אותן הרשאות שהיו לפני ההשעיה.',
        confirmLabel: 'בטלו השעיה',
        announcement: `ההשעיה של ${action.member.displayName} בוטלה.`,
        placeholder: REASON_PLACEHOLDER,
      };
    case 'escalate':
      return {
        heading: 'פנייה למנהל־על',
        body: 'הפנייה נשלחת למנהלי הפלטפורמה יחד עם שם המרחב ועם החשבון שלכם.',
        confirmLabel: 'שלחו פנייה',
        announcement: 'הפנייה נשלחה. מנהל־על יקבל אותה עם פרטי המרחב.',
        reasonLabel: 'מה תרצו לבקש? (חובה)',
        reasonError: 'נדרש תיאור — לפחות 10 תווים.',
        placeholder:
          'תארו מה חסם אתכם — למשל הרשאה שאתם צריכים, או השעיה שנראית לכם שגויה.',
        unblockHint: 'התיאור נדרש כדי להמשיך.',
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
    case 'escalate':
      return { path: `${base}/escalations`, method: 'POST', body: { body: reason } };
  }
};

// ---------------------------------------------------------------------------
// Surface
// ---------------------------------------------------------------------------

const SEARCH_DEBOUNCE_MS = 300;

const PRESET_OPTIONS = (Object.keys(ROLE_PRESETS) as RolePreset[]).map((preset) => ({
  value: preset,
  label: ROLE_PRESET_LABELS_HE[preset],
}));

export function MembersClient({
  spaceId,
  search,
  canGrant,
  canRevoke,
  canSuspend,
  state,
}: MembersClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const detailsIdBase = useId();
  const editorId = useId();

  const [term, setTerm] = useState(search);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editorFor, setEditorFor] = useState<string | null>(null);
  const [preset, setPreset] = useState<RolePreset | ''>('');
  const [action, setAction] = useState<PendingAction | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [isPending, startTransition] = useTransition();

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
          setFailure(ACTION_FAILED_HE);
          return;
        }
        setAction(null);
        setAnnouncement(dialogCopy(pending).announcement);
        startTransition(() => router.refresh());
      } catch {
        setFailure(ACTION_FAILED_HE);
      } finally {
        setSubmitting(false);
      }
    },
    [router, spaceId]
  );

  const escalate = useCallback(() => setAction({ kind: 'escalate' }), []);

  const activeCopy = action ? dialogCopy(action) : null;

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
        reasonLabel={activeCopy.reasonLabel}
        reasonError={activeCopy.reasonError}
        placeholder={activeCopy.placeholder}
        unblockHint={activeCopy.unblockHint}
        pending={submitting}
        pendingLabel="…שומר"
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

  if (state.kind === 'denied') {
    return (
      <>
        {live}
        <NoPermissionPanel onEscalate={escalate} />
        {dialog}
      </>
    );
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
      header: 'חבר/ה',
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
              {isExpanded ? 'הסתר' : 'הצג פרטים'}
              <span aria-hidden>{isExpanded ? ' ▴' : ' ▾'}</span>
            </button>
          </div>
        );
      },
    },
    {
      key: 'joined',
      header: 'הצטרפ/ה',
      secondary: true,
      cell: (member) => (
        <span className={styles.mono}>
          {new Date(member.joinedAt).toLocaleDateString('he-IL')}
        </span>
      ),
    },
    {
      key: 'capabilities',
      header: 'הרשאות',
      secondary: true,
      // A count, never a raw capability identifier. The Hebrew labels live in
      // the row disclosure and in the management panel.
      cell: (member) => (
        <span className={styles.mono}>{member.capabilities.length}</span>
      ),
    },
    {
      key: 'status',
      header: 'סטטוס',
      cell: (member) =>
        member.suspended ? (
          <StatusChip tone="suspended">מושעה/ית</StatusChip>
        ) : (
          <StatusChip>פעיל/ה</StatusChip>
        ),
    },
    {
      key: 'actions',
      header: 'פעולות',
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
                ביטול השעיה
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
                  ניהול הרשאות
                </NewsButton>
              ) : null}
              {canSuspend ? (
                <NewsButton
                  variant="outline"
                  size="sm"
                  onClick={() => setAction({ kind: 'suspend', member })}
                >
                  השעיה במרחב
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
        <dt>הצטרפ/ה</dt>
        <dd>{new Date(member.joinedAt).toLocaleDateString('he-IL')}</dd>

        <dt>הרשאות</dt>
        <dd>
          {member.capabilities.length === 0
            ? 'אין הרשאות במרחב הזה'
            : member.capabilities
                .map((capability) => CAPABILITY_LABELS_HE[capability])
                .join(' · ')}
        </dd>

        <dt>מזהה חבר/ה</dt>
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
          label="חיפוש חבר/ה"
          placeholder="…שם או מזהה"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
        />
      </div>

      {empty && !searching ? (
        <EmptyPanel
          heading="אין עדיין חברים במרחב"
          body="כשתושבים יצטרפו למרחב הזה, הם יופיעו כאן."
        />
      ) : empty ? (
        <EmptyPanel
          heading="לא נמצאו חברים תואמים"
          body="נסו שם אחר, או נקו את החיפוש."
          action={
            <NewsButton variant="outline" onClick={() => setTerm('')}>
              ניקוי חיפוש
            </NewsButton>
          }
        />
      ) : (
        <>
          <PressTable
            columns={columns}
            rows={members}
            rowKey={(member) => member.id}
            description={`חברי המרחב ${spaceName} וההרשאות שלהם. כל שורה כוללת שם, מועד הצטרפות, מצב חברות והרשאות שהוענקו.`}
            loading={isPending}
            renderExpansion={renderExpansion}
            expandedKey={expanded}
            onExpandedKeyChange={setExpanded}
          />
          <p className={styles.total}>{total} חברים במרחב</p>
        </>
      )}

      {editorMember ? (
        <section
          id={editorId}
          className={styles.editor}
          aria-labelledby={`${editorId}-heading`}
        >
          <h3 id={`${editorId}-heading`} className={styles.editorHeading}>
            ניהול הרשאות — {editorMember.displayName}
          </h3>

          <PressSelect
            label="תפקיד"
            placeholder="…בחרו תפקיד"
            value={preset}
            options={PRESET_OPTIONS}
            onChange={(event) => setPreset(event.target.value as RolePreset)}
          />

          {preset ? (
            <div className={styles.presetPreview}>
              <p className={styles.presetNote}>
                התפקיד כולל את ההרשאות הבאות. כל הרשאה מוענקת בנפרד ובאישור
                נפרד.
              </p>
              <ul className={styles.presetList}>
                {expandPreset(preset).map((capability) => (
                  <li key={capability}>{CAPABILITY_LABELS_HE[capability]}</li>
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
                    {CAPABILITY_LABELS_HE[capability]}
                  </span>
                  <span className={styles.manifestState}>
                    {granted ? 'מוענק' : 'לא מוענק'}
                  </span>
                  {granted && canRevoke ? (
                    <NewsButton
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setAction({ kind: 'revoke', member: editorMember, capability })
                      }
                    >
                      שלילת הרשאה
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
                      הענקת הרשאה
                    </NewsButton>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <NewsButton variant="outline" onClick={() => setEditorFor(null)}>
            סגירה
          </NewsButton>
        </section>
      ) : null}

      {dialog}
    </>
  );
}
