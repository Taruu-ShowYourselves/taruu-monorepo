/**
 * Creation-funnel truth guard (PAY-06).
 *
 * The v1.0 audit found `votes/create/page.tsx` treating "200 with no checkout
 * URL" as a SUCCESS: it sealed the page with a random hex string and rendered
 * `הצבעה נוצרה · CREATED`, a `Receipt` reading `דמי יצירה ₪50` and a `SealCard`
 * with `status="sealed"` - for a vote that was never POSTed to `/api/votes`,
 * on a fee that was never charged. This is the creation-funnel twin of the
 * `mockHash()` defect Phase 02.1 removed from the casting funnel, and this
 * suite fails if either shape comes back.
 *
 * Two halves, for the same reason as `submit-participation.test.ts` +
 * `participation-receipt-honesty.test.ts`: this repo's vitest runs
 * `environment: 'node'` with a `.ts`-only include glob (no jsdom, no
 * @testing-library, `.tsx` never collected), so the network and phase
 * decisions are unit-tested in their extracted module with an injected
 * `fetch`, and the funnel's own copy is asserted against SOURCE.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  startVoteCreationCheckout,
  decideReturnPhase,
  classifyFinalizeResponse,
  CHECKOUT_ERROR_MESSAGE,
  CHECKOUT_UNAVAILABLE_MESSAGE,
  CHECKOUT_DISABLED_MESSAGE,
} from '@/services/payments/createVoteCheckout';
import { PAYMENTS_DISABLED_CODE } from '@/lib/payments-flag';

const VOTE_TITLE = 'הקמת גן שעשועים חדש בשכונה';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/** A well-formed hosted-form response, exactly as /api/payments/create returns. */
function checkoutIssued(): unknown {
  return {
    success: true,
    payment: {
      id: 'payment-123',
      orderId: 'payment-123',
      paymentUrl: 'https://sandbox.d.greeninvoice.co.il/payments/form/abc',
      amount: 50,
      currency: 'ILS',
      expiresAt: '2026-08-04T12:00:00.000Z',
    },
  };
}

