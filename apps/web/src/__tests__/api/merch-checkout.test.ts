/**
 * Merch checkout route tests - POST /api/merch/checkout.
 *
 * The store shares the payments kill switch with the vote-creation fee: while
 * NEXT_PUBLIC_PAYMENTS_ENABLED is not the exact string 'true', no order may be
 * opened and no hosted form may be requested. The cart's disabled button is
 * cosmetic - this route is the enforcement point.
 *
 * The switch-ON cases are here too, so the OFF behaviour is proved to be the
 * switch talking rather than a broken route.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';

vi.mock('@/services/auth/session', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/supabase/db', () => ({ createMerchOrder: vi.fn() }));
vi.mock('@/services/greenInvoice', () => ({
  isGreenInvoiceConfigured: vi.fn(() => false),
  createPaymentForm: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { getSessionFromRequest } from '@/services/auth/session';
import { createMerchOrder } from '@/lib/supabase/db';
import { isGreenInvoiceConfigured, createPaymentForm } from '@/services/greenInvoice';
import { POST } from '@/app/api/merch/checkout/route';

const SESSION = { userId: 'user-1', email: 'u@example.com' };

const SHIPPING = {
  fullName: 'ישראל ישראלי',
  email: 'u@example.com',
  phone: '0501234567',
  street: 'הרצל 1',
  city: 'תל אביב',
  zip: '6100000',
  country: 'IL',
};

/** A body the route would happily price if the switch were on. */
function req(body: unknown, url = 'http://localhost:3000/api/merch/checkout') {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/merch/checkout with payments disabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    (getSessionFromRequest as Mock).mockResolvedValue(SESSION);
    (isGreenInvoiceConfigured as Mock).mockReturnValue(true);
  });

  it('503 PAYMENTS_DISABLED, in Hebrew', async () => {
    const res = await POST(
      req({ items: [{ slug: 'tee', variantId: 'm', quantity: 1 }], shipping: SHIPPING })
    );
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.code).toBe('PAYMENTS_DISABLED');
    expect(body.error).toMatch(/[֐-׿]/);
  });

  it('refuses before auth, the body and the order write', async () => {
    (getSessionFromRequest as Mock).mockResolvedValue(null);

    // Unparseable body, no session: a gate placed later would answer 401 or 400.
    const res = await POST(
      new Request('http://localhost:3000/api/merch/checkout', {
        method: 'POST',
        body: 'not json at all',
      })
    );

    expect(res.status).toBe(503);
    expect(getSessionFromRequest).not.toHaveBeenCalled();
    expect(createMerchOrder).not.toHaveBeenCalled();
    expect(createPaymentForm).not.toHaveBeenCalled();
  });

  it('writes no pending order row that nobody could ever settle', async () => {
    await POST(req({ items: [{ slug: 'tee', variantId: 'm', quantity: 2 }], shipping: SHIPPING }));

    expect(createMerchOrder).not.toHaveBeenCalled();
    expect(createPaymentForm).not.toHaveBeenCalled();
  });

  it.each(['false', 'TRUE', '1', 'yes', ''])(
    'stays closed for the near-miss value %j',
    async (value) => {
      vi.stubEnv('NEXT_PUBLIC_PAYMENTS_ENABLED', value);

      const res = await POST(
        req({ items: [{ slug: 'tee', variantId: 'm', quantity: 1 }], shipping: SHIPPING })
      );

      expect(res.status).toBe(503);
    }
  );
});

describe('POST /api/merch/checkout with payments enabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_PAYMENTS_ENABLED', 'true');
    (getSessionFromRequest as Mock).mockResolvedValue(SESSION);
    (isGreenInvoiceConfigured as Mock).mockReturnValue(false);
    (createMerchOrder as Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('401 for a guest - the pre-existing auth gate is untouched', async () => {
    (getSessionFromRequest as Mock).mockResolvedValue(null);

    const res = await POST(
      req({ items: [{ slug: 'tee', variantId: 'm', quantity: 1 }], shipping: SHIPPING })
    );

    expect(res.status).toBe(401);
  });

  it('400 for an empty cart - validation still runs behind the switch', async () => {
    const res = await POST(req({ items: [], shipping: SHIPPING }));

    expect(res.status).toBe(400);
  });

  it('400 for invalid shipping details', async () => {
    const res = await POST(
      req({
        items: [{ slug: 'tee', variantId: 'm', quantity: 1 }],
        shipping: { ...SHIPPING, email: 'not-an-email' },
      })
    );

    expect(res.status).toBe(400);
  });
});
