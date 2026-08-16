/**
 * Barrel for the space-admin primitives - OWNED BY PLAN 05-11 AND CLOSED.
 *
 * It exports exactly the eight components that plan built. Plans 05-12 through
 * 05-15 create five more (`CapabilityManifest`, `AudiencePreview`,
 * `QuotaBlock`, `ProposalDetailPanel`, …) and must NOT reopen this file: they
 * run in the same or an adjacent wave and would collide on it. Import those by
 * direct path instead - `@/components/space-admin/QuotaBlock`.
 *
 * `confirmButtonClass` is exported alongside the components because the
 * disabled-state contract (D17/D27) has to reach the other two permitted
 * `disabled` controls outside this file - the dispatch send button, and any
 * surface-level pagination that does not go through `PressTable`.
 *
 * 05-15 added `rowFlashClass` / `ROW_FLASH_MS` for the same reason and under
 * the same rule, not as an exception to it: they are new exports of
 * `PressTable`, which this barrel already owns, and the closure above is about
 * the FIVE COMPONENTS created by 05-12 through 05-15 (those stay out and are
 * imported by direct path). The wave collision that motivated the closure is
 * also over - every one of those plans has landed.
 */

export { SpaceAdminHeader } from './SpaceAdminHeader';
export type { SpaceAdminHeaderProps } from './SpaceAdminHeader';

export { SpaceAdminNav, SPACE_ADMIN_NAV_ITEMS } from './SpaceAdminNav';
export type { SpaceAdminNavProps, SpaceAdminNavHref } from './SpaceAdminNav';

export {
  PressTable,
  ShortId,
  ClampedText,
  rowFlashClass,
  ROW_FLASH_MS,
} from './PressTable';
export type {
  PressTableProps,
  PressTableColumn,
  PressTablePagination,
} from './PressTable';

export { StatusChip } from './StatusChip';
export type { StatusChipProps, StatusChipTone } from './StatusChip';

export {
  ConfirmDialog,
  confirmButtonClass,
  disabledButtonClass,
  REASON_MIN_LENGTH,
  REASON_MAX_LENGTH,
} from './ConfirmDialog';
export type { ConfirmDialogProps } from './ConfirmDialog';

export { EmptyPanel, ErrorPanel, NoPermissionPanel } from './Panels';
export type {
  EmptyPanelProps,
  ErrorPanelProps,
  NoPermissionPanelProps,
} from './Panels';
