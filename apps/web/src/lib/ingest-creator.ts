/**
 * Who owns a machine-written topic.
 *
 * `POST /api/ingest/topics` files every discovery-fleet topic under one
 * editorial system user rather than under a resident, because no resident
 * wrote it. Two places need to recognise that identity and they must not each
 * carry their own copy of it: the ingest route, which sets it, and the review
 * decision, which must NOT bill it (`decide-proposal.ts` charges the ₪50
 * creation fee to the submitter, and the desk user is a synthetic account with
 * no payment method and nothing to bill).
 *
 * Resolved per call rather than captured at module load: the id is
 * environment-dependent, and a constant frozen at import time is only correct
 * if every consumer happens to be imported after the environment is set.
 */

/** The seeded desk user - `apps/web/scripts/seed-consensus-desk.mjs`. */
export const DEFAULT_INGEST_CREATOR_ID = '99999999-9999-4999-8999-999999999999';

/** The account discovery-created votes are filed under. */
export function ingestCreatorId(): string {
  return process.env.INGEST_CREATOR_ID ?? DEFAULT_INGEST_CREATOR_ID;
}

/**
 * Was this proposal written by the discovery fleet rather than by a resident?
 *
 * The only question the fee exemption asks. Deliberately identity-based and
 * not, say, a column on `votes`: the identity is what the ingest route already
 * writes, so there is no second fact to keep in sync and no migration needed to
 * start asking.
 */
export function isEditorialSubmission(creatorId: string): boolean {
  return creatorId === ingestCreatorId();
}
