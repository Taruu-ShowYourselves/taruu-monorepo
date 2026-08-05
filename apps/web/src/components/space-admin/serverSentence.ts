/**
 * When an error response body may be shown to the admin as-is.
 *
 * The dashboard's surfaces disagreed about this. 05-13's proposals surface
 * renders the response body's `error` on any failure it does not otherwise
 * handle, so a 409 says exactly what conflicted; 05-14's members surface
 * flattened every failure to one generic line, so an admin suspending an
 * already-suspended member was told `הפעולה לא בוצעה ולא נרשמה ביומן` — which
 * is not merely vaguer than what the server said, it is wrong: the state they
 * asked for already exists and the earlier action *is* in the log.
 *
 * Rendering the body unconditionally is not the fix either. `toHttp` in
 * `server/http/errors.ts` is the whole vocabulary, and only two of its variants
 * are guaranteed to carry a Hebrew sentence:
 *
 *   CONFLICT (409)         — `conflict(reason)` requires the reason.
 *   PAYMENT_REQUIRED (402) — `paymentInvalid(reason)` requires the reason.
 *   FORBIDDEN (403)        — `forbidden(reason?)`: OPTIONAL. Without one the
 *                            body is the English literal `Forbidden`.
 *
 * Everything else is structural English: `Unauthorized`, `Invalid request`,
 * `Quota exceeded`, `Internal server error`, `{entity} not found`. Printing
 * any of those into a Hebrew dialog is a worse failure than a generic line,
 * because it reads as a crash rather than as an answer.
 *
 * So: return a sentence only when the code guarantees one, and let the caller
 * supply its own surface-appropriate fallback otherwise.
 */

/** The one 403 body that is not a sentence. Mirrors `toHttp`'s FORBIDDEN arm. */
const FORBIDDEN_DEFAULT = 'Forbidden';

interface ErrorBody {
  error?: unknown;
  code?: unknown;
}

export function serverSentence(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;

  const { error, code } = payload as ErrorBody;
  if (typeof error !== 'string' || error.length === 0) return null;

  if (code === 'CONFLICT' || code === 'PAYMENT_REQUIRED') return error;
  if (code === 'FORBIDDEN' && error !== FORBIDDEN_DEFAULT) return error;

  return null;
}
