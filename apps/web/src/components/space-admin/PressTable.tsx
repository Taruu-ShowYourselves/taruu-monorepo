'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import clsx from 'clsx';
import { NewsButton } from '@/components/press/NewsButton';
import styles from './PressTable.module.css';

/**
 * The post-mutation row flash (Interaction Contract 2), as a class to pass
 * through `rowClassName` — the same shape as `confirmButtonClass`.
 *
 * It lives here rather than in each surface's stylesheet because the members
 * and proposals surfaces each had to rediscover the two traps documented at
 * `.rowFlash` in the stylesheet. Deferred item 8 asks for exactly this.
 */
export const rowFlashClass: string = styles.rowFlash;

/**
 * How long the flash runs, and therefore how long a surface should hold the
 * flashed key before clearing it. Exported alongside the class so the timer
 * and the animation cannot drift apart.
 */
export const ROW_FLASH_MS = 1200;

export interface PressTableColumn<Row> {
  /** Stable key. Emitted as `data-col` on the matched `th`/`td` pair. */
  key: string;
  header: React.ReactNode;
  cell: (row: Row) => React.ReactNode;
  /**
   * Marks the row-header column, rendered as `<th scope="row">`. Exactly one
   * column should set it; the first column is used when none does.
   */
  primary?: boolean;
  /**
   * Hidden below 768px by a paired `display: none` on both `th[data-col]` and
   * `td[data-col]` — never by switching a cell to `display: block`, which
   * destroys table semantics in assistive tech. The value stays reachable
   * through the row disclosure.
   */
  secondary?: boolean;
  /** Keep out of the disclosure definition list (e.g. an actions column). */
  omitFromDetails?: boolean;
}

export interface PressTablePagination {
  onOlder?: () => void;
  onNewer?: () => void;
  /** Disabled on the last page. Pair with `olderHint`. */
  olderDisabled?: boolean;
  /** Disabled on the first page. Pair with `newerHint`. */
  newerDisabled?: boolean;
  /** Visible unblock text — required by Rule B whenever a control is disabled. */
  olderHint?: string;
  newerHint?: string;
  /** e.g. `מוצגות {n} רשומות` or `{n} חברים במרחב`. */
  meta?: React.ReactNode;
}

export interface PressTableProps<Row> {
  columns: readonly PressTableColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  /** Screen-reader `<caption>`. See the UI-SPEC table-caption deck. */
  description: string;
  loading?: boolean;
  skeletonRows?: number;
  /**
   * Replaces the built-in hidden-column disclosure. When supplied the table
   * renders no disclosure button of its own — the caller owns the trigger
   * (the proposals surface uses the title cell) and drives `expandedKey`.
   * There is exactly one `<tr>` expansion per row at every width either way.
   */
  renderExpansion?: (row: Row) => React.ReactNode;
  /**
   * Replaces the built-in expansion `<tr>` ENTIRELY — the caller returns the
   * row itself, so it owns the `<td colSpan>`, its `id`, and therefore the
   * target of its own trigger's `aria-controls`.
   *
   * `renderExpansion` cannot serve that case: its result is placed inside a
   * `<td>` this component owns, and the id of that cell is generated here and
   * never handed out. The proposals surface needs both — its detail panel is a
   * component in its own right and its title-cell button must point at it — so
   * this hook exists for it. Mutually exclusive with `renderExpansion`; still
   * exactly one `<tr>` expansion per row at every width.
   */
  renderExpansionRow?: (row: Row, columnCount: number) => React.ReactNode;
  expandedKey?: string | null;
  onExpandedKeyChange?: (key: string | null) => void;
  /** Extra class on a body `<tr>` — e.g. the post-decision row flash. */
  rowClassName?: (row: Row) => string | undefined;
  pagination?: PressTablePagination;
  className?: string;
}

/** uuid/hash cell: first eight characters, LTR-isolated, full value in `title`. */
export function ShortId({ value, className }: { value: string; className?: string }) {
  return (
    <span dir="ltr" title={value} className={clsx(styles.shortId, className)}>
      {value.slice(0, 8)}…
    </span>
  );
}

/** Line-clamped cell text. Full value belongs in the row expansion. */
export function ClampedText({
  children,
  lines = 2,
  title,
}: {
  children: React.ReactNode;
  lines?: 1 | 2;
  title?: string;
}) {
  return (
    <span title={title} className={lines === 1 ? styles.clamp1 : styles.clamp2}>
      {children}
    </span>
  );
}

/**
 * The RTL data-table contract shared by proposals, members and audit.
 *
 * Semantics are non-negotiable and survive every width: a real `<caption>`,
 * `scope="col"` on every head cell, `scope="row"` on the primary body cell,
 * and a labelled focusable scroll region applied ONLY when the table actually
 * overflows — an unconditional `tabindex` is a pointless tab stop.
 */
