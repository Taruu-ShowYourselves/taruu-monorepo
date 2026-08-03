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
import styles from './page.module.css';

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
 * The four chips of the copy deck, mapped onto `space_audit_log.object_type`.
 *
 * The column admits seven values; these cover three. `member`, `content`,
 * `space` and `escalation` rows are reachable only under `הכול` — which is the
 * deck's own filter list, not an omission here. Worth knowing when reading the
 * log: a suspension is a `member` row, so it does NOT appear under `הרשאות`,
 * which selects grant rows alone.
 */
export const AUDIT_FILTERS = [
  { value: 'all', label: 'הכול', objectType: undefined },
  { value: 'vote', label: 'הצעות', objectType: 'vote' },
  { value: 'grant', label: 'הרשאות', objectType: 'grant' },
  {
    value: 'notification_campaign',
    label: 'התראות',
    objectType: 'notification_campaign',
  },
] as const;

export type AuditFilterValue = (typeof AUDIT_FILTERS)[number]['value'];

export const DEFAULT_AUDIT_FILTER: AuditFilterValue = 'all';

export const isAuditFilter = (value: string | null): value is AuditFilterValue =>
  value !== null && AUDIT_FILTERS.some((filter) => filter.value === value);

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

const ACTOR_LABEL = 'מבצע/ת הפעולה';
const ACTOR_PLACEHOLDER = 'כל המנהלים';
const CLEAR_FILTERS = 'ניקוי סינון';

const OLDEST_HINT = 'זו הרשומה הישנה ביותר.';
const NEWEST_HINT = 'אתם בתחילת היומן.';

const ERROR_HE = 'לא הצלחנו לטעון את היומן. הרשומות עצמן לא נפגעו — נסו שוב.';

const EMPTY_HEADING = 'היומן ריק';
const EMPTY_BODY =
  'כל הכרעה, שינוי הרשאה ומשלוח התראה במרחב יירשמו כאן אוטומטית.';
const NO_RESULTS_HEADING = 'אין רשומות שתואמות לסינון';
const NO_RESULTS_BODY = 'נסו טווח או סוג פעולה אחר.';

/**
 * Hebrew for every action the phase writes. Not in the copy deck — the deck
 * specifies the audit COLUMNS and leaves the vocabulary to the implementation
 * — so these are written in the deck's voice, past tense, using its words
 * (`הצעה`, `הרשאה`, `התראה`, `להשעות`).
 *
 * An action with no entry renders its stored identifier rather than a guess.
 * This is a record: an unmapped row must still be legible as itself, and
 * hiding it or labelling it `אחר` would be the one thing the log may not do.
 */
const ACTION_LABELS_HE: Readonly<Record<string, string>> = {
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
};

/** Hebrew for the object types the log records. */
const OBJECT_LABELS_HE: Readonly<Record<string, string>> = {
  vote: 'הצעה',
  grant: 'הרשאה',
  space: 'מרחב',
  member: 'חבר/ה',
  notification_campaign: 'משלוח התראה',
  content: 'תוכן',
  escalation: 'פנייה למנהל־על',
};

/** Hebrew for the keys the state payloads use. */
const STATE_KEYS_HE: Readonly<Record<string, string>> = {
  status: 'סטטוס',
  suspended: 'מושעה',
  capability: 'הרשאה',
  active: 'פעילה',
  hidden: 'מוסתר',
  flagged: 'מסומן',
  paymentId: 'מזהה חיוב',
  amountAgorot: 'סכום באגורות',
};

const YES_HE = 'כן';
const NO_HE = 'לא';

const stateValue = (key: string, value: unknown): string => {
  if (typeof value === 'boolean') return value ? YES_HE : NO_HE;
  if (key === 'capability' && typeof value === 'string') {
    return CAPABILITY_LABELS_HE[value as keyof typeof CAPABILITY_LABELS_HE] ?? value;
  }
  if (value === null || value === undefined) return '—';
  return String(value);
};

/**
 * A state payload as one readable line. Nothing is dropped — this is the
 * record of what changed, and a summary that omits a field is a summary of a
 * different event. Long ones clamp and open in the row expansion.
 */
