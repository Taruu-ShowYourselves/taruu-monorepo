-- Manual evidence probe: space_audit_log is append-only and never erases history.
--
-- HOW TO RUN
--   supabase db reset                      # or apply migrations to a scratch DB
--   psql "$SCRATCH_DATABASE_URL" -f supabase/tests/audit_append_only.sql
--
-- THIS IS NOT PART OF `pnpm test`. apps/web/vitest.config.ts runs with
-- environment: 'node' and Supabase fully mocked, so there is no live-database
-- harness in CI. The transcript this script prints is captured by hand and
-- pasted into the plan SUMMARY as SPACE-04 / SPACE-09 evidence. Do not claim
-- CI coverage for it anywhere.
--
-- Every case prints exactly one PASS or FAIL line. A clean run prints six
-- PASS lines and no FAIL lines.
--
-- The script creates its own scratch actor and space, runs against them, and
-- leaves them behind on purpose: the audit row it inserts cannot be deleted,
-- which is the whole point. Run it against a throwaway database.

\set ON_ERROR_STOP off
\timing off

BEGIN;

-- ---------------------------------------------------------------------------
-- Fixtures. Deterministic UUIDs so the assertions below can reference them.
-- ---------------------------------------------------------------------------
INSERT INTO public.users (id, email)
VALUES ('00000000-0000-4000-8000-0000000000a1', 'audit-probe-actor@example.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.spaces (id, type, slug, name_he, verification_state)
VALUES ('00000000-0000-4000-8000-0000000000b1', 'organization',
        'audit-probe-space', 'מרחב בדיקה', 'unverified')
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------------
-- Case 1: a valid append lands.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  inserted_id UUID;
BEGIN
  INSERT INTO public.space_audit_log
    (space_id, actor_user_id, action, object_type, object_id, prior_state, new_state, reason)
  VALUES
    ('00000000-0000-4000-8000-0000000000b1',
     '00000000-0000-4000-8000-0000000000a1',
     'proposal.approved', 'vote', '00000000-0000-4000-8000-0000000000c1',
     '{"status":"in_review"}'::jsonb, '{"status":"active"}'::jsonb,
     'append-only probe: baseline valid insert')
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL THEN
    RAISE NOTICE 'FAIL: valid append returned no id';
  ELSE
    RAISE NOTICE 'PASS: valid audit row appended (%)', inserted_id;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL: valid append rejected (% / %)', SQLSTATE, SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- Case 2: UPDATE is refused (SQLSTATE 42501, insufficient_privilege).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  UPDATE public.space_audit_log
  SET reason = 'tampered value here'
  WHERE space_id = '00000000-0000-4000-8000-0000000000b1';
  RAISE NOTICE 'FAIL: UPDATE on space_audit_log succeeded';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: UPDATE refused with SQLSTATE % (%)', SQLSTATE, SQLERRM;
  WHEN OTHERS THEN
    RAISE NOTICE 'FAIL: UPDATE refused with unexpected SQLSTATE % (%)', SQLSTATE, SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- Case 3: DELETE is refused (SQLSTATE 42501).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  DELETE FROM public.space_audit_log
  WHERE space_id = '00000000-0000-4000-8000-0000000000b1';
  RAISE NOTICE 'FAIL: DELETE on space_audit_log succeeded';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: DELETE refused with SQLSTATE % (%)', SQLSTATE, SQLERRM;
  WHEN OTHERS THEN
    RAISE NOTICE 'FAIL: DELETE refused with unexpected SQLSTATE % (%)', SQLSTATE, SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- Case 4: TRUNCATE is refused (SQLSTATE 42501). The statement-level trigger
-- fires even though TRUNCATE bypasses row triggers entirely.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  TRUNCATE public.space_audit_log;
  RAISE NOTICE 'FAIL: TRUNCATE on space_audit_log succeeded';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: TRUNCATE refused with SQLSTATE % (%)', SQLSTATE, SQLERRM;
  WHEN OTHERS THEN
    RAISE NOTICE 'FAIL: TRUNCATE refused with unexpected SQLSTATE % (%)', SQLSTATE, SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- Case 5: a blank reason is refused by the CHECK (SQLSTATE 23514).
-- The API contract requires at least 10 non-blank characters.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  INSERT INTO public.space_audit_log
    (space_id, actor_user_id, action, object_type, reason)
  VALUES
    ('00000000-0000-4000-8000-0000000000b1',
     '00000000-0000-4000-8000-0000000000a1',
     'space.updated', 'space', '  ');
  RAISE NOTICE 'FAIL: blank reason accepted';
EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE 'PASS: blank reason refused with SQLSTATE % ', SQLSTATE;
  WHEN OTHERS THEN
    RAISE NOTICE 'FAIL: blank reason refused with unexpected SQLSTATE % (%)', SQLSTATE, SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- Case 6 (SPACE-09): deleting the actor is refused by ON DELETE RESTRICT
-- (SQLSTATE 23503). Suspending an admin must never erase their decisions, and
-- this is what makes that structurally true rather than a matter of discipline.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  DELETE FROM public.users WHERE id = '00000000-0000-4000-8000-0000000000a1';
  RAISE NOTICE 'FAIL: actor with audit history was deletable';
EXCEPTION
  WHEN foreign_key_violation THEN
    RAISE NOTICE 'PASS: actor deletion refused with SQLSTATE % (audit history preserved)', SQLSTATE;
  WHEN OTHERS THEN
    RAISE NOTICE 'FAIL: actor deletion refused with unexpected SQLSTATE % (%)', SQLSTATE, SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- Final state: the baseline row from case 1 must still be present and unaltered.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  surviving INT;
BEGIN
  SELECT count(*) INTO surviving
  FROM public.space_audit_log
  WHERE space_id = '00000000-0000-4000-8000-0000000000b1'
    AND reason = 'append-only probe: baseline valid insert';

  IF surviving = 1 THEN
    RAISE NOTICE 'PASS: baseline audit row survived every mutation attempt';
  ELSE
    RAISE NOTICE 'FAIL: expected 1 surviving baseline row, found %', surviving;
  END IF;
END $$;
