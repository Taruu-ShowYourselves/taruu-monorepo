'use client';

import React, { useCallback, useId, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import type { AuditRow } from '@sync/shared/contracts';
import { NewsButton } from '@/components/press/NewsButton';
import { PressSelect } from '@/components/press/PressSelect/PressSelect';
import {
  ClampedText,
  EmptyPanel,
  ErrorPanel,
  PressTable,
  ShortId,
  type PressTableColumn,
} from '@/components/space-admin';
import { EscalationDialog } from '@/components/space-admin/EscalationDialog';
import { CAPABILITY_LABELS_HE } from '@/server/domain/space/capability';
import {
  AUDIT_FILTERS,
  DEFAULT_AUDIT_FILTER,
  decodeTrail,
  encodeTrail,
  isAuditFilter,
  type AuditFilterValue,
} from './filters';
import styles from './page.module.css';
import { localePrefix } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';

/**
 * Surface 6 — the audit history.
 *
 * THE SURFACE IS READ-ONLY, AND IT SHOWS. There is no row action column, no
 * edit control, no delete control, and no confirmation component imported into
 * this file at all — the standfirst above it says the log cannot be changed,
 * and a control that appeared to change it would make that sentence a lie
 * before the server ever got the chance to refuse.
 *
 * Immutability itself is enforced three layers down: a BEFORE UPDATE/DELETE
 * trigger, a BEFORE TRUNCATE trigger, and a REVOKE on the table, with
 * `ON DELETE RESTRICT` on both foreign keys so a user with history cannot be
 * deleted out from under it. This file's job is to render that honestly.
 *
 * PAGING IS KEYSET-ONLY, and the reason is in the data rather than in taste:
 * the log is append-only and continuously written, so an index-based page two
 * would repeat rows it had already shown and skip rows it never would. The
 * same fact is why there is no record count anywhere on this surface — one
 * would be expensive to compute and stale by the time it arrived. The meta
 * line says how many rows are on screen, which is a fact about the screen.
 */

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

/**
 * The chips, the default, the guard and the trail codec live in `./filters`, a
 * module with no `'use client'` directive, because `page.tsx` reads all of them
 * on the server. Re-exported here for the call sites that already import them
 * from this file — but a Server Component must import from `./filters`
 * directly, or React hands it a client reference and the call throws. See that
 * file's header.
 */
export {
  AUDIT_FILTERS,
  DEFAULT_AUDIT_FILTER,
  isAuditFilter,
  encodeTrail,
  decodeTrail,
  type AuditFilterValue,
};

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

interface AuditCopy {
  actorLabel: string;
  actorPlaceholder: string;
  clearFilters: string;
  oldestHint: string;
  newestHint: string;
  loadError: string;
  emptyHeading: string;
  emptyBody: string;
  noResultsHeading: string;
  noResultsBody: string;
  /** aria-label on the chip group. */
  chipsGroupLabel: string;
  colWhen: string;
  colWho: string;
  colAction: string;
  colObject: string;
  colTransition: string;
  colReason: string;
  hideReason: string;
  showFullReason: string;
  showDetails: string;
  detailFrom: string;
  detailTo: string;
  yes: string;
  no: string;
  /**
   * Copy for every action the phase writes. Not in the copy deck — the deck
   * specifies the audit COLUMNS and leaves the vocabulary to the
   * implementation — so these are written in the deck's voice, past tense,
   * using its words (`הצעה`, `הרשאה`, `התראה`, `להשעות`).
   *
   * An action with no entry renders its stored identifier rather than a
   * guess. This is a record: an unmapped row must still be legible as itself,
   * and hiding it or labelling it `אחר` would be the one thing the log may
   * not do.
   */
  actionLabels: Readonly<Record<string, string>>;
  /** The object types the log records. */
  objectLabels: Readonly<Record<string, string>>;
  /** The keys the state payloads use. */
  stateKeys: Readonly<Record<string, string>>;
  /** Capability values inside `capability` state payloads. */
  capabilityLabels: Readonly<Record<string, string>>;
  tableDescription: (spaceName: string) => string;
  rowsMeta: (count: number) => string;
  truncation: (count: number) => string;
  /** BCP 47 tag for the timestamp on each row. */
  dateLocale: string;
}

const COPY: Record<Locale, AuditCopy> = {
  he: {
    actorLabel: 'מבצע/ת הפעולה',
    actorPlaceholder: 'כל המנהלים',
    clearFilters: 'ניקוי סינון',
    oldestHint: 'זו הרשומה הישנה ביותר.',
    newestHint: 'אתם בתחילת היומן.',
    loadError: 'לא הצלחנו לטעון את היומן. הרשומות עצמן לא נפגעו — נסו שוב.',
    emptyHeading: 'היומן ריק',
    emptyBody:
      'כל הכרעה, שינוי הרשאה ומשלוח התראה במרחב יירשמו כאן אוטומטית.',
    noResultsHeading: 'אין רשומות שתואמות לסינון',
    noResultsBody: 'נסו טווח או סוג פעולה אחר.',
    chipsGroupLabel: 'סינון לפי סוג פעולה',
    colWhen: 'מתי',
    colWho: 'מי',
    colAction: 'פעולה',
    colObject: 'אובייקט',
    colTransition: 'ממצב → למצב',
    colReason: 'נימוק',
    hideReason: 'הסתר',
    showFullReason: 'הצג נימוק מלא',
    showDetails: 'הצג פרטים',
    detailFrom: 'ממצב',
    detailTo: 'למצב',
    yes: 'כן',
    no: 'לא',
    actionLabels: {
      'proposal.approved': 'הצעה אושרה ופורסמה',
      'proposal.rejected': 'הצעה נדחתה',
      'proposal.changes_requested': 'הצעה הוחזרה לתיקון',
      'grant.created': 'הרשאה הוענקה',
      'grant.revoked': 'הרשאה נשללה',
      'grant.suspended': 'הרשאה הושעתה',
      'member.suspended': 'חבר/ה הושעה/תה במרחב',
      'member.reinstated': 'השעיה במרחב בוטלה',
      'content.hidden': 'תוכן הוסתר מהתושבים',
      'content.unhidden': 'תוכן הוחזר לתצוגה',
      'content.flagged': 'תוכן סומן לבדיקה',
      'content.unflagged': 'סימון לבדיקה בוטל',
      'notification.sent': 'התראה נשלחה',
    },
    objectLabels: {
      vote: 'הצעה',
      grant: 'הרשאה',
      space: 'מרחב',
      member: 'חבר/ה',
      notification_campaign: 'משלוח התראה',
      content: 'תוכן',
      escalation: 'פנייה למנהל־על',
    },
    stateKeys: {
      status: 'סטטוס',
      suspended: 'מושעה',
      capability: 'הרשאה',
      active: 'פעילה',
      hidden: 'מוסתר',
      flagged: 'מסומן',
      paymentId: 'מזהה חיוב',
      amountAgorot: 'סכום באגורות',
    },
    capabilityLabels: CAPABILITY_LABELS_HE,
    tableDescription: (spaceName) =>
      `יומן הפעולות של המרחב ${spaceName}, מהחדש לישן. כל שורה כוללת מועד, מבצע/ת הפעולה, סוג הפעולה, האובייקט, המעבר בין המצבים והנימוק.`,
    rowsMeta: (count) => `מוצגות ${count} רשומות`,
    truncation: (count) =>
      `מוצגות ${count} הרשומות האחרונות. לרשומות ישנות יותר — המשיכו בדפדוף.`,
    dateLocale: 'he-IL',
  },
  en: {
    actorLabel: 'Actor',
    actorPlaceholder: 'All admins',
    clearFilters: 'Clear filters',
    oldestHint: 'This is the oldest entry.',
    newestHint: 'You are at the head of the log.',
    loadError: 'We could not load the log. The entries themselves are intact — try again.',
    emptyHeading: 'The log is empty',
    emptyBody:
      'Every decision, capability change and notification dispatch in this space will be recorded here automatically.',
    noResultsHeading: 'No entries match the filter',
    noResultsBody: 'Try a different range or action type.',
    chipsGroupLabel: 'Filter by action type',
    colWhen: 'When',
    colWho: 'Who',
    colAction: 'Action',
    colObject: 'Object',
    colTransition: 'From → To',
    colReason: 'Reasoning',
    hideReason: 'Hide',
    showFullReason: 'Show full reasoning',
    showDetails: 'Show details',
    detailFrom: 'From',
    detailTo: 'To',
    yes: 'Yes',
    no: 'No',
    actionLabels: {
      'proposal.approved': 'Proposal approved and published',
      'proposal.rejected': 'Proposal rejected',
      'proposal.changes_requested': 'Proposal returned for changes',
      'grant.created': 'Capability granted',
      'grant.revoked': 'Capability revoked',
      'grant.suspended': 'Capability suspended',
      'member.suspended': 'Member suspended in this space',
      'member.reinstated': 'Space suspension lifted',
      'content.hidden': 'Content hidden from residents',
      'content.unhidden': 'Content restored to view',
      'content.flagged': 'Content flagged for review',
      'content.unflagged': 'Review flag removed',
      'notification.sent': 'Notification sent',
    },
    objectLabels: {
      vote: 'Proposal',
      grant: 'Capability',
      space: 'Space',
      member: 'Member',
      notification_campaign: 'Notification dispatch',
      content: 'Content',
      escalation: 'Super-admin escalation',
    },
    stateKeys: {
      status: 'Status',
      suspended: 'Suspended',
      capability: 'Capability',
      active: 'Active',
      hidden: 'Hidden',
      flagged: 'Flagged',
      paymentId: 'Payment ID',
      amountAgorot: 'Amount in agorot',
    },
    // English mirrors of `CAPABILITY_LABELS_HE` — same keys, deck voice.
    capabilityLabels: {
      'proposal.read': 'Review proposals',
      'proposal.approve': 'Approve and publish proposals',
      'proposal.reject': 'Reject proposals',
      'member.read': 'View the member list',
      'member.suspend': 'Suspend members in this space',
      'grant.create': 'Grant capabilities',
      'grant.revoke': 'Revoke capabilities',
      'content.moderate': 'Moderate permitted content',
      'metrics.read': 'View aggregate figures',
      'notification.send': 'Send notifications to residents',
      'audit.read': 'View the audit log',
    },
    tableDescription: (spaceName) =>
      `The audit log of the space ${spaceName}, newest first. Each row carries the time, the actor, the action, the object, the state transition and the reasoning.`,
    rowsMeta: (count) => `Showing ${count} entries`,
    truncation: (count) =>
      `Showing the most recent ${count} entries. For older entries, keep paging.`,
    dateLocale: 'en-GB',
  },
};

const stateValue = (t: AuditCopy, key: string, value: unknown): string => {
  if (typeof value === 'boolean') return value ? t.yes : t.no;
  if (key === 'capability' && typeof value === 'string') {
    return t.capabilityLabels[value] ?? value;
  }
  if (value === null || value === undefined) return '—';
  return String(value);
};

/**
 * A state payload as one readable line. Nothing is dropped — this is the
 * record of what changed, and a summary that omits a field is a summary of a
 * different event. Long ones clamp and open in the row expansion.
 */
const describeState = (t: AuditCopy, payload: unknown): string => {
  if (payload === null || payload === undefined) return '—';
  if (typeof payload !== 'object') return String(payload);

  const entries = Object.entries(payload as Record<string, unknown>);
  if (entries.length === 0) return '—';

  return entries
    .map(([key, value]) => `${t.stateKeys[key] ?? key}: ${stateValue(t, key, value)}`)
    .join(' · ');
};

// ---------------------------------------------------------------------------
// Surface state
// ---------------------------------------------------------------------------

export type AuditSurfaceState =
  | {
      kind: 'ok';
      spaceName: string;
      rows: readonly AuditRow[];
      nextCursor: string | null;
      truncated: boolean;
    }
  | { kind: 'denied' }
  | { kind: 'failed' };

export interface AuditClientProps {
  spaceId: string;
  locale: Locale;
  /** The filter already applied by the server. Mirrors `?objectType=`. */
  filter: AuditFilterValue;
  /** The actor already applied by the server. Mirrors `?actor=`. */
  actor: string | null;
  /** The cursor this page starts at. `null` is the head of the log. */
  cursor: string | null;
  /**
   * The cursors of the pages before this one, oldest-first. It rides in the
   * URL so that going back a page is a real navigation rather than browser
   * history the surface cannot see — and so a page deep in the log stays
   * linkable and reproducible for a screenshot.
   */
  trail: readonly string[];
  state: AuditSurfaceState;
}

export function AuditClient({
  spaceId,
  locale,
  filter,
  actor,
  cursor,
  trail,
  state,
}: AuditClientProps) {
  const t = COPY[locale];
  const router = useRouter();
  const pathname = usePathname();
  const detailsIdBase = useId();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  /**
   * Filters and the cursor live in the query string, so a filtered view is
   * linkable, back-button-correct and reproducible for a screenshot.
   */
  const go = useCallback(
    (next: {
      filter?: AuditFilterValue;
      actor?: string | null;
      cursor?: string | null;
      trail?: readonly string[];
    }) => {
      const params = new URLSearchParams();
      const nextFilter = next.filter ?? filter;
      const nextActor = next.actor === undefined ? actor : next.actor;
      const nextCursor = next.cursor === undefined ? cursor : next.cursor;
      const nextTrail = next.trail ?? trail;

      if (nextFilter !== DEFAULT_AUDIT_FILTER) params.set('objectType', nextFilter);
      if (nextActor) params.set('actor', nextActor);
      if (nextCursor) params.set('cursor', nextCursor);
      if (nextCursor && nextTrail.length > 0) {
        params.set('trail', encodeTrail(nextTrail));
      }

      const query = params.toString();
      setExpanded(null);
      startTransition(() => {
        router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [actor, cursor, filter, pathname, router, trail],
  );

  /**
   * The actor options come from the page on screen. There is no endpoint that
   * lists a space's admins, and the one that lists its MEMBERS is gated on a
   * different capability — an audit reader who does not hold it would get a
   * refusal instead of a filter. Deriving from the visible rows keeps the
   * control honest about what it can offer, and `ניקוי סינון` is always
   * present once a filter is applied, so a narrowed list can never trap
   * anyone on it.
   */
  const actorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    if (state.kind === 'ok') {
      for (const row of state.rows) seen.set(row.actorId, row.actorDisplayName);
    }
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [state]);

  if (state.kind === 'denied') {
    return <EscalationDialog spaceId={spaceId} trigger="no-permission" />;
  }

  if (state.kind === 'failed') {
    return (
      <ErrorPanel
        body={t.loadError}
        onRetry={() => startTransition(() => router.refresh())}
      />
    );
  }

  const { spaceName, rows, nextCursor, truncated } = state;

  const filtering = filter !== DEFAULT_AUDIT_FILTER || actor !== null;

  const filters = (
    <div className={styles.filters}>
      <div className={styles.chips} role="group" aria-label={t.chipsGroupLabel}>
        {AUDIT_FILTERS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            className={clsx(styles.chip, chip.value === filter && styles.chipActive)}
            aria-pressed={chip.value === filter}
            onClick={() => go({ filter: chip.value, cursor: null, trail: [] })}
          >
            {chip.labels[locale]}
          </button>
        ))}
      </div>

      <PressSelect
        className={styles.actorFilter}
        label={t.actorLabel}
        placeholder={t.actorPlaceholder}
        options={actorOptions}
        value={actor ?? ''}
        onChange={(event) =>
          go({ actor: event.target.value || null, cursor: null, trail: [] })
        }
      />

      {filtering ? (
        <div className={styles.filterActions}>
          <NewsButton
            variant="outline"
            size="sm"
            onClick={() =>
              go({
                filter: DEFAULT_AUDIT_FILTER,
                actor: null,
                cursor: null,
                trail: [],
              })
            }
          >
            {t.clearFilters}
          </NewsButton>
        </div>
      ) : null}
    </div>
  );

  const columns: readonly PressTableColumn<AuditRow>[] = [
    {
      key: 'when',
      header: t.colWhen,
      primary: true,
      cell: (row) => (
        <span className={styles.mono}>
          {new Date(row.createdAt).toLocaleString(t.dateLocale, {
            dateStyle: 'short',
            timeStyle: 'short',
          })}
        </span>
      ),
    },
    {
      key: 'who',
      header: t.colWho,
      secondary: true,
      cell: (row) => (
        <ClampedText lines={1} title={row.actorDisplayName}>
          {row.actorDisplayName}
        </ClampedText>
      ),
    },
    {
      key: 'action',
      header: t.colAction,
      cell: (row) => (
        <span className={styles.mono}>
          {t.actionLabels[row.action] ?? (
            <span dir="ltr" className={styles.latin}>
              {row.action}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'object',
      header: t.colObject,
      secondary: true,
      cell: (row) => {
        const label = t.objectLabels[row.objectType] ?? row.objectType;
        if (row.objectId === null) return <span className={styles.mono}>{label}</span>;

        // A decided proposal is reachable from its own log row. The deep link
        // forces the proposals surface to show everything before expanding,
        // which is what keeps a rejected proposal from silently failing to
        // open under that surface's default filter.
        if (row.objectType === 'vote') {
          return (
            <Link
              className={styles.objectLink}
              href={`${localePrefix(locale)}/space-admin/${spaceId}/proposals?proposal=${row.objectId}`}
            >
              {label} <ShortId value={row.objectId} />
            </Link>
          );
        }

        return (
          <span className={styles.mono}>
            {label} <ShortId value={row.objectId} />
          </span>
        );
      },
    },
    {
      key: 'transition',
      header: t.colTransition,
      secondary: true,
      cell: (row) => (
        <span className={styles.transition}>
          <ClampedText lines={2}>{describeState(t, row.priorState)}</ClampedText>
          <span aria-hidden>→</span>
          <ClampedText lines={2}>{describeState(t, row.newState)}</ClampedText>
        </span>
      ),
    },
    {
      key: 'reason',
      header: t.colReason,
      omitFromDetails: true,
      cell: (row) => {
        const isExpanded = expanded === row.id;
        return (
          <div className={styles.reasonCell}>
            <ClampedText lines={2} title={row.reason}>
              {row.reason}
            </ClampedText>
            <button
              type="button"
              className={styles.disclosure}
              aria-expanded={isExpanded}
              aria-controls={isExpanded ? `${detailsIdBase}-${row.id}` : undefined}
              onClick={() => setExpanded(isExpanded ? null : row.id)}
            >
              {isExpanded ? (
                t.hideReason
              ) : (
                <>
                  <span className={styles.wideLabel}>{t.showFullReason}</span>
                  <span className={styles.narrowLabel}>{t.showDetails}</span>
                </>
              )}
              <span aria-hidden>{isExpanded ? ' ▴' : ' ▾'}</span>
            </button>
          </div>
        );
      },
    },
  ];

  /**
   * One expansion per row at every width. It always carries the full reason,
   * so the clamped cell never has to grow and the table never reflows
   * sideways; below 768px it additionally carries the three columns that are
   * hidden there, which is why the trigger's label changes with the width.
   */
  const renderExpansion = (row: AuditRow) => (
    <div id={`${detailsIdBase}-${row.id}`} className={styles.details}>
      <p className={styles.fullReason}>{row.reason}</p>

      <dl className={clsx(styles.detailsList, styles.hiddenColumns)}>
        <dt>{t.colWho}</dt>
        <dd>{row.actorDisplayName}</dd>

        <dt>{t.colObject}</dt>
        <dd>
          {t.objectLabels[row.objectType] ?? row.objectType}
          {row.objectId ? (
            <>
              {' '}
              <span dir="ltr" className={styles.latin}>
                {row.objectId}
              </span>
            </>
          ) : null}
        </dd>

        <dt>{t.detailFrom}</dt>
        <dd>{describeState(t, row.priorState)}</dd>

        <dt>{t.detailTo}</dt>
        <dd>{describeState(t, row.newState)}</dd>
      </dl>
    </div>
  );

  const empty = rows.length === 0;

  return (
    <>
      {filters}

      {empty && !filtering ? (
        <EmptyPanel heading={t.emptyHeading} body={t.emptyBody} />
      ) : empty ? (
        <EmptyPanel
          heading={t.noResultsHeading}
          body={t.noResultsBody}
          action={
            <NewsButton
              variant="outline"
              onClick={() =>
                go({
                  filter: DEFAULT_AUDIT_FILTER,
                  actor: null,
                  cursor: null,
                  trail: [],
                })
              }
            >
              {t.clearFilters}
            </NewsButton>
          }
        />
      ) : (
        <>
          <PressTable
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            description={t.tableDescription(spaceName)}
            loading={isPending}
            renderExpansion={renderExpansion}
            expandedKey={expanded}
            onExpandedKeyChange={setExpanded}
            pagination={{
              // Forward is deeper into the past: the next cursor becomes the
              // page, and the page that produced it joins the trail.
              onOlder: () =>
                nextCursor
                  ? go({
                      cursor: nextCursor,
                      trail: cursor ? [...trail, cursor] : [],
                    })
                  : undefined,
              onNewer: () => {
                const previous = trail[trail.length - 1] ?? null;
                go({ cursor: previous, trail: trail.slice(0, -1) });
              },
              olderDisabled: nextCursor === null,
              newerDisabled: cursor === null,
              olderHint: t.oldestHint,
              newerHint: t.newestHint,
              meta: t.rowsMeta(rows.length),
            }}
          />

          {truncated ? (
            <p className={styles.truncation}>{t.truncation(rows.length)}</p>
          ) : null}
        </>
      )}
    </>
  );
}
