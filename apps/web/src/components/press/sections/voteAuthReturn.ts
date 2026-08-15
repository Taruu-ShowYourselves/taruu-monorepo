/**
 * Where a guest lands once the sign-in round-trip is over.
 *
 * Boundary-free, like `voteSwipe`: the gate is a client component and this is
 * the one decision in it that is worth reasoning about on its own - a wrong
 * target here does not look broken, it quietly loses the thing the reader
 * just said.
 */

import { localePrefix, type Locale } from '@/lib/i18n';
import { safeRedirect } from '@/lib/safeRedirect';
import type { SwipeIntent } from './voteSwipe';

export interface VoteReturn {
  intent: SwipeIntent;
  voteId: string;
  /** The ballot option the side maps to; absent for `aside`. */
  optionId?: string;
  /** Where the reader is standing now - the desk they pushed the tile on. */
  currentPath: string;
}

/**
 * A side carries a ballot, so it returns to that vote with the choice already
 * made: `?option=` is the same deep link the ballot restores after any
 * detour, and it opens on the confirmation step rather than on a question the
 * reader has already answered.
 *
 * Setting a topic aside is not a ballot and has nowhere else to be, so it
 * comes back to the desk it was read on.
 *
 * The result is always a same-origin path, never an absolute URL: it is handed
 * to the OAuth callback, which passes it through `safeRedirect`, and a target
 * that would be rejected there is a target that silently becomes the
 * dashboard. The desk's own path is the one value here that is not built from
 * constants, so it goes through the same guard on the way in rather than
 * being trusted because it usually comes from `location.pathname`.
 */
export function voteReturnPath(
  { intent, voteId, optionId, currentPath }: VoteReturn,
  locale: Locale
): string {
  if (intent === 'aside' || !optionId) {
    return safeRedirect(currentPath, localePrefix(locale) || '/');
  }
  return `${localePrefix(locale)}/votes/${voteId}?option=${encodeURIComponent(optionId)}`;
}
