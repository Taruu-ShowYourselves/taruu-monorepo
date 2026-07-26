/**
 * Registration Stats API Route Tests
 *
 * Tests for GET /api/stats/registrations.
 *
 * Contract under test:
 * - aggregate counts only, never a user row;
 * - public, like /api/stats/network;
 * - a municipality cohort below MUNICIPALITY_MIN_COHORT is WITHHELD, not
 *   rounded or zeroed, because a count of 1 in a named town identifies a
 *   person to anyone who knows the town;
 * - the platform-wide total is never withheld — it identifies nobody.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/db', () => ({
  countRegisteredUsers: vi.fn(),
  countRegisteredUsersByMunicipality: vi.fn(),
}));

import { GET } from '@/app/api/stats/registrations/route';
import { MUNICIPALITY_MIN_COHORT } from '@/lib/stats';
import {
  countRegisteredUsers,
  countRegisteredUsersByMunicipality,
} from '@/lib/supabase/db';

const req = (query = '') =>
  new NextRequest(`http://localhost:3000/api/stats/registrations${query}`);

describe('GET /api/stats/registrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (countRegisteredUsers as Mock).mockResolvedValue(0);
    (countRegisteredUsersByMunicipality as Mock).mockResolvedValue(0);
  });

  it('returns the platform-wide total without authentication', async () => {
    (countRegisteredUsers as Mock).mockResolvedValue(1234);

    const response = await GET(req());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.stats.registeredTotal).toBe(1234);
    expect(data.stats.municipality).toBeNull();
    expect(data.stats.registeredInMunicipality).toBeNull();
    // No municipality asked for, so no per-town query is made at all.
    expect(countRegisteredUsersByMunicipality).not.toHaveBeenCalled();
  });

  it('reports a municipality cohort at or above the floor', async () => {
    (countRegisteredUsers as Mock).mockResolvedValue(400);
    (countRegisteredUsersByMunicipality as Mock).mockResolvedValue(
      MUNICIPALITY_MIN_COHORT
    );

    const data = await (await GET(req('?municipality=kiryat-tivon'))).json();

    expect(data.stats.registeredInMunicipality).toBe(MUNICIPALITY_MIN_COHORT);
    expect(data.stats.municipalityWithheld).toBe(false);
    expect(data.stats.municipality).toBe('kiryat-tivon');
    expect(countRegisteredUsersByMunicipality).toHaveBeenCalledWith('kiryat-tivon');
  });

  it('withholds a cohort below the floor instead of publishing it', async () => {
    (countRegisteredUsers as Mock).mockResolvedValue(400);
    (countRegisteredUsersByMunicipality as Mock).mockResolvedValue(
      MUNICIPALITY_MIN_COHORT - 1
    );

    const data = await (await GET(req('?municipality=kiryat-tivon'))).json();

    expect(data.stats.registeredInMunicipality).toBeNull();
    expect(data.stats.municipalityWithheld).toBe(true);
    // The withheld figure must not survive in ANY field of the payload.
    // Compared by value, not by substring — "4" would match inside "400".
    expect(Object.values(data.stats)).not.toContain(MUNICIPALITY_MIN_COHORT - 1);
  });

  it('withholds a single registration rather than naming a lone resident', async () => {
    (countRegisteredUsers as Mock).mockResolvedValue(50);
    (countRegisteredUsersByMunicipality as Mock).mockResolvedValue(1);

    const data = await (await GET(req('?municipality=tiny-town'))).json();

    expect(data.stats.registeredInMunicipality).toBeNull();
    expect(data.stats.municipalityWithheld).toBe(true);
  });

  it('reports an empty municipality as withheld, not as zero', async () => {
    (countRegisteredUsers as Mock).mockResolvedValue(50);
    (countRegisteredUsersByMunicipality as Mock).mockResolvedValue(0);

    const data = await (await GET(req('?municipality=nowhere'))).json();

    // 0 is below the floor, so it is withheld like any other small cohort —
    // the client renders "not enough residents yet", never a hard zero.
    expect(data.stats.registeredInMunicipality).toBeNull();
    expect(data.stats.municipalityWithheld).toBe(true);
  });

  it('never withholds the platform-wide total', async () => {
    (countRegisteredUsers as Mock).mockResolvedValue(1);

    const data = await (await GET(req())).json();

    expect(data.stats.registeredTotal).toBe(1);
    expect(data.stats.municipalityWithheld).toBe(false);
  });

  it('ignores blank and oversized municipality parameters', async () => {
    (countRegisteredUsers as Mock).mockResolvedValue(10);

    for (const query of ['?municipality=', '?municipality=%20%20', `?municipality=${'x'.repeat(200)}`]) {
      vi.clearAllMocks();
      (countRegisteredUsers as Mock).mockResolvedValue(10);

      const data = await (await GET(req(query))).json();

      expect(data.stats.municipality).toBeNull();
      expect(countRegisteredUsersByMunicipality).not.toHaveBeenCalled();
    }
  });

  it('returns no per-user fields', async () => {
    (countRegisteredUsers as Mock).mockResolvedValue(7);
    (countRegisteredUsersByMunicipality as Mock).mockResolvedValue(7);

    const data = await (await GET(req('?municipality=haifa'))).json();

    expect(Object.keys(data.stats).sort()).toEqual([
      'municipality',
      'municipalityWithheld',
      'registeredInMunicipality',
      'registeredTotal',
      'updatedAt',
    ]);
    const body = JSON.stringify(data);
    for (const forbidden of ['email', 'userId', 'user_id', 'phone', 'firstName', 'did']) {
      expect(body).not.toContain(forbidden);
    }
  });

  it('handles database errors gracefully', async () => {
    (countRegisteredUsers as Mock).mockRejectedValue(new Error('Database error'));

    const response = await GET(req());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch registration statistics');
  });
});