describe('startVoteCreationCheckout', () => {
  beforeEach(() => {
    // The module logs diagnostics on every failure path; keep the run quiet.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a redirect carrying the hosted-form URL on a 200 with a payment', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, checkoutIssued()));

    const result = await startVoteCreationCheckout({ fetch: fetchImpl }, { voteTitle: VOTE_TITLE });

    expect(result).toEqual({
      kind: 'redirect',
      payment: {
        id: 'payment-123',
        orderId: 'payment-123',
        paymentUrl: 'https://sandbox.d.greeninvoice.co.il/payments/form/abc',
      },
    });
  });

  it('treats a 200 with no checkout URL as an error, never a success', async () => {
    // This is the exact branch that used to fabricate a seal and render a
    // receipt. Nothing was charged and no vote exists, so there is nothing
    // truthful to show but an error. Since the server started persisting the
    // hosted-form URL, only a legacy pending row can still answer without one.
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, { success: true, payment: { id: 'payment-123', orderId: 'payment-123' } })
    );

    const result = await startVoteCreationCheckout({ fetch: fetchImpl }, { voteTitle: VOTE_TITLE });

    expect(result).toEqual({ kind: 'error', message: CHECKOUT_UNAVAILABLE_MESSAGE });
  });

  it('redirects on an idempotent reuse that carries the stored hosted-form URL', async () => {
    // A retry of the same draft returns the SAME pending payment with the form
    // URL persisted at first create - not a dead end, and not a second charge.
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        success: true,
        idempotent: true,
        payment: {
          id: 'payment-123',
          orderId: 'payment-123',
          status: 'pending',
          paymentUrl: 'https://sandbox.d.greeninvoice.co.il/payments/form/abc',
          expiresAt: '2026-08-16T12:00:00.000Z',
        },
      })
    );

    const result = await startVoteCreationCheckout({ fetch: fetchImpl }, { voteTitle: VOTE_TITLE });

    expect(result).toEqual({
      kind: 'redirect',
      payment: {
        id: 'payment-123',
        orderId: 'payment-123',
        paymentUrl: 'https://sandbox.d.greeninvoice.co.il/payments/form/abc',
      },
    });
  });

  it('treats a 200 with no payment object at all as an error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { success: true }));

    const result = await startVoteCreationCheckout({ fetch: fetchImpl }, { voteTitle: VOTE_TITLE });

    expect(result.kind).toBe('error');
  });

  it('treats a 200 with a URL but no payment id as an error', async () => {
    // The id becomes paymentTxId on the finalisation POST. Without it the
    // resident could be charged for a vote that can never be published.
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, { success: true, payment: { paymentUrl: 'https://gi.example/form' } })
    );

    const result = await startVoteCreationCheckout({ fetch: fetchImpl }, { voteTitle: VOTE_TITLE });

    expect(result.kind).toBe('error');
  });

  it('returns the Hebrew general error on a non-2xx', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(500, { error: 'boom' }));

    const result = await startVoteCreationCheckout({ fetch: fetchImpl }, { voteTitle: VOTE_TITLE });

    expect(result).toEqual({ kind: 'error', message: CHECKOUT_ERROR_MESSAGE });
  });

  it('says payments are not open yet on a 503 PAYMENTS_DISABLED', async () => {
    // Only a stale client reaches this: the page renders a coming-soon plate
    // instead of the wizard. "Try again in a moment" would be a lie, so the
    // deliberate closure gets its own honest message.
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(503, { error: 'התשלומים עדיין לא נפתחו.', code: PAYMENTS_DISABLED_CODE })
    );

    const result = await startVoteCreationCheckout({ fetch: fetchImpl }, { voteTitle: VOTE_TITLE });

    expect(result).toEqual({ kind: 'error', message: CHECKOUT_DISABLED_MESSAGE });
    expect(CHECKOUT_DISABLED_MESSAGE).not.toBe(CHECKOUT_ERROR_MESSAGE);
  });

  it('does not mistake an unrelated 503 for the kill switch', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(503, { error: 'upstream down' }));

    const result = await startVoteCreationCheckout({ fetch: fetchImpl }, { voteTitle: VOTE_TITLE });

    expect(result).toEqual({ kind: 'error', message: CHECKOUT_ERROR_MESSAGE });
  });

  it('never surfaces the server error string to the resident', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(500, { error: 'Failed to create payment' }));

    const result = await startVoteCreationCheckout({ fetch: fetchImpl }, { voteTitle: VOTE_TITLE });

    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.message).not.toContain('Failed to create payment');
    }
    expect(JSON.stringify(result)).not.toContain('Failed to create payment');
  });

  it('returns the Hebrew general error when fetch throws (offline)', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await startVoteCreationCheckout({ fetch: fetchImpl }, { voteTitle: VOTE_TITLE });

    expect(result).toEqual({ kind: 'error', message: CHECKOUT_ERROR_MESSAGE });
  });

  it('survives a 200 whose body is not JSON at all', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON');
      },
    } as unknown as Response);

    const result = await startVoteCreationCheckout({ fetch: fetchImpl }, { voteTitle: VOTE_TITLE });

    expect(result).toEqual({ kind: 'error', message: CHECKOUT_UNAVAILABLE_MESSAGE });
  });

  it('POSTs to /api/payments/create with exactly { type, voteTitle }', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, checkoutIssued()));

    await startVoteCreationCheckout({ fetch: fetchImpl }, { voteTitle: VOTE_TITLE });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/payments/create');
    expect(init.method).toBe('POST');
    // A client-supplied idempotency key is exactly what SEC-04 forbids; the
    // server derives it. No voteId either - none exists yet.
    expect(JSON.parse(init.body)).toEqual({ type: 'vote_creation', voteTitle: VOTE_TITLE });
    expect(init.body).not.toContain('idempotencyKey');
    expect(init.body).not.toContain('voteId');
  });

  it('sends the participation type nowhere - creation is the only rail', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, checkoutIssued()));

    await startVoteCreationCheckout({ fetch: fetchImpl }, { voteTitle: VOTE_TITLE });

    expect(fetchImpl.mock.calls[0][1].body).not.toContain('vote_participation');
  });
});

