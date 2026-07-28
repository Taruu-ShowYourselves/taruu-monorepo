/**
 * Location status for the dashboard masthead.
 *
 * The dashboard used to print a hard-coded default town when a user had no
 * municipality, which told anyone without one that they live in Kiryat Tivon.
 * On a civic platform where residency decides whose vote counts, that is a
 * fabricated fact, not a placeholder.
 *
 * The rule is deliberately pure and lives outside the component so the three
 * states can be tested in the existing node test environment — this codebase
 * has no component-testing setup.
 *
 * Every state must leave the reader an action:
 * - `unset`      -> no municipality yet; send them to pick one.
 * - `unverified` -> municipality known, residency not proven; send them to verify.
 * - `verified`   -> nothing to do; show the town and the verified badge.
 */
export type LocationState = 'unset' | 'unverified' | 'verified';

/**
 * Resolve which of the three location states applies.
 *
 * A blank or whitespace-only municipality counts as `unset`: it is not a place,
 * and rendering it would leave an empty slot with no way forward.
 *
 * `verified` is never reported without a municipality. Residency verification
 * is verification *of a municipality*, so that combination is incoherent; if it
 * ever occurs the user still needs to choose a town, and `unset` is the state
 * that tells them so.
 */
export function resolveLocationState(
  municipality: string | null | undefined,
  isVerified: boolean
): LocationState {
  if (!municipality || municipality.trim().length === 0) return 'unset';
  return isVerified ? 'verified' : 'unverified';
}
