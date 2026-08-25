-- A verification run belongs to a real municipality.
--
-- The assertion that matters most is section 3: a NOT VALID foreign key that
-- was never validated behaves like a real one for every new row, so no
-- behavioural test can tell the two apart -- only `pg_constraint.convalidated`
-- can, and an unvalidated constraint silently exempts whatever was already in
-- the table.
--
-- Driven by scripts/db-test.sh. Wraps itself in BEGIN/ROLLBACK.

BEGIN;

DO $test$
DECLARE
  v_user UUID := gen_random_uuid();
  v_run  UUID;
  seen   TEXT;
BEGIN
  -- Two municipalities on purpose. If the run and its user shared one, the
  -- deletion assertion in section 3 would be satisfied by `users_municipality_fk`
  -- and would prove nothing about the constraint this migration adds.
  INSERT INTO public.municipalities (code, name_he, slug_he)
       VALUES ('vrm-test-muni',  'רשות אימות', 'vrm-test-muni'),
              ('vrm-user-muni',  'רשות משתמש', 'vrm-user-muni')
  ON CONFLICT (code) DO NOTHING;
  INSERT INTO public.users (id, email, municipality_id)
       VALUES (v_user, 'runs@example.test', 'vrm-user-muni');

  -- ── 1. a run against a real municipality is unaffected ────────────────────
  INSERT INTO public.verification_runs (user_id, municipality_id, total_check_ins)
       VALUES (v_user, 'vrm-test-muni', 5)
    RETURNING id INTO v_run;
  IF v_run IS NULL THEN
    RAISE EXCEPTION 'a run against a real municipality was refused';
  END IF;

  -- ── 2. a code that names no municipality is refused ───────────────────────
  -- Before this constraint the column was a municipality code by convention
  -- only, so a typo produced a run pointing at nowhere.
  seen := NULL;
  BEGIN
    INSERT INTO public.verification_runs (user_id, municipality_id, total_check_ins)
         VALUES (v_user, 'vrm-test-muni-typo', 5);
  EXCEPTION WHEN foreign_key_violation THEN
    seen := 'refused';
  END;
  IF seen IS DISTINCT FROM 'refused' THEN
    RAISE EXCEPTION 'a verification run was accepted for a municipality code '
                    'that does not exist';
  END IF;

  -- An UPDATE has to be refused too; a constraint that only guards INSERT
  -- leaves the same hole one statement further along.
  seen := NULL;
  BEGIN
    UPDATE public.verification_runs
       SET municipality_id = 'vrm-test-muni-typo'
     WHERE id = v_run;
  EXCEPTION WHEN foreign_key_violation THEN
    seen := 'refused';
  END;
  IF seen IS DISTINCT FROM 'refused' THEN
    RAISE EXCEPTION 'a verification run was updated to a municipality code '
                    'that does not exist';
  END IF;

  -- ── 3. deleting a municipality that has runs is refused ───────────────────
  -- RESTRICT rather than CASCADE: verification history is evidence about a
  -- person, and it must not disappear as a side effect of tidying reference
  -- data. 'vrm-test-muni' is referenced ONLY by the run -- no user lives there
  -- -- so the refusal below can only come from the new constraint.
  seen := NULL;
  BEGIN
    DELETE FROM public.municipalities WHERE code = 'vrm-test-muni';
  EXCEPTION WHEN foreign_key_violation THEN
    seen := 'refused';
  END;
  IF seen IS DISTINCT FROM 'refused' THEN
    RAISE EXCEPTION 'a municipality with verification runs was deleted';
  END IF;
END;
$test$;

-- ── 4. the constraint is validated, not merely declared ─────────────────────
-- Read from the catalog rather than from `pg_get_constraintdef`, whose text
-- schema-qualifies or not depending on the caller's search_path -- so a LIKE
-- against it can fail on a correct constraint, or pass on one pointing at a
-- `municipalities` table in some other schema.
DO $validated$
DECLARE
  v_parent    OID;
  v_cols      TEXT;
  v_delaction "char";
  v_validated BOOLEAN;