const describeState = (payload: unknown): string => {
  if (payload === null || payload === undefined) return '—';
  if (typeof payload !== 'object') return String(payload);

  const entries = Object.entries(payload as Record<string, unknown>);
  if (entries.length === 0) return '—';

  return entries
    .map(([key, value]) => `${STATE_KEYS_HE[key] ?? key}: ${stateValue(key, value)}`)
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
  locale: string;
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

/** Cursors are base64url, so `~` cannot occur inside one. */
const TRAIL_SEPARATOR = '~';

export const encodeTrail = (trail: readonly string[]): string =>
  trail.join(TRAIL_SEPARATOR);

export const decodeTrail = (raw: string | null): string[] =>
  raw ? raw.split(TRAIL_SEPARATOR).filter((part) => part.length > 0) : [];

export function AuditClient({
  spaceId,
  locale,
  filter,
  actor,
  cursor,
  trail,
  state,
}: AuditClientProps) {
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
        body={ERROR_HE}
        onRetry={() => startTransition(() => router.refresh())}
      />
    );
  }

  const { spaceName, rows, nextCursor, truncated } = state;

  const filtering = filter !== DEFAULT_AUDIT_FILTER || actor !== null;

  const filters = (
    <div className={styles.filters}>
      <div className={styles.chips} role="group" aria-label="סינון לפי סוג פעולה">
        {AUDIT_FILTERS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            className={clsx(styles.chip, chip.value === filter && styles.chipActive)}
            aria-pressed={chip.value === filter}
            onClick={() => go({ filter: chip.value, cursor: null, trail: [] })}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <PressSelect
        className={styles.actorFilter}
        label={ACTOR_LABEL}
        placeholder={ACTOR_PLACEHOLDER}
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
            {CLEAR_FILTERS}
          </NewsButton>
        </div>
      ) : null}
    </div>
  );

  const columns: readonly PressTableColumn<AuditRow>[] = [
    {
      key: 'when',
      header: 'מתי',
      primary: true,
      cell: (row) => (
        <span className={styles.mono}>
          {new Date(row.createdAt).toLocaleString('he-IL', {
            dateStyle: 'short',
            timeStyle: 'short',
          })}
        </span>
      ),
    },
    {
      key: 'who',
      header: 'מי',
      secondary: true,
      cell: (row) => (
        <ClampedText lines={1} title={row.actorDisplayName}>
          {row.actorDisplayName}
        </ClampedText>
      ),
    },
    {
      key: 'action',
      header: 'פעולה',
      cell: (row) => (
        <span className={styles.mono}>
          {ACTION_LABELS_HE[row.action] ?? (
            <span dir="ltr" className={styles.latin}>
              {row.action}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'object',
      header: 'אובייקט',
      secondary: true,
      cell: (row) => {
        const label = OBJECT_LABELS_HE[row.objectType] ?? row.objectType;
        if (row.objectId === null) return <span className={styles.mono}>{label}</span>;

        // A decided proposal is reachable from its own log row. The deep link
        // forces the proposals surface to show everything before expanding,
        // which is what keeps a rejected proposal from silently failing to
        // open under that surface's default filter.
        if (row.objectType === 'vote') {
          return (
            <Link
              className={styles.objectLink}
              href={`/${locale}/space-admin/${spaceId}/proposals?proposal=${row.objectId}`}
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
      header: 'ממצב → למצב',
      secondary: true,
      cell: (row) => (
        <span className={styles.transition}>
          <ClampedText lines={2}>{describeState(row.priorState)}</ClampedText>
          <span aria-hidden>→</span>
          <ClampedText lines={2}>{describeState(row.newState)}</ClampedText>
        </span>
      ),
    },
    {
      key: 'reason',
      header: 'נימוק',
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
                'הסתר'
              ) : (
                <>
                  <span className={styles.wideLabel}>הצג נימוק מלא</span>
                  <span className={styles.narrowLabel}>הצג פרטים</span>
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
        <dt>מי</dt>
        <dd>{row.actorDisplayName}</dd>

        <dt>אובייקט</dt>
        <dd>
          {OBJECT_LABELS_HE[row.objectType] ?? row.objectType}
          {row.objectId ? (
            <>
              {' '}
              <span dir="ltr" className={styles.latin}>
                {row.objectId}
              </span>
            </>
          ) : null}
        </dd>

        <dt>ממצב</dt>
        <dd>{describeState(row.priorState)}</dd>

        <dt>למצב</dt>
        <dd>{describeState(row.newState)}</dd>
      </dl>
    </div>
  );

  const empty = rows.length === 0;

  return (
    <>
      {filters}

      {empty && !filtering ? (
        <EmptyPanel heading={EMPTY_HEADING} body={EMPTY_BODY} />
      ) : empty ? (
        <EmptyPanel
          heading={NO_RESULTS_HEADING}
          body={NO_RESULTS_BODY}
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
              {CLEAR_FILTERS}
            </NewsButton>
          }
        />
      ) : (
        <>
          <PressTable
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            description={`יומן הפעולות של המרחב ${spaceName}, מהחדש לישן. כל שורה כוללת מועד, מבצע/ת הפעולה, סוג הפעולה, האובייקט, המעבר בין המצבים והנימוק.`}
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
              olderHint: OLDEST_HINT,
              newerHint: NEWEST_HINT,
              meta: `מוצגות ${rows.length} רשומות`,
            }}
          />

          {truncated ? (
            <p className={styles.truncation}>
              מוצגות {rows.length} הרשומות האחרונות. לרשומות ישנות יותר — המשיכו
              בדפדוף.
            </p>
          ) : null}
        </>
      )}
    </>
  );
}
