/**
 * Textual guarantees about the activation migration.
 *
 * Scope is deliberately narrow. Every behavioural predicate - creator, cutover,
 * status, dates, moderation, assembly, idempotency - is proven against a real
 * PostgreSQL server by `supabase/tests/ingest_auto_activation.sql`, which
 * `scripts/db-test.sh` runs in CI. Asserting those here as substrings would
 * only restate the file to itself.
 *
 * What is left is what SQL execution cannot show: that the shipped file touches
 * no existing row and grants no one else the right to call it.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260902000001_ingest_auto_activation.sql'
  ),
  'utf8'
);
const sql = migration.replace(/\s+/g, ' ').toLowerCase();

describe('ingest auto-activation migration', () => {
  it('is callable only by the service role', () => {
    expect(sql).toContain(
      'revoke all on function public.activate_ingest_vote(uuid, uuid, timestamptz) from public, anon, authenticated'
    );
    expect(sql).toContain(
      'grant execute on function public.activate_ingest_vote(uuid, uuid, timestamptz) to service_role'
    );
  });

  it('retires the cutover-less two-argument shape', () => {
    expect(sql).toContain('drop function if exists public.activate_ingest_vote(uuid, uuid)');
  });

  it('migrates no existing row', () => {
    // The pending backlog is out of scope for this change. A migration is the
    // one place a single statement could publish all of it at once.
    expect(sql).not.toMatch(/\bupdate public\.votes\b(?![^;]*\bp_vote_id\b)/);
    expect(sql).not.toMatch(/\b(insert into|delete from) public\.votes\b/);
    expect(sql).not.toContain('alter table public.votes');
  });
});
