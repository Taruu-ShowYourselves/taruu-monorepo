/**
 * Public-statistics disclosure policy.
 *
 * Aggregate figures are safe to publish only while the cohort behind them is
 * large enough that no individual can be inferred from it. These constants live
 * outside the route handlers so the policy is stated in one place and can be
 * imported by tests - Next.js route files should export nothing but their HTTP
 * handlers and the framework's own config keys.
 */

/**
 * Smallest municipality cohort we are willing to publish a registration count
 * for.
 *
 * "3 people registered in your town" is a statistic. "1 person registered in
 * your town" is a statement about a specific person, to anyone who knows the
 * town. Below this threshold the figure is withheld rather than rounded or
 * zeroed - a withheld number is honest, a massaged one is not.
 */
export const MUNICIPALITY_MIN_COHORT = 5;

/** Guard against absurd input reaching a count query. */
export const MAX_MUNICIPALITY_LENGTH = 120;
