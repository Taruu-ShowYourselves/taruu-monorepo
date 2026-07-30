import type {
  CouncilMetric,
  PublicCouncilProfile,
} from '@sync/shared/contracts';

export const COUNCIL_SENSITIVE_COHORT_MIN = 5;
export const OFFICIAL_POPULATION_STALE_AFTER_DAYS = 548;

export interface PublicCouncilAggregateRow {
  council_id: string;
  council_code: string;
  council_name_he: string;
  council_slug_he: string;
  official_population: number | null;
  population_source_name: string | null;
  population_source_url: string | null;
  population_as_of: string | null;
  population_updated_at: string | null;
  registered_users: number;
  community_managers: number;
  paying_users: number;
  relevant_votes: number;
  active_votes: number;
  aggregates_updated_at: string;
}

/**
 * The currently requested metrics are explicitly public. This policy is for a
 * future cohort that may be sensitive: zero remains an honest zero, while
 * non-zero cohorts below the floor are suppressed.
 */
export function publishCouncilCohort(
  value: number,
  sensitivity: 'public' | 'sensitive' = 'public'
): number | null {
  if (
    sensitivity === 'sensitive' &&
    value > 0 &&
    value < COUNCIL_SENSITIVE_COHORT_MIN
  ) {
    return null;
  }
  return value;
}

function isStale(asOf: string, now: Date): boolean {
  const ageMs = now.getTime() - new Date(asOf).getTime();
  return ageMs > OFFICIAL_POPULATION_STALE_AFTER_DAYS * 86_400_000;
}

function aggregateMetric(
  value: number,
  definition: string,
  updatedAt: string
): CouncilMetric {
  return {
    value: publishCouncilCohort(value),
    status: 'available',
    definition,
    source: {
      name: 'מסד הנתונים של תַּרְאוּ',
      url: null,
      asOf: updatedAt,
      updatedAt,
    },
  };
}

export function buildPublicCouncilProfile(
  row: PublicCouncilAggregateRow,
  locale: string,
  now = new Date()
): PublicCouncilProfile {
  const generatedAt = now.toISOString();
  const populationSourceComplete =
    row.official_population !== null &&
    row.population_source_name !== null &&
    row.population_source_url !== null &&
    row.population_as_of !== null &&
    row.population_updated_at !== null;

  const officialPopulation: CouncilMetric = populationSourceComplete
    ? {
        value: row.official_population,
        status: isStale(row.population_as_of!, now) ? 'stale' : 'available',
        definition:
          'אוכלוסיית הרשות לפי המקור הרשמי המצוין כאן. זהו נתון חיצוני ואינו מספר המשתמשים בתַּרְאוּ.',
        source: {
          name: row.population_source_name!,
          url: row.population_source_url!,
          asOf: row.population_as_of!,
          updatedAt: row.population_updated_at!,
        },
      }
    : {
        value: null,
        status: 'unavailable',
        definition:
          'אוכלוסיית הרשות לפי מקור רשמי. הנתון אינו מוצג עד שכל פרטי המקור זמינים.',
        source: null,
      };

  const encodedCode = encodeURIComponent(row.council_code);
  return {
    council: {
      id: row.council_id,
      code: row.council_code,
      name: row.council_name_he,
      slug: row.council_slug_he,
      canonicalUrl: `/${locale}/councils/${row.council_slug_he}`,
    },
    generatedAt,
    metrics: {
      officialPopulation,
      registeredUsers: aggregateMetric(
        row.registered_users,
        'משתמשים רשומים בתַּרְאוּ שהשיוך הגאוגרפי השמור שלהם הוא לרשות זו.',
        row.aggregates_updated_at
      ),
      communityManagers: aggregateMetric(
        row.community_managers,
        'מנהלי קהילה בעלי הקצאת תפקיד פעילה לרשות בזמן יצירת הנתון.',
        row.aggregates_updated_at
      ),
      payingUsers: aggregateMetric(
        row.paying_users,
        'משתמשים ייחודיים ששילמו בהצלחה, ללא החזר, על הגשת הצבעה או על תפקיד מנהל קהילה פעיל.',
        row.aggregates_updated_at
      ),
      relevantVotes: aggregateMetric(
        row.relevant_votes,
        'הצבעות פעילות או שהסתיימו המשויכות לרשות.',
        row.aggregates_updated_at
      ),
      activeVotes: aggregateMetric(
        row.active_votes,
        'הצבעות פעילות כעת המשויכות לרשות.',
        row.aggregates_updated_at
      ),
    },
    links: {
      votes: `/${locale}/votes?municipality=${encodedCode}`,
      civicSpace: `/${locale}/municipality/${encodedCode}`,
    },
  };
}
