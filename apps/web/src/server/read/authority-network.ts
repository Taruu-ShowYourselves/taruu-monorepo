import 'server-only';
import { cache } from 'react';
import {
  AuthorityKindSchema,
  OfficeRoleSchema,
  type AuthorityLink,
  type AuthorityRelation,
  type OfficeHolder,
} from '@sync/shared/contracts';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * One authority's office holders, and the network of authorities around it.
 *
 * Both reads are memoised per request: a profile page prints the mayor, the
 * borders and the member settlements from the same render, and nothing about
 * them changes between two calls in one request.
 *
 * Both degrade to empty rather than throwing, matching every other read on
 * the front page - a build-time prerender with no service-role key (#39) must
 * print an authority with no published officials, not fail the route.
 *
 * Unknown enum values are dropped rather than coerced. The database CHECK and
 * the Zod enum are two copies of the same list, and a row that satisfies one
 * but not the other means they have drifted; rendering it as some fallback
 * role would bury that, so it is skipped and the page shows one fewer office.
 */

export const authorityOfficeHolders = cache(
  async (identifier: string): Promise<OfficeHolder[]> => {
    const { data, error } = await supabaseAdmin.rpc(
      'council_office_holders_public',
      { council_identifier: identifier }
    );
    if (error || !data) return [];

    return data.flatMap((row): OfficeHolder[] => {
      const role = OfficeRoleSchema.safeParse(row.role);
      if (!role.success) return [];

      return [
        {
          id: row.holder_id,
          councilCode: row.council_code,
          role: role.data,
          fullName: row.full_name,
          termStart: row.term_start,
          termEnd: row.term_end,
          source: {
            name: row.source_name,
            url: row.source_url,
            asOf: row.as_of,
          },
          standing: {
            reviewCount: Number(row.review_count ?? 0),
            // No reviews is not a rating of zero.
            ratingAverage:
              row.rating_average === null || row.rating_average === undefined
                ? null
                : Number(row.rating_average),
          },
        },
      ];
    });
  }
);

const RELATIONS = new Set<AuthorityRelation>([
  'neighbour',
  'parent',
  'settlement',
]);

const isRelation = (value: string): value is AuthorityRelation =>
  RELATIONS.has(value as AuthorityRelation);

export const authorityNetwork = cache(
  async (identifier: string): Promise<AuthorityLink[]> => {
    const { data, error } = await supabaseAdmin.rpc('council_network_public', {
      council_identifier: identifier,
    });
    if (error || !data) return [];

    return data.flatMap((row): AuthorityLink[] => {
      const kind = AuthorityKindSchema.safeParse(row.kind);
      if (!kind.success || !isRelation(row.relation)) return [];

      return [
        {
          relation: row.relation,
          code: row.council_code,
          name: row.name_he,
          slug: row.slug_he,
          kind: kind.data,
          // A border is a sourced claim; containment is structural and has
          // no separate citation to make.
          source:
            row.source_name && row.source_url
              ? { name: row.source_name, url: row.source_url }
              : null,
        },
      ];
    });
  }
);

/** The neighbourhood split the way a profile page lays it out. */
export function groupAuthorityNetwork(links: AuthorityLink[]): {
  neighbours: AuthorityLink[];
  parent: AuthorityLink | null;
  settlements: AuthorityLink[];
} {
  return {
    neighbours: links.filter((l) => l.relation === 'neighbour'),
    parent: links.find((l) => l.relation === 'parent') ?? null,
    settlements: links.filter((l) => l.relation === 'settlement'),
  };
}
