-- A check-in is attributed to the resident whose run scheduled it.
--
-- Two users, two runs, on purpose. With one user every assertion here passes
-- against the single-column foreign keys this migration replaces, and the test
-- would prove nothing about the pair.
--
-- Section 4 asserts `convalidated` on both composite keys and the ABSENCE of
-- the two single-column keys they replace. A NOT VALID constraint behaves like
-- a real one for every new row, so no behavioural test can tell them apart; and
-- a leftover weaker key is the thing a future reader would take as licence to
-- believe the pair is not really required.
--
-- Driven by scripts/db-test.sh. Wraps itself in BEGIN/ROLLBACK.

BEGIN;

DO $test$
DECLARE
  v_alice     UUID := gen_random_uuid();
  v_bob       UUID := gen_random_uuid();
  v_run_a     UUID;
  v_run_b     UUID;
  v_window_a  UUID;
  v_attempt   UUID;
  seen        TEXT;
BEGIN
  INSERT INTO public.municipalities (code, name_he, slug_he)
       VALUES ('vaa-test-muni', 'רשות נוכחות', 'vaa-test-muni')
  ON CONFLICT (code) DO NOTHING;
  INSERT INTO public.users (id, email, municipality_id)
       VALUES (v_alice, 'alice@example.test', 'vaa-test-muni'),
              (v_bob,   'bob@example.test',   'vaa-test-muni');

  INSERT INTO public.verification_runs (user_id, municipality_id, total_check_ins)
       VALUES (v_alice, 'vaa-test-muni', 5) RETURNING id INTO v_run_a;
  INSERT INTO public.verification_runs (user_id, municipality_id, total_check_ins)
       VALUES (v_bob,   'vaa-test-muni', 5) RETURNING id INTO v_run_b;

  -- ── 1. a window belongs to its run's resident ─────────────────────────────
  INSERT INTO public.verification_schedule (run_id, user_id, window_start, window_end)
       VALUES (v_run_a, v_alice, now(), now() + interval '30 minutes')
    RETURNING id INTO v_window_a;
  IF v_window_a IS NULL THEN
    RAISE EXCEPTION 'a window for its own run''s resident was refused';
  END IF;

  -- ── 2. a window claiming somebody else's resident is refused ──────────────
  -- Without this the denormalised column would be free to drift from the run,
  -- and every attempt pinned to it would inherit the wrong person.
  seen := NULL;
  BEGIN
    INSERT INTO public.verification_schedule (run_id, user_id, window_start, window_end)
         VALUES (v_run_a, v_bob, now(), now() + interval '30 minutes');
  EXCEPTION WHEN foreign_key_violation THEN
    seen := 'refused';
  END;
  IF seen IS NULL THEN
    RAISE EXCEPTION 'a window was created under a resident who does not own the run';
  END IF;

  -- ── 3. an attempt under the window's own resident is accepted ─────────────
  INSERT INTO public.verification_attempts
         (schedule_id, user_id, latitude, longitude, accuracy, passed)
       VALUES (v_window_a, v_alice, 32.0853, 34.7818, 10, TRUE)
    RETURNING id INTO v_attempt;
  IF v_attempt IS NULL THEN
    RAISE EXCEPTION 'a check-in by the run''s own resident was refused';
  END IF;

  -- ── 3b. an attempt attributing the check-in to somebody else is refused ───
  -- THE case. Bob is a real user with a real run of his own, and Alice's window
  -- is a real window: every single-column foreign key in the old shape is
  -- satisfied. Only the pair refuses it. This is one person's physical presence
  -- counting as another person's residency, and residency is the ballot gate.
  seen := NULL;
  BEGIN
    INSERT INTO public.verification_attempts
           (schedule_id, user_id, latitude, longitude, accuracy, passed)
         VALUES (v_window_a, v_bob, 32.0853, 34.7818, 10, TRUE);
  EXCEPTION WHEN foreign_key_violation THEN
    seen := 'refused';
  END;
  IF seen IS NULL THEN
    RAISE EXCEPTION
      'a check-in was attributed to a resident who does not own the window';
  END IF;

  -- ── 3c. an invented user is refused ───────────────────────────────────────
  -- Note what this does and does NOT prove. An invented uuid fails the
  -- composite key too - it cannot match the window's (id, user_id) pair - so
  -- this would keep passing if `verification_attempts_user_id_fkey` were
  -- dropped. The users key is asserted for real in section 4, in the catalog,
  -- which is the only place that can tell the two apart.
  seen := NULL;
  BEGIN
    INSERT INTO public.verification_attempts
           (schedule_id, user_id, latitude, longitude, accuracy, passed)
         VALUES (v_window_a, gen_random_uuid(), 32.0853, 34.7818, 10, TRUE);
  EXCEPTION WHEN foreign_key_violation THEN
    seen := 'refused';
  END;
  IF seen IS NULL THEN
    RAISE EXCEPTION 'a check-in was attributed to a user that does not exist';
  END IF;

  -- ── 3d. the cascade still reaches the whole chain ─────────────────────────
  -- The composite keys replaced cascading single-column keys, and a foreign key
  -- that forgets ON DELETE CASCADE turns a user deletion into a constraint
  -- error instead of a clean removal.
  DELETE FROM public.verification_runs WHERE id = v_run_a;
  IF EXISTS (SELECT 1 FROM public.verification_schedule WHERE id = v_window_a) THEN
    RAISE EXCEPTION 'deleting the run left its windows behind';
  END IF;
  IF EXISTS (SELECT 1 FROM public.verification_attempts WHERE id = v_attempt) THEN
    RAISE EXCEPTION 'deleting the run left its check-ins behind';
  END IF;

  RAISE NOTICE 'verification attempt attribution: behaviour OK';
