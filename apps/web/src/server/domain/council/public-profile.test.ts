import { describe, expect, it } from 'vitest';
import {
  buildPublicCouncilProfile,
  COUNCIL_SENSITIVE_COHORT_MIN,
  publishCouncilCohort,
  type PublicCouncilAggregateRow,
} from './public-profile';

const row: PublicCouncilAggregateRow = {
  council_id: '2ec8fe4c-6dc4-4aa3-a785-1847dd70c213',
  council_code: 'קריית טבעון',
  council_name_he: 'קריית טבעון',
  council_slug_he: 'קריית-טבעון',
  official_population: 18697,
  population_source_name: 'הלשכה המרכזית לסטטיסטיקה',
  population_source_url: 'https://www.cbs.gov.il/example.pdf',
  population_as_of: '2023-12-31',
  population_updated_at: '2026-03-01T00:00:00.000Z',
  registered_users: 27,
  community_managers: 2,
  paying_users: 8,
  relevant_votes: 4,
  active_votes: 1,
  aggregates_updated_at: '2026-07-30T07:00:00.000Z',
};

describe('public council profile aggregation', () => {
  it('keeps official population separate from Taruu counts and sources', () => {
    const profile = buildPublicCouncilProfile(
      row,
      'he',
      new Date('2026-07-30T08:00:00.000Z')
    );

    expect(profile.metrics.officialPopulation.value).toBe(18697);
    expect(profile.metrics.registeredUsers.value).toBe(27);
    expect(profile.metrics.officialPopulation.source?.name).toContain(
      'סטטיסטיקה'
    );
    expect(profile.metrics.registeredUsers.source?.name).toContain('תַּרְאוּ');
    expect(profile.council.canonicalUrl).toBe(
      '/councils/קריית-טבעון'
    );
  });

  it('marks an old authoritative as-of date stale', () => {
    const profile = buildPublicCouncilProfile(
      row,
      'he',
      new Date('2026-07-30T08:00:00.000Z')
    );
    expect(profile.metrics.officialPopulation.status).toBe('stale');
  });

  it('fails closed when any official population source field is missing', () => {
    const profile = buildPublicCouncilProfile(
      { ...row, population_source_url: null },
      'he',
      new Date('2026-07-30T08:00:00.000Z')
    );
    expect(profile.metrics.officialPopulation).toMatchObject({
      value: null,
      status: 'unavailable',
      source: null,
    });
  });

  it('publishes honest zero counts for an empty council', () => {
    const profile = buildPublicCouncilProfile(
      {
        ...row,
        registered_users: 0,
        community_managers: 0,
        paying_users: 0,
        relevant_votes: 0,
        active_votes: 0,
      },
      'he'
    );

    expect(profile.metrics.registeredUsers.value).toBe(0);
    expect(profile.metrics.communityManagers.value).toBe(0);
    expect(profile.metrics.payingUsers.value).toBe(0);
  });

  it('centralizes suppression for future sensitive non-zero cohorts', () => {
    expect(publishCouncilCohort(0, 'sensitive')).toBe(0);
    expect(
      publishCouncilCohort(COUNCIL_SENSITIVE_COHORT_MIN - 1, 'sensitive')
    ).toBeNull();
    expect(
      publishCouncilCohort(COUNCIL_SENSITIVE_COHORT_MIN, 'sensitive')
    ).toBe(COUNCIL_SENSITIVE_COHORT_MIN);
    expect(publishCouncilCohort(1, 'public')).toBe(1);
  });
});
