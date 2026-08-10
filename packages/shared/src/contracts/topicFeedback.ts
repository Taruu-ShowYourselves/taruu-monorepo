/**
 * Topic feedback — what a reader says about a topic instead of voting on it.
 *
 * The desk offers three gestures on a tile: right is בעד, left is נגד, and
 * down is neither. Down means "this is not a matter of consensus" — a
 * judgement about whether the question belongs on the desk at all, which is a
 * different kind of claim from a ballot and is deliberately not stored as one.
 * It never enters a tally, never costs a point, and never appears in a result.
 *
 * It is a signal to whoever curates the desk, and its only public shape is a
 * count.
 */

import { z } from 'zod';

/**
 * Why a topic was set aside.
 *
 * A single free-text box would collect prose nobody reads and personal detail
 * nobody asked for. A closed list is answerable at a glance and carries no
 * identifying content by construction.
 */
export const SetAsideReasonSchema = z.enum([
  /** Belongs to a council, a court or a ministry — not to a public vote. */
  'not_consensus',
  /** Already settled, or overtaken by events. */
  'already_decided',
  /** The question is unclear or badly put. */
  'unclear',
  /** Not this reader's authority, or not their business. */
  'not_my_authority',
]);

export type SetAsideReason = z.infer<typeof SetAsideReasonSchema>;

/** What the tile submits. The topic comes from the route, the reader from the session. */
export const SetTopicAsideSchema = z.object({
  reason: SetAsideReasonSchema,
});

export type SetTopicAside = z.infer<typeof SetTopicAsideSchema>;

/**
 * What comes back. A count and the caller's own standing — never a roster of
 * who set what aside, which is not a public fact about anybody.
 */
export const TopicAsideStandingSchema = z.object({
  topicId: z.string().uuid(),
  asideCount: z.number().int().nonnegative(),
  /** The caller's own reason, or null if they have not set this topic aside. */
  ownReason: SetAsideReasonSchema.nullable(),
});

export type TopicAsideStanding = z.infer<typeof TopicAsideStandingSchema>;