END;
$test$;

-- ── 4. the catalog says what the behaviour implies ──────────────────────────
DO $catalog$
DECLARE
  r     RECORD;
  found INTEGER := 0;
BEGIN
  FOR r IN
    SELECT c.conname, c.contype, c.convalidated, c.confdeltype
      FROM pg_constraint c
      JOIN pg_class t     ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
       AND c.conname IN ('verification_schedule_belongs_to_its_run',
                         'verification_attempts_belongs_to_its_run')
  LOOP
    found := found + 1;
    IF r.contype <> 'f' THEN
      RAISE EXCEPTION '% is not a foreign key', r.conname;
    END IF;
    IF NOT r.convalidated THEN
      RAISE EXCEPTION
        '% is NOT VALID - it exempts every row that already existed', r.conname;
    END IF;
    IF r.confdeltype <> 'c' THEN
      RAISE EXCEPTION
        '% has ON DELETE %, expected CASCADE', r.conname, r.confdeltype;
    END IF;
  END LOOP;

  IF found <> 2 THEN
    RAISE EXCEPTION 'expected both composite attribution keys, found %', found;
  END IF;

  -- The single-column keys they replace must be gone. Left in place they
  -- enforce nothing the pairs do not, and they read as an alternative rule.
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
      JOIN pg_class t     ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
       AND c.conname IN ('verification_schedule_run_id_fkey',
                         'verification_attempts_schedule_id_fkey')
  ) THEN
    RAISE EXCEPTION 'a superseded single-column foreign key is still present';
  END IF;

  -- The direct users key is NOT made redundant by the composite key and is
  -- deliberately kept: it is what makes check-ins vanish with a deleted user,
  -- and it anchors the column to a real person independently of any schedule.
  -- Asserted here rather than behaviourally, because no insert can distinguish
  -- it from the composite key - every user id the composite key accepts is by
  -- construction a real user.
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint c
      JOIN pg_class t      ON t.oid = c.conrelid
      JOIN pg_namespace n  ON n.oid = t.relnamespace
      JOIN pg_class ft     ON ft.oid = c.confrelid
     WHERE n.nspname  = 'public'
       AND t.relname  = 'verification_attempts'
       AND ft.relname = 'users'
       AND c.contype  = 'f'
       AND array_length(c.conkey, 1) = 1
       AND c.conkey[1] = (
             SELECT attnum FROM pg_attribute
              WHERE attrelid = t.oid AND attname = 'user_id'
           )
  ) THEN
    RAISE EXCEPTION
      'verification_attempts.user_id no longer references users - the composite '
      'key does not replace it, and dropping it is explicitly out of scope';
  END IF;

  -- And the column the composite key hangs on must be NOT NULL, or a window
  -- with a NULL user would slip past the pair entirely under MATCH SIMPLE.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'verification_schedule'
       AND column_name  = 'user_id'
       AND is_nullable  = 'YES'
  ) THEN
    RAISE EXCEPTION
      'verification_schedule.user_id is nullable - MATCH SIMPLE skips the '
      'composite key entirely when it is NULL';
  END IF;

  RAISE NOTICE 'verification attempt attribution: catalog OK';
END;
$catalog$;

-- ── 5. the expand/contract rollout contract ─────────────────────────────────
--
-- 20260904000008 (expand) had to be applicable while the PREVIOUS application
-- was still serving, and that application writes verification_schedule without
-- a user_id. The trigger it added is what made that possible, and it is what
-- guaranteed no NULL accumulated for 20260904000010 (contract) to trip over.
--
-- The window is over, but the property is still worth holding: it is the
-- difference between a denormalised column that fills itself from the
-- authoritative row and one that fails whenever a writer forgets it. These
-- assertions are the negative controls for that - remove the trigger, or let
-- it start guessing, and they fail.

DO $rollout$
DECLARE
  v_carol    UUID := gen_random_uuid();
  v_dave     UUID := gen_random_uuid();
  v_run_c    UUID;
  v_run_d    UUID;
  v_window   UUID;
  v_derived  UUID;
  seen       TEXT;
