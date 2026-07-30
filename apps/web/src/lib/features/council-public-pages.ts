/**
 * Server-side rollout gate. The feature is on by default for the release, and
 * an explicit "false" removes both the page and API without touching the
 * existing municipality profile route.
 */
export function isCouncilPublicPagesEnabled(): boolean {
  return process.env.COUNCIL_PUBLIC_PAGES_ENABLED !== 'false';
}
