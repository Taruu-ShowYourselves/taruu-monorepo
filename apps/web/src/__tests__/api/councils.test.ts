import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { PublicCouncilProfileSchema } from '@sync/shared/contracts';

vi.mock('@/lib/supabase/db', () => ({
  getPublicCouncilAggregate: vi.fn(),
}));

import { GET } from '@/app/api/councils/[identifier]/route';
import { getPublicCouncilAggregate } from '@/lib/supabase/db';
import type { PublicCouncilAggregateRow } from '@/server/domain/council/public-profile';

const aggregate: PublicCouncilAggregateRow = {
  council_id: '2ec8fe4c-6dc4-4aa3-a785-1847dd70c213',
  council_code: 'קריית טבעון',
  council_name_he: 'קריית טבעון',
  council_slug_he: 'קריית-טבעון',
  official_population: 18697,
  population_source_name: 'הלשכה המרכזית לסטטיסטיקה',
  population_source_url: 'https://www.cbs.gov.il/example.pdf',
  population_as_of: '2023-12-31',
  population_updated_at: '2026-03-01T00:00:00.000Z',
  registered_users: 25,
  community_managers: 2,
  paying_users: 7,
  relevant_votes: 4,
  active_votes: 1,
  aggregates_updated_at: '2026-07-30T08:00:00.000Z',
};

const request = (identifier = 'קריית-טבעון') =>
  new NextRequest(
    `http://localhost:3000/api/councils/${encodeURIComponent(identifier)}?locale=he`
  );

const context = (identifier = 'קריית-טבעון') => ({
  params: Promise.resolve({ identifier }),
});

describe('GET /api/councils/[identifier]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    (getPublicCouncilAggregate as Mock).mockResolvedValue(aggregate);
  });

  it('returns the allow-listed public contract without authentication', async () => {
    const response = await GET(request(), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(PublicCouncilProfileSchema.safeParse(body).success).toBe(true);
    expect(body.metrics.officialPopulation.value).toBe(18697);
    expect(body.metrics.registeredUsers.value).toBe(25);
    expect(response.headers.get('cache-control')).toContain('s-maxage=300');
  });

  it('returns 404 for an unknown council', async () => {
    (getPublicCouncilAggregate as Mock).mockResolvedValue(null);

    const response = await GET(request('לא-קיים'), context('לא-קיים'));

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('returns an unavailable population when source metadata is missing', async () => {
    (getPublicCouncilAggregate as Mock).mockResolvedValue({
      ...aggregate,
      population_source_name: null,
    });

    const body = await (await GET(request(), context())).json();

    expect(body.metrics.officialPopulation).toMatchObject({
      value: null,
      status: 'unavailable',
      source: null,
    });
  });

  it('returns explicit zero counts for an empty council', async () => {
    (getPublicCouncilAggregate as Mock).mockResolvedValue({
      ...aggregate,
      registered_users: 0,
      community_managers: 0,
      paying_users: 0,
      relevant_votes: 0,
      active_votes: 0,
    });

    const body = await (await GET(request(), context())).json();

    expect(body.metrics.registeredUsers.value).toBe(0);
    expect(body.metrics.communityManagers.value).toBe(0);
    expect(body.metrics.payingUsers.value).toBe(0);
    expect(body.metrics.relevantVotes.value).toBe(0);
  });

  it('never exposes identity, address, or payment/provider detail keys', async () => {
    const body = await (await GET(request(), context())).json();
    const serialized = JSON.stringify(body).toLowerCase();

    for (const forbidden of [
      'first_name',
      'last_name',
      'email',
      'phone',
      'address',
      'identity',
      'did',
      'user_id',
      'payment_id',
      'provider_id',
      'idempotency',
      'metadata',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('feature flag rollback hides the new endpoint', async () => {
    vi.stubEnv('COUNCIL_PUBLIC_PAGES_ENABLED', 'false');

    const response = await GET(request(), context());

    expect(response.status).toBe(404);
    expect(getPublicCouncilAggregate).not.toHaveBeenCalled();
  });

  it('fails closed on a database error', async () => {
    (getPublicCouncilAggregate as Mock).mockRejectedValue(
      new Error('private database detail')
    );

    const response = await GET(request(), context());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
    expect(JSON.stringify(body)).not.toContain('private database detail');
  });
});