BEGIN
  SELECT c.confrelid,
         (SELECT string_agg(a.attname, ',' ORDER BY k.ord)
            FROM unnest(c.confkey) WITH ORDINALITY AS k(attnum, ord)
            JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.attnum),
         c.confdeltype,
         c.convalidated
    INTO v_parent, v_cols, v_delaction, v_validated
    FROM pg_constraint c
   WHERE c.conrelid = 'public.verification_runs'::regclass
     AND c.conname = 'verification_runs_municipality_fk'
     AND c.contype = 'f';

  IF v_parent IS NULL THEN
    RAISE EXCEPTION 'verification_runs_municipality_fk does not exist; '
                    'municipality_id is a municipality code by convention again';
  END IF;
  IF v_parent <> 'public.municipalities'::regclass THEN
    RAISE EXCEPTION 'the constraint references %, not public.municipalities',
      v_parent::regclass;
  END IF;
  IF v_cols IS DISTINCT FROM 'code' THEN
    RAISE EXCEPTION 'the constraint references municipalities(%), not (code)', v_cols;
  END IF;
  IF v_delaction <> 'r' THEN
    RAISE EXCEPTION 'the constraint does not RESTRICT deletion of a municipality '
                    'with verification history (confdeltype is %)', v_delaction;
  END IF;
  IF NOT v_validated THEN
    RAISE EXCEPTION 'the constraint was added NOT VALID and never validated, so '
                    'rows that existed beforehand are exempt from it -- which '
                    'is indistinguishable from a validated constraint in every '
                    'behavioural test';
  END IF;
END;
$validated$;

-- ── 5. the referencing column is indexed ────────────────────────────────────
DO $child_index$
BEGIN
  -- Each qualifier rules out an index that exists but cannot be used: a PARTIAL
  -- index covers only some rows, and an index left `indisvalid = false` by a
  -- failed CREATE INDEX CONCURRENTLY is ignored by the planner entirely. Either
  -- would satisfy a naive existence check while the RESTRICT scan still fell
  -- back to a sequential scan.
  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
     WHERE i.indrelid = 'public.verification_runs'::regclass
       AND i.indpred IS NULL
       AND i.indisvalid
       AND i.indislive
       AND i.indkey[0] = (SELECT attnum FROM pg_attribute
                           WHERE attrelid = 'public.verification_runs'::regclass
                             AND attname = 'municipality_id')
  ) THEN
    RAISE EXCEPTION 'municipality_id has no unconditional index leading with it, '
                    'so enforcing ON DELETE RESTRICT has to scan the whole table';
  END IF;
END;
$child_index$;

-- ── 6. it is no longer the exception ────────────────────────────────────────
-- This migration's entire argument was that `verification_runs` held the only
-- municipality code in the schema that was not anchored to `municipalities`.
-- That claim lives here, next to the change it justifies, rather than in a
-- comment that cannot fail: a future table reintroducing a bare municipality
-- code makes this migration's premise false, and the failure message says so.
DO $convention$
DECLARE
  v_bare TEXT;
BEGIN
  SELECT string_agg(format('%I.%I', c.relname, a.attname), ', ' ORDER BY c.relname)
    INTO v_bare
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     -- 'p' as well as 'r': a partitioned table is where this convention is
     -- most likely to be reintroduced and least likely to be noticed.
     AND c.relkind IN ('r', 'p')
     AND a.attnum > 0
     AND NOT a.attisdropped
     AND a.attname IN ('municipality_id', 'municipality_code')
     AND c.relname <> 'municipalities'
     -- The column must be ANCHORED to `municipalities`, directly or through one
     -- table that is itself anchored. `pilot_campaigns`, `pilot_links` and
     -- `pilot_votes` reference `pilot_municipalities`, whose own
     -- municipality_id is a foreign key to `municipalities(code)` -- so their
     -- codes are guaranteed real, just not in one hop. Requiring a direct
     -- reference would flag them; accepting any foreign key at all would
     -- accept a column pointing somewhere unrelated.
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint fk
        WHERE fk.conrelid = c.oid
          AND fk.contype = 'f'
          -- An unvalidated foreign key exempts every row that existed when it
          -- was declared, so it does not anchor anything already stored.
          AND fk.convalidated
          AND a.attnum = ANY (fk.conkey)
          AND (
            fk.confrelid = 'public.municipalities'::regclass
            OR EXISTS (
              -- The hop must anchor THE SAME column this key points at. A
              -- parent table that happens to reference municipalities on some
              -- other column says nothing about this one.
              SELECT 1
                FROM pg_constraint hop
               WHERE hop.conrelid = fk.confrelid
                 AND hop.contype = 'f'
                 AND hop.convalidated
                 AND hop.confrelid = 'public.municipalities'::regclass
                 AND fk.confkey[array_position(fk.conkey, a.attnum)] = ANY (hop.conkey)
            )
          )
     );

  IF v_bare IS NOT NULL THEN
    RAISE EXCEPTION 'these municipality references are not anchored to '
                    'public.municipalities, directly or through one hop: %. '
                    'verification_runs used to be the only one; a new '
                    'unanchored code is the same defect returning.', v_bare;
  END IF;
END;
$convention$;

ROLLBACK;