describe('return-phase decisions', () => {
  it("reads Green Invoice's ?status=failed as failed, even with a draft waiting", () => {
    expect(decideReturnPhase({ statusParam: 'failed', hasDraft: true })).toBe('failed');
  });

  it('reads ?status=failed as failed with no draft either', () => {
    expect(decideReturnPhase({ statusParam: 'failed', hasDraft: false })).toBe('failed');
  });

  it('acknowledges a non-creation return with no draft', () => {
    expect(decideReturnPhase({ statusParam: null, hasDraft: false })).toBe('received');
  });

  it('finalises when a draft is waiting and nothing failed', () => {
    expect(decideReturnPhase({ statusParam: null, hasDraft: true })).toBe('finalising');
  });

  it('treats an unrecognised status param as a normal return', () => {
    expect(decideReturnPhase({ statusParam: 'success', hasDraft: true })).toBe('finalising');
  });

  it('classifies a 200 from /api/votes as created', () => {
    expect(classifyFinalizeResponse(200)).toBe('created');
  });

  it('classifies a 201 as created, so the whole 2xx range is covered', () => {
    expect(classifyFinalizeResponse(201)).toBe('created');
  });

  it('classifies a 402 as retry - the webhook has not landed yet', () => {
    expect(classifyFinalizeResponse(402)).toBe('retry');
  });

  it('classifies a 400 as processing - the payment was already consumed', () => {
    expect(classifyFinalizeResponse(400)).toBe('processing');
  });

  it('classifies a 500 as error', () => {
    expect(classifyFinalizeResponse(500)).toBe('error');
  });
});

describe('creation funnel states only what it can back', () => {
  const SRC = join(process.cwd(), 'src');

  /** Strip // and block comments so prose about the change is not read as UI. */
  function code(source: string): string {
    return source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');
  }

  const createCode = code(readFileSync(join(SRC, 'app/[locale]/votes/create/page.tsx'), 'utf8'));
  const returnCode = code(readFileSync(join(SRC, 'app/[locale]/payments/return/page.tsx'), 'utf8'));

  it('the create page fabricates no hash', () => {
    expect(createCode).not.toContain('Math.random');
  });

  it('the create page holds no seal state', () => {
    expect(createCode).not.toContain('sealHash');
  });

  it('the create page renders no SealCard', () => {
    expect(createCode).not.toContain('SealCard');
  });

  it('the create page claims nothing is sealed', () => {
    expect(createCode).not.toContain('status="sealed"');
  });

  it('the create page no longer announces a vote it never created', () => {
    expect(createCode).not.toContain('הצבעה נוצרה');
    expect(createCode).not.toContain('CREATED');
  });

  // The product flow moved under the funnel (issue #75, PR #104): a proposal is
  // submitted free and the ₪50 fee becomes an obligation only when a space
  // admin approves. The create page therefore starts no checkout, and the
  // return page is a plain acknowledgement with no draft to finalise. The
  // pure helpers above (deriveVoteCreationKey / decideReturnPhase /
  // classifyFinalizeResponse) stay pinned: they are the rails a paid funnel
  // would ride again, and the /api/payments/create route still uses them.

  it('the create page starts no checkout - submission is free', () => {
    expect(createCode).not.toContain('startVoteCreationCheckout');
    expect(createCode).not.toContain('/api/payments/create');
    expect(createCode).not.toContain('paymentUrl');
  });

  it('the create page says the submission was not charged', () => {
    expect(createCode).toContain('ההגשה לא חויבה');
  });

  it('the return page finalises nothing - there is no draft to finalise', () => {
    expect(returnCode).not.toContain('pendingVote');
    expect(returnCode).not.toContain('sessionStorage');
    expect(returnCode).not.toContain('classifyFinalizeResponse');
    expect(returnCode).not.toContain('decideReturnPhase');
  });

  it('the return page does not use the Next search-params hook', () => {
    // This client page has no Suspense boundary; that hook would force a
    // client-side-rendering bailout at build time.
    expect(returnCode).not.toContain('useSearchParams');
  });

  it('the return page never claims a vote was created', () => {
    expect(returnCode).not.toContain('הצבעה נוצרה');
    expect(returnCode).not.toContain("setPhase('created')");
  });
});
