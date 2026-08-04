/**
 * Vote-creation checkout decisions, extracted so they can be tested.
 *
 * The create page used to treat "200 with no checkout URL" as a SUCCESS and
 * render a receipt sealed with a randomly generated hex string - for a vote
 * that was never POSTed to /api/votes. That is the same defect Phase 02.1
 * removed from the participation funnel. Here, a missing checkout URL is an
 * error. There is no success path that does not go through Green Invoice.
 *
 * This repo's vitest runs `environment: 'node'` with a `.ts`-only include glob,
 * so logic left inside the `.tsx` pages cannot be tested at all. `fetch` is
 * injected for the same reason. Nothing here touches the browser: the draft
 * stash and the redirect itself stay in the components.
 */

/** Hebrew, user-facing. A gateway string must never reach a user. */
export const CHECKOUT_ERROR_MESSAGE = 'משהו השתבש אצלנו, לא אצלכם. נסו שוב בעוד רגע.';
export const CHECKOUT_UNAVAILABLE_MESSAGE = 'התשלום אינו זמין כרגע. נסו שוב בעוד רגע.';

export interface CheckoutPayment {
  readonly id: string;
  readonly orderId?: string;
  readonly paymentUrl: string;
}

export type CheckoutStart =
  | { readonly kind: 'redirect'; readonly payment: CheckoutPayment }
  | { readonly kind: 'error'; readonly message: string };

export interface CheckoutDeps {
  readonly fetch: typeof globalThis.fetch;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * A checkout is usable only when the server issued BOTH a hosted-form URL and
 * the payment id. The id becomes `paymentTxId` on the finalisation POST, and
 * without it `assertPaymentUsable` can never match the settled payment - the
 * resident would be charged and no vote would ever publish.
 */
function readCheckoutPayment(payload: unknown): CheckoutPayment | null {
  if (!isRecord(payload)) return null;
  const payment: unknown = payload.payment;
  if (!isRecord(payment)) return null;
  if (!isNonEmptyString(payment.paymentUrl) || !isNonEmptyString(payment.id)) return null;

  return {
    id: payment.id,
    orderId: isNonEmptyString(payment.orderId) ? payment.orderId : undefined,
    paymentUrl: payment.paymentUrl,
  };
}

/** Diagnostics only - never rendered. */
function readServerError(payload: unknown): string {
  if (isRecord(payload) && isNonEmptyString(payload.error)) return payload.error;
  return 'no error field';
}

function checkoutError(message: string): CheckoutStart {
  return { kind: 'error', message };
}

/**
 * Ask the server to open a Green Invoice hosted form for the ₪50 creation fee.
 *
 * The body is exactly `{ type, voteTitle }`. It never carries an idempotency
 * key: the server derives one, because a client-supplied key is precisely what
 * SEC-04 forbids.
 */
export async function startVoteCreationCheckout(
  deps: CheckoutDeps,
  input: { readonly voteTitle: string }
): Promise<CheckoutStart> {
  let response: Response;
  try {
    response = await deps.fetch('/api/payments/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ type: 'vote_creation', voteTitle: input.voteTitle }),
    });
  } catch (error) {
    console.error('Vote-creation checkout could not reach the server:', error);
    return checkoutError(CHECKOUT_ERROR_MESSAGE);
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    console.error(
      'Vote-creation checkout rejected:',
      response.status,
      readServerError(payload)
    );
    return checkoutError(CHECKOUT_ERROR_MESSAGE);
  }

  const payment = readCheckoutPayment(payload);
  if (!payment) {
    // A 200 with no usable checkout is NOT a success. The old code fabricated a
    // seal hash here and rendered a "vote created" receipt for a vote that was
    // never created, on a fee that was never charged. Nothing was requested of
    // the resident and nothing happened, so the only honest answer is an error.
    console.error('Vote-creation checkout returned no usable payment');
    return checkoutError(CHECKOUT_UNAVAILABLE_MESSAGE);
  }

  return { kind: 'redirect', payment };
}

export type ReturnPhase =
  | 'finalising'
  | 'created'
  | 'processing'
  | 'received'
  | 'failed'
  | 'error';

/**
 * Pure: what the return page should show BEFORE it tries to finalise anything.
 *
 * Green Invoice sends a declined buyer back with `?status=failed`. That verdict
 * outranks the stashed draft: a failed payment must never reach the
 * finalisation POST, and must never be told the vote is on its way.
 */
export function decideReturnPhase(input: {
  readonly statusParam: string | null;
  readonly hasDraft: boolean;
}): ReturnPhase {
  if (input.statusParam === 'failed') return 'failed';
  if (!input.hasDraft) return 'received';
  return 'finalising';
}

export type FinalizeReaction = 'created' | 'retry' | 'processing' | 'error';

/**
 * Pure: how to react to /api/votes' status code.
 *
 * 402 means the webhook has not landed yet, so it is worth another attempt.
 * 400 means the payment was already consumed - most often a prior attempt
 * already created the vote - which is not a hard error. Both were deliberate
 * before this extraction and both are preserved unchanged.
 */
export function classifyFinalizeResponse(status: number): FinalizeReaction {
  if (status >= 200 && status < 300) return 'created';
  if (status === 402) return 'retry';
  if (status === 400) return 'processing';
  return 'error';
}
