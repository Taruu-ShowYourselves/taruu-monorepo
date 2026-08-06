/**
 * Newsletter API route tests.
 *
 * The list lives in our own database now, so these mock Supabase rather than
 * `fetch`. That distinction is the whole reason the old suite was worthless:
 * it mocked a third-party HTTP call, passed for months, and never once noticed
 * that the real credential behind that call had gone dead.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

/** Postgres unique_violation, as PostgREST reports it. */
const UNIQUE_VIOLATION = { code: '23505', message: 'duplicate key value' };

const insert = vi.fn();
const updateEq2 = vi.fn();
const update = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: () => ({
      insert,
      update,
    }),
  },
}));

vi.mock('next/headers', () => ({
  headers: () =>
    Promise.resolve({
      get: (name: string) => (name === 'x-forwarded-for' ? '192.168.1.1' : null),
    }),
}));

vi.mock('@/lib/rate-limit', () => ({
  newsletterLimiter: { check: vi.fn(() => Promise.resolve({ limited: false })) },
  createRateLimitResponse: vi.fn(
    () => new Response(JSON.stringify({ success: false }), { status: 429 })
  ),
}));

import { newsletterLimiter } from '@/lib/rate-limit';
import { POST } from '@/app/api/newsletter/route';

function post(body: unknown) {
  return new NextRequest('http://localhost:3000/api/newsletter', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/newsletter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insert.mockResolvedValue({ error: null });
    // update().eq().eq() - the reactivation chain.
    updateEq2.mockResolvedValue({ error: null });
    update.mockReturnValue({ eq: () => ({ eq: updateEq2 }) });
    (newsletterLimiter.check as ReturnType<typeof vi.fn>).mockResolvedValue({
      limited: false,
    });
  });

  it('rejects a missing email without touching the database', async () => {
    const response = await POST(post({}));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it('rejects a malformed address', async () => {
    for (const email of ['', 'invalid-email', 'test@', 'a b@c.com']) {
      const response = await POST(post({ email }));
      expect(response.status).toBe(400);
    }
    expect(insert).not.toHaveBeenCalled();
  });

  it('stores a valid address and answers 201', async () => {
    const response = await POST(
      post({ email: 'test@example.com', source: 'homepage_cta' })
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'test@example.com', source: 'homepage_cta' })
    );
  });

  it('normalises the address before it reaches the table', async () => {
    await POST(post({ email: '  TEST@Example.COM  ' }));

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'test@example.com' })
    );
  });

  it('treats an address already on the list as a success', async () => {
    insert.mockResolvedValue({ error: UNIQUE_VIOLATION });

    const response = await POST(post({ email: 'existing@example.com' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('reactivates a row that had unsubscribed', async () => {
    insert.mockResolvedValue({ error: UNIQUE_VIOLATION });

    await POST(post({ email: 'returning@example.com' }));

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active', unsubscribed_at: null })
    );
    expect(updateEq2).toHaveBeenCalled();
  });

  it('answers 500 when the insert fails for any other reason', async () => {
    insert.mockResolvedValue({ error: { code: '42P01', message: 'no such table' } });

    const response = await POST(post({ email: 'test@example.com' }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
  });

  it('honours the rate limiter before reading the body', async () => {
    (newsletterLimiter.check as ReturnType<typeof vi.fn>).mockResolvedValue({
      limited: true,
    });

    const response = await POST(post({ email: 'test@example.com' }));

    expect(response.status).toBe(429);
    expect(insert).not.toHaveBeenCalled();
  });

  it('answers in the locale the form was rendered in', async () => {
    const he = await (await POST(post({ email: 'a@example.com' }))).json();
    const en = await (
      await POST(post({ email: 'b@example.com', locale: 'en' }))
    ).json();

    expect(he.message).toMatch(/[֐-׿]/);
    expect(en.message).not.toMatch(/[֐-׿]/);
  });
});
