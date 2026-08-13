/**
 * Operator MFA reset (engineering model §5.6b): flag-gated, role-gated,
 * TOTP-ticket-gated, reason-mandatory, durably rate-limited; the target
 * transaction and its evidence rows.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { okAsync, errAsync } from 'neverthrow';

vi.mock('@/services/auth/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/auth/session')>()),
  getSessionFromRequest: vi.fn(),
}));

vi.mock('@/server/app/pilot/authorize', () => ({
  requirePilotAdmin: vi.fn(),
}));

vi.mock('@/lib/supabase/mfa', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/mfa')>()),
  getActiveFactor: vi.fn(),
  getSecuritySettings: vi.fn(async () => ({ id: true, mfa_enforcement_enabled: false, updated_at: '' })),
  consumeReauthTicket: vi.fn(),
  disableFactor: vi.fn(),
}));

vi.mock('@/server/infra/supabase/security-events.repo', () => ({
  recordSecurityEvent: vi.fn(async () => true),
  countActorEventsSince: vi.fn(async () => 0),
}));

vi.mock('@/services/email/security', () => ({
  sendMfaResetByOperatorEmail: vi.fn(async () => true),
}));

vi.mock('@/lib/supabase/db', () => ({
  getUserById: vi.fn(async (id: string) => ({ id, email: 't@example.com', first_name: 'T' })),
}));

import { getSessionFromRequest } from '@/services/auth/session';
import { requirePilotAdmin } from '@/server/app/pilot/authorize';
import {
  getActiveFactor,
  getSecuritySettings,
  consumeReauthTicket,
  disableFactor,
} from '@/lib/supabase/mfa';
import {
  recordSecurityEvent,
  countActorEventsSince,
} from '@/server/infra/supabase/security-events.repo';
import { sendMfaResetByOperatorEmail } from '@/services/email/security';
import { forbidden } from '@/server/http/errors';
import { resetDerivedKeyCache } from '@/services/auth/keys';
import { signPurposeToken } from '@/services/auth/tokens';

const OPERATOR = { userId: 'op-1', email: 'op@example.com', googleId: 'g', did: '', sv: 1, amr: ['google', 'totp'], asr: 'mf' as const, expiresAt: new Date() };
const TARGET_ID = '55555555-5555-4555-8555-555555555555';

async function ticketJwt() {
  return signPurposeToken(
    'reauth',
    { userId: 'op-1', purpose: 'operator_reset', jti_row: '66666666-6666-4666-8666-666666666666' },
    300
  );
}

function resetReq(body: Record<string, unknown>, ticket?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ticket) headers['X-Reauth-Ticket'] = ticket;
  return new NextRequest('http://localhost:3000/api/security/admin/mfa-reset', {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  });
}

async function loadRoute() {
  return (await import('@/app/api/security/admin/mfa-reset/route')).POST;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv('AUTH_MASTER_KEY', 'test-master-key-of-sufficient-length-123456');
  vi.stubEnv('OPERATOR_RESET_ENABLED', 'true');
  resetDerivedKeyCache();
  (getSessionFromRequest as Mock).mockResolvedValue(OPERATOR);
  (requirePilotAdmin as Mock).mockReturnValue(okAsync({ userId: 'op-1' }));
  (getActiveFactor as Mock).mockResolvedValue({ id: 'f-op', status: 'active' });
  (consumeReauthTicket as Mock).mockResolvedValue(true);
  (countActorEventsSince as Mock).mockResolvedValue(0);
});

describe('POST /api/security/admin/mfa-reset', () => {
  const VALID = { targetUserId: TARGET_ID, reason: 'user lost their authenticator, identity verified by phone' };

  it('404s when the flag is off - default state', async () => {
    vi.stubEnv('OPERATOR_RESET_ENABLED', '');
    const POST = await loadRoute();
    expect((await POST(resetReq(VALID, await ticketJwt()))).status).toBe(404);
  });

  it('403s a non-admin', async () => {
    (requirePilotAdmin as Mock).mockReturnValue(errAsync(forbidden('not_platform_admin')));
    const POST = await loadRoute();
    expect((await POST(resetReq(VALID, await ticketJwt()))).status).toBe(403);
  });

  it('403s an enrolled operator holding an sf session while enforcement is live', async () => {
    (getSecuritySettings as Mock).mockResolvedValue({ id: true, mfa_enforcement_enabled: true, updated_at: '' });
    (getSessionFromRequest as Mock).mockResolvedValue({ ...OPERATOR, asr: 'sf', amr: ['google'] });
    const POST = await loadRoute();
    expect((await POST(resetReq(VALID, await ticketJwt()))).status).toBe(403);
  });

  it('403s without the TOTP reauth ticket - every reset is individually MFA-proven', async () => {
    const POST = await loadRoute();
    const res = await POST(resetReq(VALID));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('REAUTH_REQUIRED');
    expect(disableFactor).not.toHaveBeenCalled();
  });

  it('400s a reason under 10 characters - evidence is mandatory', async () => {
    const POST = await loadRoute();
    const res = await POST(resetReq({ targetUserId: TARGET_ID, reason: 'short' }, await ticketJwt()));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('INVALID_REASON');
  });

  it('429s at the 10-per-operator-day ceiling', async () => {
    (countActorEventsSince as Mock).mockResolvedValue(10);
    const POST = await loadRoute();
    expect((await POST(resetReq(VALID, await ticketJwt()))).status).toBe(429);
  });

  it('404s a target with no active factor', async () => {
    (disableFactor as Mock).mockResolvedValue(false);
    const POST = await loadRoute();
    const res = await POST(resetReq(VALID, await ticketJwt()));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe('NO_ACTIVE_FACTOR');
  });

  it('happy path: transaction, two evidence rows with actor identity, and the target email', async () => {
    (disableFactor as Mock).mockResolvedValue(true);
    const POST = await loadRoute();

    const res = await POST(resetReq(VALID, await ticketJwt()));

    expect(res.status).toBe(200);
    expect(disableFactor).toHaveBeenCalledWith(TARGET_ID, 'operator_reset');
    expect(recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'mfa_reset_by_operator',
        userId: TARGET_ID,
        actorUserId: 'op-1',
        reason: VALID.reason,
      })
    );
    expect(recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'session_version_revoked',
        metadata: { trigger: 'operator_reset' },
      })
    );
    expect(sendMfaResetByOperatorEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 't@example.com' })
    );
  });
});
