/**
 * Server-side rollout gate for the space-admin dashboard (issue #75).
 * On by default; SPACE_ADMIN_ENABLED=false removes the routes and the pages
 * without touching the governance tables or any audit history.
 */
export function isSpaceAdminEnabled(): boolean {
  return process.env.SPACE_ADMIN_ENABLED !== 'false';
}
