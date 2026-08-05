/**
 * Refund request route tests - POST /api/payments/refund.
 *
 * Request flow (per policy): records the request + notifies support; never moves
 * money. Covers auth, validation, ownership/eligibility mapping, latest-payment
 * resolution, and best-effort email.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/auth/session', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/supabase/db', () => ({
  getPaymentById: vi.fn(),
  getLatestRefundablePayment: vi.fn(),
  requestPaymentRefund: vi.fn(),
}));
vi.mock('@/services/email', () => ({
  emailService: { isConfigured: vi.fn(() => true), sendRefundRequestNotification: vi.fn() },
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { getSessionFromRequest } from '@/services/auth/session';
import {
  getPaymentById,
  getLatestRefundablePayment,
  requestPaymentRefund,
} from '@/lib/supabase/db';
import { emailService } from '@/services/email';

const SESSION = { userId: 'user-1', email: 'u@example.com' };
const PAYMENT = { id: 'pay-1', user_id: 'user-1', status: 'completed', amount: 300, type: 'vote_participation', provider_id: 'txn_1' };

function req(body: unknown) {
  return new NextRequest('http://localhost/api/payments/refund', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/payments/refund', () => {
  let POST: typeof import('@/app/api/payments/refund/route').POST;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    // The refund rail is part of payments, so it is closed with them. These
    // cases describe it as it behaves with money switched ON; the OFF contract
    // is asserted in its own describe below.
    vi.stubEnv('NEXT_PUBLIC_PAYMENTS_ENABLED', 'true');
    (getSessionFromRequest as Mock).mockResolvedValue(SESSION);
    (emailService.isConfigured as Mock).mockReturnValue(true);
    (emailService.sendRefundRequestNotification as Mock).mockResolvedValue(undefined);
    POST = (await import('@/app/api/payments/refund/route')).POST;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('401 without a session', async () => {
    (getSessionFromRequest as Mock).mockResolvedValue(null);
    const res = await POST(req({ reason: 'x' }));
    expect(res.status).toBe(401);
  });

  it('400 when reason is empty', async () => {
    const res = await POST(req({ reason: '   ' }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('INVALID_REASON');
  });

  it('404 when no refundable payment exists', async () => {
    (getLatestRefundablePayment as Mock).mockResolvedValue(null);
    const res = await POST(req({ reason: 'mistake' }));
    expect(res.status).toBe(404);
    expect(requestPaymentRefund).not.toHaveBeenCalled();
  });

  it("404 when a named payment isn't owned by the user", async () => {
    (getPaymentById as Mock).mockResolvedValue({ ...PAYMENT, user_id: 'someone-else' });
    const res = await POST(req({ paymentId: 'pay-1', reason: 'mistake' }));
    expect(res.status).toBe(404);
  });

  it('409 when the payment is not refundable', async () => {
    (getLatestRefundablePayment as Mock).mockResolvedValue(PAYMENT);
    (requestPaymentRefund as Mock).mockResolvedValue('not_refundable');
    const res = await POST(req({ reason: 'mistake' }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('NOT_REFUNDABLE');
  });

  it('409 when already requested', async () => {
    (getLatestRefundablePayment as Mock).mockResolvedValue(PAYMENT);
    (requestPaymentRefund as Mock).mockResolvedValue('already_requested');
    const res = await POST(req({ reason: 'mistake' }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('ALREADY_REQUESTED');
  });

  it('500 on a DB error result', async () => {
    (getLatestRefundablePayment as Mock).mockResolvedValue(PAYMENT);
    (requestPaymentRefund as Mock).mockResolvedValue('error');
    const res = await POST(req({ reason: 'mistake' }));
    expect(res.status).toBe(500);
  });

  it('200 + notifies support on success (resolves latest payment)', async () => {
    (getLatestRefundablePayment as Mock).mockResolvedValue(PAYMENT);
    (requestPaymentRefund as Mock).mockResolvedValue('ok');
    const res = await POST(req({ reason: 'double charge' }));
    expect(res.status).toBe(200);
    expect((await res.json())).toEqual({ success: true, status: 'requested' });
    expect(requestPaymentRefund).toHaveBeenCalledWith('pay-1', 'user-1', 'double charge');
    expect(emailService.sendRefundRequestNotification).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: 'pay-1', amountILS: 3, userEmail: 'u@example.com' })
    );
  });

  it('200 with an explicit owned paymentId', async () => {
    (getPaymentById as Mock).mockResolvedValue(PAYMENT);
    (requestPaymentRefund as Mock).mockResolvedValue('ok');
    const res = await POST(req({ paymentId: 'pay-1', reason: 'mistake' }));
    expect(res.status).toBe(200);
    expect(getPaymentById).toHaveBeenCalledWith('pay-1');
  });

  it('still 200 when the support email throws (best-effort)', async () => {
    (getLatestRefundablePayment as Mock).mockResolvedValue(PAYMENT);
    (requestPaymentRefund as Mock).mockResolvedValue('ok');
    (emailService.sendRefundRequestNotification as Mock).mockRejectedValue(new Error('resend down'));
    const res = await POST(req({ reason: 'mistake' }));
    expect(res.status).toBe(200);
  });

  it('skips email when Resend is unconfigured but still records (200)', async () => {
    (getLatestRefundablePayment as Mock).mockResolvedValue(PAYMENT);
    (requestPaymentRefund as Mock).mockResolvedValue('ok');
    (emailService.isConfigured as Mock).mockReturnValue(false);
    const res = await POST(req({ reason: 'mistake' }));
    expect(res.status).toBe(200);
    expect(emailService.sendRefundRequestNotification).not.toHaveBeenCalled();
  });
});

/**
 * The shipped default. Nothing was ever charged while the switch is off, so
 * there is nothing to refund - and no support ticket to raise.
 */
describe('POST /api/payments/refund with payments disabled', () => {
  let POST: typeof import('@/app/api/payments/refund/route').POST;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
    (getSessionFromRequest as Mock).mockResolvedValue(SESSION);
    (getLatestRefundablePayment as Mock).mockResolvedValue(PAYMENT);
    (requestPaymentRefund as Mock).mockResolvedValue('ok');
    (emailService.isConfigured as Mock).mockReturnValue(true);
    POST = (await import('@/app/api/payments/refund/route')).POST;
  });

  it('503 PAYMENTS_DISABLED, in Hebrew', async () => {
    const res = await POST(req({ reason: 'mistake' }));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.code).toBe('PAYMENTS_DISABLED');
    expect(body.error).toMatch(/[֐-׿]/);
  });

  it('refuses before auth, the body and the database are touched', async () => {
    (getSessionFromRequest as Mock).mockResolvedValue(null);

    const res = await POST(req({ reason: '' }));

    // A gate placed after auth would answer 401; after validation, 400.
    expect(res.status).toBe(503);
    expect(getSessionFromRequest).not.toHaveBeenCalled();
    expect(requestPaymentRefund).not.toHaveBeenCalled();
    expect(emailService.sendRefundRequestNotification).not.toHaveBeenCalled();
  });
});
