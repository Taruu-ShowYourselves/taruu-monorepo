/**
 * Rollout gate for the operator MFA reset (Issue #71, canonical §12).
 *
 * DEFAULT OFF (`=== 'true'`, inverted from the default-ON house idiom - see
 * mfa-enrollment.ts). Gates /api/security/admin/mfa-reset and its admin UI.
 * Rollout precondition (§16 M8 step 3): every reset-capable operator must be
 * MFA-enrolled before this turns on.
 */
export function isOperatorResetEnabled(): boolean {
  return process.env.OPERATOR_RESET_ENABLED === 'true';
}
