import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260818000002_ingest_auto_activation.sql'
  ),
  'utf8'
);
const sql = migration.replace(/\s+/g, ' ').toLowerCase();

describe('ingest auto-activation migration contract', () => {
  it('is callable only by the service role', () => {
    expect(sql).toContain(
      'revoke all on function public.activate_ingest_vote(uuid, uuid) from public, anon, authenticated'
    );
    expect(sql).toContain(
      'grant execute on function public.activate_ingest_vote(uuid, uuid) to service_role'
    );
  });

  it('targets one pending machine vote and every publication predicate', () => {
    expect(sql).toContain('where v.id = p_vote_id');
    expect(sql).toContain('v.creator_id = p_ingest_creator_id');
    expect(sql).toContain("v.status = 'pending'");
    expect(sql).toContain('v.start_date <= now()');
    expect(sql).toContain('v.hidden_at is null');
    expect(sql).toContain('v.flagged_at is null');
    expect(sql).toContain('source.post_count >= 1');
    expect(sql).toContain('from public.vote_options as option');
    expect(sql).toMatch(/count\(\*\).*option\.vote_id = v\.id.*>= 2/);
  });

  it('is retry-safe without scanning or backfilling pending rows', () => {
    expect(sql).toContain("v.status = 'active'");
    expect(sql).not.toMatch(/update public\.votes as v set[\s\S]*where v\.status = 'pending'/);
    expect(sql).not.toContain('alter table public.votes');
  });
});