export function PressTable<Row>({
  columns,
  rows,
  rowKey,
  description,
  loading = false,
  skeletonRows = 5,
  renderExpansion,
  renderExpansionRow,
  expandedKey,
  onExpandedKeyChange,
  rowClassName,
  pagination,
  className,
}: PressTableProps<Row>) {
  const captionId = useId();
  const expansionIdBase = useId();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [internalExpanded, setInternalExpanded] = useState<string | null>(null);

  const isControlled = onExpandedKeyChange !== undefined;
  const expanded = isControlled ? (expandedKey ?? null) : internalExpanded;

  const toggleExpanded = useCallback(
    (key: string) => {
      const next = expanded === key ? null : key;
      if (isControlled) onExpandedKeyChange?.(next);
      else setInternalExpanded(next);
    },
    [expanded, isControlled, onExpandedKeyChange],
  );

  const columnCount = columns.length;
  const rowCount = rows.length;

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const measure = () => setOverflowing(el.scrollWidth > el.clientWidth);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    const table = el.firstElementChild;
    if (table) observer.observe(table);
    return () => observer.disconnect();
  }, [columnCount, rowCount, loading]);

  const primaryColumn = columns.find((column) => column.primary) ?? columns[0];
  const detailColumns = columns.filter(
    (column) => column.secondary && !column.omitFromDetails,
  );
  const hasAutoDisclosure =
    !renderExpansion && !renderExpansionRow && detailColumns.length > 0;

  const scrollerA11y = overflowing
    ? ({ role: 'region', 'aria-labelledby': captionId, tabIndex: 0 } as const)
    : {};

  return (
    <div className={clsx(styles.wrap, className)} aria-busy={loading || undefined}>
      <p className={styles.srOnly} aria-live="polite">
        {loading ? '…טוען' : ''}
      </p>

      <div ref={scrollerRef} className={styles.scroller} {...scrollerA11y}>
        <table className={styles.table}>
          <caption id={captionId} className={styles.srOnly}>
            {description}
          </caption>

          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  data-col={column.key}
                  data-secondary={column.secondary ? 'true' : undefined}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading
              ? Array.from({ length: skeletonRows }, (_, index) => (
                  <tr key={`skeleton-${index}`} className={styles.skeletonRow}>
                    {columns.map((column) => {
                      const bar = <span className={styles.skeletonBar} />;
                      return column === primaryColumn ? (
                        <th
                          key={column.key}
                          scope="row"
                          data-col={column.key}
                          data-secondary={column.secondary ? 'true' : undefined}
                        >
                          {bar}
                        </th>
                      ) : (
                        <td
                          key={column.key}
                          data-col={column.key}
                          data-secondary={column.secondary ? 'true' : undefined}
                        >
                          {bar}
                        </td>
                      );
                    })}
                  </tr>
                ))
              : rows.map((row) => {
                  const key = rowKey(row);
                  const isExpanded = expanded === key;
                  const expansionId = `${expansionIdBase}-${key}`;

                  return (
                    <React.Fragment key={key}>
                      <tr className={rowClassName?.(row)}>
                        {columns.map((column) => {
                          const content = column.cell(row);
                          if (column !== primaryColumn) {
                            return (
                              <td
                                key={column.key}
                                data-col={column.key}
                                data-secondary={column.secondary ? 'true' : undefined}
                              >
                                {content}
                              </td>
                            );
                          }
                          return (
                            <th
                              key={column.key}
                              scope="row"
                              data-col={column.key}
                              data-secondary={column.secondary ? 'true' : undefined}
                            >
                              {content}
                              {hasAutoDisclosure ? (
                                <button
                                  type="button"
                                  className={styles.detailsToggle}
                                  aria-expanded={isExpanded}
                                  aria-controls={isExpanded ? expansionId : undefined}
                                  onClick={() => toggleExpanded(key)}
                                >
                                  {isExpanded ? 'הסתר' : 'הצג פרטים'}
                                  <span aria-hidden>{isExpanded ? ' ▴' : ' ▾'}</span>
                                </button>
                              ) : null}
                            </th>
                          );
                        })}
                      </tr>

                      {isExpanded && renderExpansionRow ? (
                        renderExpansionRow(row, columnCount)
                      ) : isExpanded ? (
                        <tr
                          className={clsx(
                            styles.expansionRow,
                            hasAutoDisclosure && styles.autoExpansionRow,
                          )}
                        >
                          <td id={expansionId} colSpan={columnCount}>
                            {renderExpansion ? (
                              renderExpansion(row)
                            ) : (
                              <dl className={styles.details}>
                                {detailColumns.map((column) => (
                                  <React.Fragment key={column.key}>
                                    <dt>{column.header}</dt>
                                    <dd>{column.cell(row)}</dd>
                                  </React.Fragment>
                                ))}
                              </dl>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })}
          </tbody>
        </table>
      </div>

      {overflowing ? (
        <p className={styles.scrollHint}>החליקו לצדדים לצפייה בכל העמודות</p>
      ) : null}

      {pagination ? (
        <div className={styles.pagination}>
          <div className={styles.pageControl}>
            <NewsButton
              variant="outline"
              size="sm"
              className={styles.pageBtn}
              onClick={pagination.onOlder}
              disabled={pagination.olderDisabled}
            >
              <span aria-hidden>← </span>
              רשומות ישנות יותר
            </NewsButton>
            {pagination.olderDisabled && pagination.olderHint ? (
              <p className={styles.pageHint}>{pagination.olderHint}</p>
            ) : null}
          </div>

          {pagination.meta ? <p className={styles.pageMeta}>{pagination.meta}</p> : null}

          <div className={styles.pageControl}>
            <NewsButton
              variant="outline"
              size="sm"
              className={styles.pageBtn}
              onClick={pagination.onNewer}
              disabled={pagination.newerDisabled}
            >
              רשומות חדשות יותר
              <span aria-hidden> →</span>
            </NewsButton>
            {pagination.newerDisabled && pagination.newerHint ? (
              <p className={styles.pageHint}>{pagination.newerHint}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
