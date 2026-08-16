/**
 * Typed database failures.
 *
 * Its own module, deliberately free of imports: `db.ts` pulls in the
 * service-role client the moment it is loaded, and the consumers that narrow on
 * these types are routinely tested against a mocked `db.ts`. An error class
 * reached through that mock is a different class, and `instanceof` quietly
 * answers false - so the classes live here, where a test can import the real
 * ones without booting a Supabase client.
 */

/**
 * A write refused by a unique constraint (PostgreSQL 23505).
 *
 * Distinguished from a generic failure because a uniqueness conflict is the one
 * write error callers routinely handle rather than propagate: it means somebody
 * else already wrote the row, which for a dedup-then-insert path is the desired
 * end state reached by another route.
 */
export class UniqueViolationError extends Error {
  constructor(
    readonly constraint: string | undefined,
    message: string
  ) {
    super(message);
    this.name = 'UniqueViolationError';
  }
}
