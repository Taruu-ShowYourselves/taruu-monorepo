/**
 * Recovery-code regeneration (engineering model §5.4): flag-gated,
 * reauth-gated, one-transaction batch replacement with codes shown once.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/auth/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/auth/session')>()),
  getSessionFromRequest: vi.fn(),
}));

vi.mock('@/lib/supabase/mfa', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/mfa')>()),
  getActiveFactor: vi.fn(),
  consumeReauthTicket: vi.fn(),
  regenerateRecoveryCodes: vi.fn(),
}));

vi.mock('@/server/infra/supabase/security-events.repo', () => ({
  recordSecurityEvent: vi.fn(async () => true),
}));

import { getSessionFromRequest } from '@/services/auth/session';
import {
  getActiveFactor,
  consumeReauthTicket,
  regenerateRecoveryCodes,
} from '@/lib/supabase/mfa';
import { recordSecurityEvent } from '@/server/infra/supabase/security-events.repo';
import { resetDerivedKeyCache } from '@/services/auth/keys';
import { signPurposeToken } from '@/services/auth/tokens';

const SESSION = { userId: 'user-123', email: 'u@example.com', googleId: 'g', did: '', sv: 1, amr: ['google', 'totp'], asr: 'mf' as const, expiresAt: new Date() };

async function ticketJwt() {
  return signPurposeToken(
    'reauth',
    { userId: 'user-123', purpose: 'recovery_regenerate', jti_row: '77777777-7777-4777-8777-777777777777' },
    300
  );
}

function req(ticket?: string) {
  const headers: Record<string, string> = {};
  if (ticket) headers['X-Reauth-Ticket'] = ticket;
  return new NextRequest('http://localhost:3000/api/security/mfa/recovery/regenerate', {
    method: 'POST',
    headers,
  });
}

async function loadRoute() {
  return (await import('@/app/api/security/mfa/recovery/regenerate/route')).POST;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv('AUTH_MASTER_KEY', 'test-master-key-of-sufficient-length-123456');
  vi.stubEnv('MFA_ENROLLMENT_ENABLED', 'true');
  resetDerivedKeyCache();
  (getSessionFromRequest as Mock).mockResolvedValue(SESSION);
  (getActiveFactor as Mock).mockResolvedValue({ id: 'f1', status: 'active' });
  (consumeReauthTicket as Mock).mockResolvedValue(true);
});

describe('POST /api/security/mfa/recovery/regenerate', () => {
  it('404s when the enrollment flag is off - default state', async () => {
    vi.stubEnv('MFA_ENROLLMENT_ENABLED', '');
    const POST = await loadRoute();
    expect((await POST(req(await ticketJwt()))).status).toBe(404);
  });

  it('403s without a reauth ticket', async () => {
    const POST = await loadRoute();
    const res = await POST(req());
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('REAUTH_REQUIRED');
  });

  it('404s with no active factor', async () => {
    (getActiveFactor as Mock).mockResolvedValue(null);
    const POST = await loadRoute();
    expect((await POST(req(await ticketJwt()))).status).toBe(404);
  });

  it('replaces the batch in one transaction and returns codes ONCE with count metadata', async () => {
    (regenerateRecoveryCodes as Mock).mockResolvedValue(3);
    const POST = await loadRoute();

    const res = await POST(req(await ticketJwt()));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.recoveryCodes).toHaveLength(10);
    // The RPC received hashes only.
    const [, , hashes] = (regenerateRecoveryCodes as Mock).mock.calls[0];
    for (const h of hashes) expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'recovery_codes_regenerated',
        metadata: expect.objectContaining({ previous_unused_count: 3 }),
      })
    );
  });
});