BEGIN
  INSERT INTO public.municipalities (code, name_he, slug_he)
       VALUES ('vaa-rollout-muni', 'רשות גלגול', 'vaa-rollout-muni')
  ON CONFLICT (code) DO NOTHING;
  INSERT INTO public.users (id, email, municipality_id)
       VALUES (v_carol, 'carol@example.test', 'vaa-rollout-muni'),
              (v_dave,  'dave@example.test',  'vaa-rollout-muni');

  INSERT INTO public.verification_runs (user_id, municipality_id, total_check_ins)
       VALUES (v_carol, 'vaa-rollout-muni', 5) RETURNING id INTO v_run_c;
  INSERT INTO public.verification_runs (user_id, municipality_id, total_check_ins)
       VALUES (v_dave,  'vaa-rollout-muni', 5) RETURNING id INTO v_run_d;

  -- ── 5a. the pre-deploy writer's INSERT still works ────────────────────────
  -- Exactly the shape the application shipped before #145: no user_id column
  -- named at all. Under the one-shot form of 20260904000008 this raised
  -- not_null_violation, which is the outage the split exists to prevent.
  INSERT INTO public.verification_schedule (run_id, window_start, window_end)
       VALUES (v_run_c, now(), now() + interval '30 minutes')
    RETURNING id, user_id INTO v_window, v_derived;

  IF v_window IS NULL THEN
    RAISE EXCEPTION
      'a window written without a user_id was refused - the pre-deploy writer '
      'would have been broken by this schema';
  END IF;

  -- ── 5b. and it is filled from the run, not left NULL ──────────────────────
  IF v_derived IS DISTINCT FROM v_carol THEN
    RAISE EXCEPTION
      'user_id derived as % but the run belongs to %', v_derived, v_carol;
  END IF;

  -- ── 5c. an explicit user_id is passed through, never overwritten ──────────
  -- If the trigger overrode what the caller supplied it would be silently
  -- repairing wrong input, and section 2 above - a window claiming somebody
  -- else's resident - could never fail. The foreign key must stay the thing
  -- that decides.
  seen := NULL;
  BEGIN
    INSERT INTO public.verification_schedule (run_id, user_id, window_start, window_end)
         VALUES (v_run_c, v_dave, now(), now() + interval '30 minutes');
  EXCEPTION WHEN foreign_key_violation THEN
    seen := 'refused';
  END;
  IF seen IS NULL THEN
    RAISE EXCEPTION
      'the trigger overwrote a caller-supplied user_id instead of letting the '
      'composite key refuse it';
  END IF;

  -- ── 5d. an attempt against a derived window resolves ──────────────────────
  -- The third failure mode the split had to remove: a schedule row carrying a
  -- NULL user_id exposes no (id, user_id) pair, so the attempts composite key
  -- matches nothing and the check-in path breaks even though nothing about
  -- attempts changed.
  INSERT INTO public.verification_attempts
         (schedule_id, user_id, latitude, longitude, accuracy, passed)
       VALUES (v_window, v_carol, 32.0853, 34.7818, 10, TRUE);

  RAISE NOTICE 'verification attempt attribution: rollout compatibility OK';
END;
$rollout$;

-- ── 6. the contract phase actually contracted ───────────────────────────────

DO $contract$
DECLARE
  leftover TEXT;
BEGIN
  -- The trigger 20260904000010 deliberately keeps.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
     WHERE t.tgrelid = 'public.verification_schedule'::regclass
       AND t.tgname  = 'verification_schedule_derive_user_id'
       AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION
      'verification_schedule_derive_user_id is gone - a writer that omits the '
      'denormalised column now fails instead of resolving it';
  END IF;

  -- The two single-column keys the composite ones supersede. Kept through the
  -- expand window on purpose, dropped by 20260904000010. Leaving them behind
  -- is not a correctness bug, but it leaves two keys that can be read as
  -- disagreeing about the same relationship.
  SELECT string_agg(conname, ', ' ORDER BY conname)
    INTO leftover
    FROM pg_constraint
   WHERE conname IN ('verification_schedule_run_id_fkey',
                     'verification_attempts_schedule_id_fkey');

  IF leftover IS NOT NULL THEN
    RAISE EXCEPTION
      'superseded single-column foreign key(s) still present: %', leftover
      USING HINT = '20260904000010 drops these once user_id is NOT NULL.';
  END IF;

  -- Both composite keys must be VALIDATED, not merely declared. A NOT VALID
  -- constraint accepts every row that already existed, which on this table is
  -- the entire residency history.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname IN ('verification_schedule_belongs_to_its_run',
                       'verification_attempts_belongs_to_its_run')
       AND NOT convalidated
  ) THEN
    RAISE EXCEPTION 'a residency composite key was left NOT VALID';
  END IF;

  RAISE NOTICE 'verification attempt attribution: contract phase OK';
END;
$contract$;

ROLLBACK;
