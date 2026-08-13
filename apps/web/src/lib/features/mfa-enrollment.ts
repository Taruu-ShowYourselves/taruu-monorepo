/**
 * Rollout gate for MFA enrollment (Issue #71, canonical §12).
 *
 * DEFAULT OFF - deliberately inverted from the repo's default-ON flag idiom
 * (space-admin.ts's `!== 'false'`): a security surface must not appear
 * because someone forgot to set a variable. Off means the
 * /api/security/mfa/* enrollment routes 404 and every enrollment UI entry is
 * hidden. Already-active factors keep working regardless - the login
 * challenge is governed by the DB enforcement control, not by this flag.
 */
export function isMfaEnrollmentEnabled(): boolean {
  return process.env.MFA_ENROLLMENT_ENABLED === 'true';
}
