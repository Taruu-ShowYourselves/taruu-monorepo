import 'server-only';

/**
 * Escalation to a platform admin — SPACE-09's real path, and the one action in
 * the dashboard that is deliberately not capability-gated.
 *
 * Escalation is reachable by a suspended admin and by a user holding nothing.
 * Gating it on a capability would put the control out of reach of exactly the
 * people who need it. It is rate-limited per user instead, and is exempt from
 * the per-space notification quota.
 *
 * RULE 1 — It writes ONLY to `platform_escalations`. It never appends a row to
 * the target space's audit log. That log is append-only and enforced by a
 * trigger, so an endpoint any authenticated user can reach would let anyone
 * permanently append rows to an arbitrary space's history at five an hour,
 * with no path to ever clean them up. Escalations are platform correspondence,
 * not space governance events; they belong in the platform table. This is why
 * the phase's action vocabulary has no `escalation.raised` member — the absence
 * is a decision, not an oversight.
 *
 * RULE 2 — Its response is a single opaque acknowledgement, identical in every
 * case: whether the space exists or not, whether the caller is a member or
 * not, whether they are suspended or not, and whether the id is a well-formed
 * uuid or garbage. There is NO branch observable to the caller. Distinguishing
 * an existing foreign space from a nonexistent one would contradict 05-04's
 * rule that malformed, nonexistent, unauthorised and suspended all answer
 * alike, and SPACE-03's "no data disclosed in the error".
 *
 * The ordering below is what makes Rule 2 true. Membership is attempted once
 * and any failure folds to `null` — the error is never inspected, the space is
 * never looked up separately, and the id's shape is never branched on. Because
 * `platform_escalations.space_id` is nullable against a non-null
 * `raw_space_id`, the insert then succeeds in every one of those cases, so
 * there is no status code and no code path by which they can be told apart.
 *
 * A platform admin triaging the queue sees the resolved space where there was
 * one and the caller's raw input always, which is enough to act on a report
 * about a space the reporter is not a member of.
 */

import { ResultAsync } from 'neverthrow';
import type { EscalationRequest } from '@sync/shared/contracts';
import { resolveMembership } from '@/server/app/space-admin/authorize';
import type { AppError } from '@/server/http/errors';
import { insertEscalation } from '@/server/infra/supabase/space-member.repo';
import type { Session } from '@/services/auth/session';

/**
 * The constant acknowledgement. A frozen literal rather than anything derived
 * from the write: echoing the new escalation's id or timestamp would make two
 * responses distinguishable, and the contract this endpoint has to keep is that
 * they are not. The UI announces `הפנייה נשלחה…` off the 202, not off a body.
 */
export const ESCALATION_ACKNOWLEDGEMENT = { accepted: true } as const;

export type EscalationAcknowledgement = typeof ESCALATION_ACKNOWLEDGEMENT;

/** Accepted, therefore 202 — the platform admin has not read it yet. */
export const ESCALATION_STATUS = 202;

export function raiseEscalation(
  session: Session,
  rawSpaceId: string,
  command: EscalationRequest
): ResultAsync<EscalationAcknowledgement, AppError> {
  const resolvedSpaceId: Promise<string | null> = resolveMembership(session, rawSpaceId)
    .map((membership): string | null => membership.spaceId)
    .unwrapOr(null);

  return ResultAsync.fromSafePromise(resolvedSpaceId).andThen((spaceId) =>
    insertEscalation({
      spaceId,
      rawSpaceId,
      raisedBy: session.userId,
      body: command.body,
    }).map(() => ESCALATION_ACKNOWLEDGEMENT)
  );
}
