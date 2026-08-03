import type { Capability } from '@sync/shared/contracts';
import type { SpaceAdminNavHref } from './SpaceAdminNav';

/**
 * The two maps every space-admin surface needs above its own content: which
 * capability opens which surface, and how a `spaces.type` value is written in
 * Hebrew on the edition line.
 *
 * They live together because they are one concern — the shell that wraps a
 * surface — and they live here rather than in each page because by the time
 * 05-15 opened there were FOUR copies of each (the overview, proposals,
 * members and statistics surfaces), and this plan's two surfaces would have
 * made six. Deferred items 9 and 11 assign the extraction here.
 *
 * The four copies were not identical, which is the argument for the module
 * rather than against it. Two of them wrote `urban_area` as `אזור עירוני` and
 * two as `מרחב עירוני`, and their fallbacks disagreed as well. Both are
 * reconciled below, deliberately and once.
 *
 * Not in the barrel (`index.ts`), by 05-11's rule: import it by direct path.
 */

/**
 * Rule A, presentation half: a surface the admin holds no capability for gets
 * no nav link. The route still re-resolves the capability server-side on every
 * request, so this hides a link — it does not protect anything.
 *
 * The overview has no entry because it needs no capability: reaching the shell
 * is membership, which `getSpaceOverview` has already resolved by the time
 * anything here is called.
 */
export const NAV_CAPABILITY: Readonly<
  Record<Exclude<SpaceAdminNavHref, ''>, Capability>
> = {
  proposals: 'proposal.read',
  members: 'member.read',
  stats: 'metrics.read',
  dispatch: 'notification.send',
  audit: 'audit.read',
};

/**
 * The nav hrefs this viewer may see, in surface order, overview always first.
 *
 * `Object.keys` on a `Readonly<Record<…>>` is only sound because the record is
 * a literal declared in this file with the union's five members present; the
 * `Exclude<…>` annotation on `NAV_CAPABILITY` is what makes adding a surface
 * to `SpaceAdminNavHref` without adding it here a compile error.
 */
export const visibleNavHrefs = (
  capabilities: readonly Capability[],
): SpaceAdminNavHref[] => {
  const held = new Set<Capability>(capabilities);
  return [
    '',
    ...(Object.keys(NAV_CAPABILITY) as Array<Exclude<SpaceAdminNavHref, ''>>).filter(
      (href) => held.has(NAV_CAPABILITY[href]),
    ),
  ];
};

/**
 * Hebrew for the five values the `spaces.type` CHECK admits today. The
 * contract keeps `type` a plain string because the DDL owns the list and issue
 * #74 adds to it, so this map is deliberately partial and open.
 *
 * `urban_area` is `אזור עירוני`, not `מרחב עירוני`. `מרחב` is the copy deck's
 * word for "space" itself, so using it inside a space *type* label makes the
 * edition line read "space: urban space". `אזור` is also the literal reading of
 * "area". Two of the four surfaces already wrote it this way.
 */
export const SPACE_TYPE_LABELS_HE: Readonly<Record<string, string>> = {
  municipality: 'רשות מקומית',
  national: 'מרחב ארצי',
  organization: 'ארגון',
  urban_area: 'אזור עירוני',
  nationwide_civic: 'מרחב אזרחי ארצי',
};

/**
 * An unmapped type falls back to a Hebrew generic, never to the stored value.
 * Two of the four copies returned `space.type` itself, which would print
 * `urban_area` on the edition line the first time #74 adds a type — a bug on
 * screen in a Hebrew-only product, and a slower one to notice than a blank.
 */
export const spaceTypeLabel = (type: string): string =>
  SPACE_TYPE_LABELS_HE[type] ?? 'מרחב';
