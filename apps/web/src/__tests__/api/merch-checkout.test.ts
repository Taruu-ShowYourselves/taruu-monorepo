/**
 * Merch checkout route tests - POST /api/merch/checkout.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';

vi.mock('@/services/auth/session', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/supabase/db', () => ({ createMerchOrder: vi.fn() }));
vi.mock('@/services/greenInvoice', () => ({
  isGreenInvoiceConfigured: vi.fn(() => true),
  createPaymentForm: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { getSessionFromRequest } from '@/services/auth/session';
import { createMerchOrder } from '@/lib/supabase/db';
import { createPaymentForm } from '@/services/greenInvoice';
import { POST } from '@/app/api/merch/checkout/route';

const ORIGINAL_SECRET = process.env.GREENINVOICE_WEBHOOK_SECRET;

const SHIPPING = {
  fullName: 'Israel Israeli',
  email: 'u@example.com',
  phone: '0501234567',
  street: 'Herzl 1',
  city: 'Tel Aviv',
  zip: '6100000',
  country: 'IL',
};

function req() {
  return new Request('https://example.test/api/merch/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      items: [{ slug: 'press-tee', variantId: 'm', quantity: 1 }],
      shipping: SHIPPING,
    }),
  });
}

describe('POST /api/merch/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getSessionFromRequest as Mock).mockResolvedValue({
      userId: 'user-1',
      email: 'u@example.com',
    });
    (createMerchOrder as Mock).mockResolvedValue(undefined);
    (createPaymentForm as Mock).mockResolvedValue('https://greeninvoice.test/pay/form');
    process.env.GREENINVOICE_WEBHOOK_SECRET = 'configured-secret';
  });

  afterEach(() => {
    process.env.GREENINVOICE_WEBHOOK_SECRET = ORIGINAL_SECRET;
  });

  it('registers a merch notify URL without leaking the webhook secret in the query string', async () => {
    const res = await POST(req());

    expect(res.status).toBe(200);
    const [, urls] = (createPaymentForm as Mock).mock.calls[0];
    expect(urls.notifyUrl).toBe('https://example.test/api/merch/webhook');
    expect(urls.notifyUrl).not.toContain('token=');
  });
});
