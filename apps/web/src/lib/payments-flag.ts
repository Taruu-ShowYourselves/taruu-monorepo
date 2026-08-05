/**
 * The one switch that turns money on.
 *
 * Provider approval has not come through, so nothing in this product may open a
 * payment. Rather than deleting the rails (they are built, tested and correct),
 * every entry point asks this module first. Turning payments back on is a
 * one-line change: set NEXT_PUBLIC_PAYMENTS_ENABLED=true and rebuild.
 *
 * Why NEXT_PUBLIC_: the vote-creation page is a client component and must render
 * its coming-soon state on first paint, with no round trip. That prefix is also
 * why this file must stay a boring string comparison - the value is public by
 * construction and carries no secret.
 *
 * Fail-closed by definition: ONLY the exact string 'true' enables payments.
 * Absent, empty, '1', 'TRUE', 'yes' - all OFF. The flag is cosmetic on the
 * client; the server routes are the enforcement point.
 *
 * DEPENDENCY-FREE ON PURPOSE. `lib/env.ts` imports this, and `worker.ts` imports
 * `lib/env.ts` before the Next.js bundle boots (see env-contract.test.ts).
 */

/** The single name. Exported so the env schema and the tests cannot drift from it. */
export const PAYMENTS_ENABLED_VAR = 'NEXT_PUBLIC_PAYMENTS_ENABLED';

/** The only value that means "on". */
const ENABLED_VALUE = 'true';

/** Machine-readable reason a payment route refused. Stable API contract. */
export const PAYMENTS_DISABLED_CODE = 'PAYMENTS_DISABLED';

/**
 * Hebrew, RTL-correct, user-facing. A resident may see this if a stale client
 * reaches a payment route, so it explains rather than blames.
 */
export const PAYMENTS_DISABLED_MESSAGE =
  'התשלומים עדיין לא נפתחו. אי אפשר לבצע תשלום כרגע - ההשתתפות בהצבעות פתוחה וחינמית.';

/**
 * Pure: is payments enabled in THIS record?
 *
 * Used by `checkRuntimeEnv`, which runs against the Cloudflare `env` binding
 * rather than `process.env`, and by the tests.
 */
export function paymentsEnabledIn(source: Record<string, unknown>): boolean {
  return source[PAYMENTS_ENABLED_VAR] === ENABLED_VALUE;
}

/**
 * Is payments enabled in this process?
 *
 * The literal `process.env.NEXT_PUBLIC_PAYMENTS_ENABLED` member access is
 * deliberate and MUST NOT be refactored into a dynamic lookup: Next.js only
 * inlines a NEXT_PUBLIC_* variable into the client bundle when it can see the
 * literal expression at build time. A computed key would silently read
 * `undefined` in the browser - which fails closed, but for the wrong reason.
 */
export function paymentsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === ENABLED_VALUE;
}
