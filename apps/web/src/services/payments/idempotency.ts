import { createHash } from 'crypto';
import type { Payment } from '@/lib/supabase/types';

/**
 * Server-side payment idempotency (SEC-04).
 *
 * The key is derived from the request's own identity and NEVER from the clock or
 * from anything the client sent. The expression this replaces fell back to
 * `{userId}-{type}-{voteId|create}-` followed by a millisecond timestamp, which
 * is defective twice over: the client could pin any key it liked, and the clock
 * suffix guaranteed every retry produced a fresh key, so the UNIQUE constraint
 * on payments.idempotency_key never once did its job.
 *
 * Nothing in this module may read a clock or a random source. The unit test in
 * __tests__/services/payment-idempotency.test.ts pins the key's exact shape so a
 * reintroduced timestamp fails the pattern rather than merely the review.
 */

/** How many spent keys to walk before giving up. Bounded so a caller cannot spin. */
export const MAX_IDEMPOTENCY_CHAIN = 4;

export interface IdempotencyInput {
  readonly userId: string;
  readonly type: 'vote_creation';
  /** Present for flows that already have a vote. Creation has neither. */
  readonly voteId?: string | null;
  readonly optionId?: string | null;
  /** The creation draft's title - the only thing distinguishing two creations by one user. */
  readonly voteTitle?: string | null;
}

function shortHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

/**
 * `{userId}:{type}:{scope}` per SEC-04.
 *
 * `scope` is the vote or option when the flow has one. A CREATION request has
 * neither - the vote does not exist until the payment settles - so the scope is
 * a hash of the draft title. That keeps two different drafts distinct while
 * making a double-submitted identical draft collapse to one payment.
 */
export function derivePaymentIdempotencyKey(input: IdempotencyInput): string {
  const scope = input.voteId ?? input.optionId ?? shortHash(input.voteTitle ?? '');
  return `${input.userId}:${input.type}:${scope}`;
}

/**
 * The next key after a SPENT one.
 *
 * A completed or failed payment means this key is used up, but the user may
 * legitimately be creating another vote with the same title. Chaining off the
 * spent payment's id keeps the result deterministic - a double-submit at this
 * point still collapses to a single new payment - without reaching for a clock.
 */
export function deriveRetryKey(baseKey: string, spentPaymentId: string): string {
  return `${baseKey}:r${shortHash(`${baseKey}:${spentPaymentId}`)}`;
}

export type IdempotencyResolution =
  | { readonly kind: 'reuse'; readonly key: string; readonly existing: Payment }
  | { readonly kind: 'fresh'; readonly key: string }
  | { readonly kind: 'exhausted' };

/**
 * Walk the chain until we find an unused key, a reusable pending payment, or the bound.
 * `lookup` is injected so this is testable without a database.
 */
export async function resolveIdempotencyKey(
  lookup: (key: string) => Promise<Payment | null>,
  input: IdempotencyInput
): Promise<IdempotencyResolution> {
  let key = derivePaymentIdempotencyKey(input);

  for (let hop = 0; hop < MAX_IDEMPOTENCY_CHAIN; hop++) {
    const existing = await lookup(key);
    if (!existing) return { kind: 'fresh', key };
    if (existing.status === 'pending') return { kind: 'reuse', key, existing };
    key = deriveRetryKey(key, existing.id);
  }

  return { kind: 'exhausted' };
}
