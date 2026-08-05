import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('@/lib/supabase/db', () => ({
  createPayment: vi.fn(),
  getPaymentByIdempotencyKey: vi.fn(),
}));

import type { Payment } from '@/lib/supabase/types';
import { createPayment, getPaymentByIdempotencyKey } from '@/lib/supabase/db';
import {
  assertCreationFeeCaptureAllowed,
  createCreationFeePort,
  CREATION_FEE_IMPLEMENTATION_CAPTURES,
} from './creation-fee';

const paymentRow = (overrides: Partial<Payment> = {}): Payment => ({
  id: '77777777-7777-4777-8777-777777777777',
  user_id: '44444444-4444-4444-8444-444444444444',
  type: 'vote_creation',
  amount: 5000,
  currency: 'ILS',
  status: 'pending',
  provider: 'green_invoice',
  provider_id: null,
  idempotency_key:
    '44444444-4444-4444-8444-444444444444:vote_creation:55555555-5555-4555-8555-555555555555',
  vote_id: '55555555-5555-4555-8555-555555555555',
  option_id: null,
  metadata: null,
  created_at: '2026-08-05T00:00:00.000Z',
  updated_at: '2026-08-05T00:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.NEXT_PUBLIC_PAYMENTS_ENABLED;
});

describe('creation fee payment switch', () => {
  it('documents that the current implementation records obligations only', () => {
    expect(CREATION_FEE_IMPLEMENTATION_CAPTURES).toBe(false);
  });

  it('fails closed for a capture-capable implementation while payments are off', () => {
    expect(
      assertCreationFeeCaptureAllowed(true, { NEXT_PUBLIC_PAYMENTS_ENABLED: undefined })
    ).toMatchObject({ kind: 'PAYMENT_INVALID' });
    expect(
      assertCreationFeeCaptureAllowed(true, { NEXT_PUBLIC_PAYMENTS_ENABLED: 'false' })
    ).toMatchObject({ kind: 'PAYMENT_INVALID' });
    expect(
      assertCreationFeeCaptureAllowed(true, { NEXT_PUBLIC_PAYMENTS_ENABLED: 'true' })
    ).toBeNull();
  });

  it("allows today's obligation-only approval path while payments are off", async () => {
    (getPaymentByIdempotencyKey as Mock).mockResolvedValue(null);
    (createPayment as Mock).mockResolvedValue(paymentRow());

    const result = await createCreationFeePort().charge({
      submitterUserId: '44444444-4444-4444-8444-444444444444',
      voteId: '55555555-5555-4555-8555-555555555555',
      amountAgorot: 5000,
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({
      paymentId: '77777777-7777-4777-8777-777777777777',
      outcome: 'obligation',
    });
    expect(createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
        metadata: expect.objectContaining({ note: 'capture pending PAY-06' }),
      })
    );
  });

  it('keeps the capture guard inside charge before any database call', () => {
    const source = readFileSync(resolve(__dirname, 'creation-fee.ts'), 'utf8');
    const chargeIndex = source.indexOf('charge({ submitterUserId, voteId, amountAgorot })');
    const guardIndex = source.indexOf('assertCreationFeeCaptureAllowed()', chargeIndex);
    const lookupIndex = source.indexOf('idempotencyKeyFor(submitterUserId, voteId)', chargeIndex);

    expect(chargeIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeGreaterThan(chargeIndex);
    expect(lookupIndex).toBeGreaterThan(guardIndex);
  });
});
