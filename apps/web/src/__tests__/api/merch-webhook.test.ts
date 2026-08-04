/**
 * Merch Webhook API Route Tests
 *
 * Tests for POST /api/merch/webhook - the Green Invoice paid-notification
 * endpoint. Focus on the security hardening:
 * - shared-secret authentication (reject forged POSTs)
 * - atomic pending→paid transition (idempotent under replay / races)
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';

vi.mock('@/lib/supabase/db', () => ({
  getMerchOrderById: vi.fn(),
  markMerchOrderPaid: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { getMerchOrderById, markMerchOrderPaid } from '@/lib/supabase/db';

const SECRET = 'super-secret-token';
const pendingOrder = { id: 'order-1', status: 'pending', payment_id: null };

function post(url: string, body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/merch/webhook', () => {
  let POST: typeof import('@/app/api/merch/webhook/route').POST;
  const ORIGINAL = process.env.GREENINVOICE_WEBHOOK_SECRET;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.GREENINVOICE_WEBHOOK_SECRET = SECRET;
    POST = (await import('@/app/api/merch/webhook/route')).POST;
  });

  afterEach(() => {
    process.env.GREENINVOICE_WEBHOOK_SECRET = ORIGINAL;
  });

  describe('authentication', () => {
    it('rejects a POST with no token (401)', async () => {
      const res = await POST(post('http://localhost/api/merch/webhook', { custom: 'order-1' }));
      expect(res.status).toBe(401);
      expect(markMerchOrderPaid).not.toHaveBeenCalled();
    });

    it('rejects a POST with a wrong token (401)', async () => {
      const res = await POST(
        post('http://localhost/api/merch/webhook?token=nope', { custom: 'order-1' })
      );
      expect(res.status).toBe(401);
      expect(markMerchOrderPaid).not.toHaveBeenCalled();
    });

    it('accepts the secret via query param', async () => {
      (getMerchOrderById as Mock).mockResolvedValue(pendingOrder);
      (markMerchOrderPaid as Mock).mockResolvedValue({ kind: 'updated', row: pendingOrder });
      const res = await POST(
        post(`http://localhost/api/merch/webhook?token=${SECRET}`, { custom: 'order-1', id: 'doc-9' })
      );
      expect(res.status).toBe(200);
      expect(markMerchOrderPaid).toHaveBeenCalledWith('order-1', 'doc-9');
    });

    it('accepts the secret via x-greeninvoice-token header', async () => {
      (getMerchOrderById as Mock).mockResolvedValue(pendingOrder);
      (markMerchOrderPaid as Mock).mockResolvedValue({ kind: 'updated', row: pendingOrder });
      const res = await POST(
        post('http://localhost/api/merch/webhook', { custom: 'order-1' }, { 'x-greeninvoice-token': SECRET })
      );
      expect(res.status).toBe(200);
    });

    it('runs OPEN (accepts) when no secret is configured in dev', async () => {
      process.env.GREENINVOICE_WEBHOOK_SECRET = '';
      vi.resetModules();
      const route = await import('@/app/api/merch/webhook/route');
      (getMerchOrderById as Mock).mockResolvedValue(pendingOrder);
      (markMerchOrderPaid as Mock).mockResolvedValue({ kind: 'updated', row: pendingOrder });
      const res = await route.POST(post('http://localhost/api/merch/webhook', { custom: 'order-1' }));
      expect(res.status).toBe(200);
    });

    it('fails CLOSED (401) when the secret is unset in production', async () => {
      const prevEnv = process.env.NODE_ENV;
      process.env.GREENINVOICE_WEBHOOK_SECRET = '';
      // @ts-expect-error override for the test
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const route = await import('@/app/api/merch/webhook/route');
      const res = await route.POST(post('http://localhost/api/merch/webhook', { custom: 'order-1' }));
      expect(res.status).toBe(401);
      // @ts-expect-error restore
      process.env.NODE_ENV = prevEnv;
    });
  });

  describe('paid transition', () => {
    const url = `http://localhost/api/merch/webhook?token=${SECRET}`;

    it('acks 200 without touching the DB when no order id is present', async () => {
      const res = await POST(post(url, {}));
      expect(res.status).toBe(200);
      expect(getMerchOrderById).not.toHaveBeenCalled();
    });

    it('acks 200 for an unknown order', async () => {
      (getMerchOrderById as Mock).mockResolvedValue(null);
      const res = await POST(post(url, { custom: 'ghost' }));
      expect(res.status).toBe(200);
      expect(markMerchOrderPaid).not.toHaveBeenCalled();
    });

    it('acks 200 idempotently when the atomic update is a no-op (already settled / race)', async () => {
      (getMerchOrderById as Mock).mockResolvedValue(pendingOrder);
      (markMerchOrderPaid as Mock).mockResolvedValue({ kind: 'noop' });
      const res = await POST(post(url, { custom: 'order-1' }));
      expect(res.status).toBe(200);
    });

    it('returns 500 (so GI retries) on a transient DB error', async () => {
      (getMerchOrderById as Mock).mockResolvedValue(pendingOrder);
      (markMerchOrderPaid as Mock).mockResolvedValue({ kind: 'error' });
      const res = await POST(post(url, { custom: 'order-1' }));
      expect(res.status).toBe(500);
    });

    it('derives the payment id defensively across GI fields', async () => {
      (getMerchOrderById as Mock).mockResolvedValue(pendingOrder);
      (markMerchOrderPaid as Mock).mockResolvedValue({ kind: 'updated', row: pendingOrder });
      await POST(post(url, { custom: 'order-1', documentId: 'gi-doc-42' }));
      expect(markMerchOrderPaid).toHaveBeenCalledWith('order-1', 'gi-doc-42');
    });
  });
});
