/**
 * Space capability vocabulary - pure. The single source of truth for what a
 * grant can say. Roles are presets expanded at grant time; nothing here is
 * ever consulted to decide whether a request is allowed (that is the grant
 * row), and `granted_via_role` is provenance for the UI, never authority.
 *
 * No IO, no framework, no `@/lib` - this module is imported by the HTTP edge,
 * by use-cases, and by tests, and must stay loadable from all three.
 */

/**
 * The closed vocabulary: exactly eleven actions, one per row of the capability
 * manifest in 05-UI-SPEC.md "Surface 1", in that order.
 *
 * Deliberately absent - do not add either:
 *
 * 1. No `space.read` (or any "you may open the dashboard" capability).
 *    Reaching the shell is *membership* - holding at least one grant in the
 *    space - resolved server-side by `resolveMembership()`, not by a twelfth
 *    capability. The UI manifest renders one ✓/✕ row per member of this array,
 *    so a twelfth entry would be a twelfth row the spec does not have.
 *
 * 2. No separate "request changes" capability. `proposal.reject` covers both
 *    `דחייה` (reject) and `החזרה לתיקון` (request changes): both are "decline
 *    to publish", and only `proposal.approve` publishes. The two differ in
 *    where they leave the proposal, not in the authority they require.
 */
export const CAPABILITIES = [
  'proposal.read',
  'proposal.approve',
  'proposal.reject',
  'member.read',
  'member.suspend',
  'grant.create',
  'grant.revoke',
  'content.moderate',
  'metrics.read',
  'notification.send',
  'audit.read',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/** UI capability-manifest labels. Must stay 1:1 with 05-UI-SPEC.md. */
export const CAPABILITY_LABELS_HE: Record<Capability, string> = {
  'proposal.read': 'לבדוק הצעות',
  'proposal.approve': 'לאשר ולפרסם הצעות',
  'proposal.reject': 'לדחות הצעות',
  'member.read': 'לצפות ברשימת החברים',
  'member.suspend': 'להשעות חברים במרחב',
  'grant.create': 'להעניק הרשאות',
  'grant.revoke': 'לשלול הרשאות',
  'content.moderate': 'לנהל תוכן מותר',
  'metrics.read': 'לצפות בנתונים מצטברים',
  'notification.send': 'לשלוח התראות לתושבים',
  'audit.read': 'לצפות ביומן הפעולות',
};

/**
 * Named bundles applied at grant time. A preset is a convenience for the
 * granting admin - it writes N capability rows and stamps each with its
 * provenance. It is never read back to decide authority.
 */
export const ROLE_PRESETS = {
  space_admin: [...CAPABILITIES],
  space_reviewer: [
    'proposal.read',
    'proposal.approve',
    'proposal.reject',
    'member.read',
    'metrics.read',
    'audit.read',
  ],
  space_moderator: [
    'proposal.read',
    'content.moderate',
    'member.read',
    'metrics.read',
    'audit.read',
  ],
  space_communicator: ['member.read', 'metrics.read', 'notification.send', 'audit.read'],
  space_observer: ['metrics.read', 'audit.read'],
} as const satisfies Record<string, readonly Capability[]>;

export type RolePreset = keyof typeof ROLE_PRESETS;

export const ROLE_PRESET_LABELS_HE: Record<RolePreset, string> = {
  space_admin: 'מנהל/ת מרחב',
  space_reviewer: 'בודק/ת הצעות',
  space_moderator: 'מנחה תוכן',
  space_communicator: 'אחראי/ת התראות',
  space_observer: 'צופה',
};

export const expandPreset = (r: RolePreset): readonly Capability[] => ROLE_PRESETS[r];

export const isCapability = (v: string): v is Capability =>
  (CAPABILITIES as readonly string[]).includes(v);
