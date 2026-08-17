/**
 * Reauthentication challenge + guarded actions (engineering model §5.6).
 * Covers the §7.2 policy matrix: methods derived server-side, google never
 * satisfies reauth, operator_reset is TOTP-only, tickets are single-use and
 * purpose-bound (the DB consume itself is proven in security_mfa.sql).
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/auth/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/auth/session')>()),
  getSessionFromRequest: vi.fn(),
  createSessionToken: vi.fn(async () => 'new-session'),
  createRefreshToken: vi.fn(async () => 'new-refresh'),
  setSessionCookies: vi.fn(),
}));

vi.mock('@/lib/supabase/mfa', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/mfa')>()),
  getActiveFactor: vi.fn(),
  insertReauthTicket: vi.fn(),
  consumeReauthTicket: vi.fn(),
  disableFactor: vi.fn(),
  regenerateRecoveryCodes: vi.fn(),
}));

vi.mock('@/services/auth/second-factor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/auth/second-factor')>()),
  verifySecondFactor: vi.fn(),
}));

vi.mock('@/server/infra/supabase/security-events.repo', () => ({
  recordSecurityEvent: vi.fn(async () => true),
  countSecurityEventsSince: vi.fn(async () => 0),
}));

vi.mock('@/services/email/security', () => ({
  sendMfaDisabledEmail: vi.fn(async () => true),
}));

vi.mock('@/lib/supabase/db', () => ({
  getUserById: vi.fn(async () => ({
    id: 'user-123',
    email: 'u@example.com',
    first_name: 'U',
    google_id: 'g-1',
    did: 'did:sync:x',
    session_version: 4,
  })),
}));

import { getSessionFromRequest, createSessionToken } from '@/services/auth/session';
import {
  getActiveFactor,
  insertReauthTicket,
  consumeReauthTicket,
  disableFactor,
} from '@/lib/supabase/mfa';
import { verifySecondFactor } from '@/services/auth/second-factor';
import {
  recordSecurityEvent,
  countSecurityEventsSince,
} from '@/server/infra/supabase/security-events.repo';
import { resetDerivedKeyCache } from '@/services/auth/keys';
import { signPurposeToken } from '@/services/auth/tokens';

const SESSION = { userId: 'user-123', email: 'u@example.com', googleId: 'g', did: '', sv: 4, amr: ['google', 'totp'], asr: 'mf' as const, expiresAt: new Date() };

function reauthReq(body: unknown) {
  return new NextRequest('http://localhost:3000/api/security/reauth', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv('AUTH_MASTER_KEY', 'test-master-key-of-sufficient-length-123456');
  resetDerivedKeyCache();
  (getSessionFromRequest as Mock).mockResolvedValue(SESSION);
  (countSecurityEventsSince as Mock).mockResolvedValue(0);
  (getActiveFactor as Mock).mockResolvedValue({ id: 'f1', status: 'active' });
  (insertReauthTicket as Mock).mockImplementation(async (row) => ({
    ...row,
    expires_at: new Date(Date.now() + 300_000).toISOString(),
  }));
});

describe('POST /api/security/reauth', () => {
  async function loadRoute() {
    return (await import('@/app/api/security/reauth/route')).POST;
  }

  it('refuses reauth entirely for an account with no active factor', async () => {
    (getActiveFactor as Mock).mockResolvedValue(null);
    const POST = await loadRoute();
    const res = await POST(reauthReq({ purpose: 'mfa_disable', code: '123456' }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('REAUTH_UNAVAILABLE');
    expect(verifySecondFactor).not.toHaveBeenCalled();
  });

  it('mints a purpose-bound ticket on a correct TOTP', async () => {
    (verifySecondFactor as Mock).mockResolvedValue({ ok: true, method: 'totp' });
    const POST = await loadRoute();

    const res = await POST(reauthReq({ purpose: 'mfa_disable', code: '123456' }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(typeof data.ticket).toBe('string');
    expect(insertReauthTicket).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-123', purpose: 'mfa_disable', method: 'totp' })
    );
    expect(recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'reauth_success' })
    );
    // The verifier saw only the server-derived methods - google is never one.
    expect((verifySecondFactor as Mock).mock.calls[0][2]).toEqual(['totp', 'recovery']);
  });

  it('derives TOTP-only for operator_reset - recovery codes never qualify', async () => {
    (verifySecondFactor as Mock).mockResolvedValue({ ok: false, method: 'recovery' });
    const POST = await loadRoute();

    const res = await POST(reauthReq({ purpose: 'operator_reset', code: 'AB12-CD34-EF56-GH78' }));

    expect(res.status).toBe(401);
    expect((verifySecondFactor as Mock).mock.calls[0][2]).toEqual(['totp']);
  });

  it('records failures and enforces the durable 5-per-15-min ceiling', async () => {
    (verifySecondFactor as Mock).mockResolvedValue({ ok: false, method: 'totp' });
    const POST = await loadRoute();

    const failed = await POST(reauthReq({ purpose: 'mfa_disable', code: '000000' }));
    expect(failed.status).toBe(401);
    expect(recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'reauth_failure' })
    );

    (countSecurityEventsSince as Mock).mockResolvedValue(5);
    expect((await POST(reauthReq({ purpose: 'mfa_disable', code: '000000' }))).status).toBe(429);
  });

  it('rejects an unknown purpose', async () => {
    const POST = await loadRoute();
    expect((await POST(reauthReq({ purpose: 'rm_rf', code: '123456' }))).status).toBe(400);
  });
});

describe('requireReauth-guarded routes', () => {
  async function mintTicketJwt(purpose: string, rowId = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa') {
    return signPurposeToken('reauth', { userId: 'user-123', purpose, jti_row: rowId }, 300);
  }

  function guardedReq(url: string, ticket?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (ticket) headers['X-Reauth-Ticket'] = ticket;
    return new NextRequest(url, { method: 'POST', headers });
  }

  it('disable refuses without a ticket (403 REAUTH_REQUIRED)', async () => {
    const { POST } = await import('@/app/api/security/mfa/disable/route');
    const res = await POST(guardedReq('http://localhost:3000/api/security/mfa/disable'));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('REAUTH_REQUIRED');
  });

  it('disable refuses a ticket minted for another purpose', async () => {
    (consumeReauthTicket as Mock).mockResolvedValue(false); // DB would refuse too
    const { POST } = await import('@/app/api/security/mfa/disable/route');
    const ticket = await mintTicketJwt('recovery_regenerate');
    const res = await POST(guardedReq('http://localhost:3000/api/security/mfa/disable', ticket));
    expect(res.status).toBe(403);
    // The purpose mismatch dies in the JWT claim check - the row is never spent.
    expect(consumeReauthTicket).not.toHaveBeenCalled();
  });

  it('disable refuses when the DB row was already consumed (single use)', async () => {
    (consumeReauthTicket as Mock).mockResolvedValue(false);
    const { POST } = await import('@/app/api/security/mfa/disable/route');
    const ticket = await mintTicketJwt('mfa_disable');
    const res = await POST(guardedReq('http://localhost:3000/api/security/mfa/disable', ticket));
    expect(res.status).toBe(403);
    expect(consumeReauthTicket).toHaveBeenCalled();
  });

  it('disable happy path: transaction, events, and an sf re-mint with the stored sv', async () => {
    (consumeReauthTicket as Mock).mockResolvedValue(true);
    (disableFactor as Mock).mockResolvedValue(true);
    const { POST } = await import('@/app/api/security/mfa/disable/route');
    const ticket = await mintTicketJwt('mfa_disable');

    const res = await POST(guardedReq('http://localhost:3000/api/security/mfa/disable', ticket));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(disableFactor).toHaveBeenCalledWith('user-123', 'user');
    // Re-mint reads the post-bump row: sv 4 from the mocked user read.
    expect(createSessionToken).toHaveBeenCalledWith(
      expect.objectContaining({ sv: 4, amr: ['google'], asr: 'sf' })
    );
    expect(data.accessToken).toBe('new-session');
    expect(data.sessionToken).toBe('new-session');
    expect(recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'mfa_disabled' })
    );
    expect(recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'session_version_revoked',
        metadata: { trigger: 'mfa_disable' },
      })
    );
  });
});
