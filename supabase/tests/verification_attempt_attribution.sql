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

ROLLBACK;
