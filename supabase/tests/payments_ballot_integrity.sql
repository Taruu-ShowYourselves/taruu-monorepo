-- A participation payment names a real ballot choice.
--
-- The legal shapes are stated per payment TYPE: a participation payment names
-- both a vote and an option, a creation fee names no option. Section 2 walks
-- every illegal combination.
--
-- The interesting one is (option, NULL vote): a multi-column foreign key under
-- the default MATCH SIMPLE is not checked at all when any of its columns is
-- NULL, so the foreign key alone would let that row through while appearing to
-- have anchored it. 2a is the assertion that the paired CHECK is what actually
-- stops it -- delete the CHECK from the migration and 2a fails while every
-- other section still passes.
--
-- Section 5 asserts `convalidated` on both constraints. A NOT VALID constraint
-- that was never validated behaves identically to a real one for every new row,
-- so no behavioural test can distinguish them; only the catalog can, and an
-- unvalidated constraint silently exempts everything already in the table.
--
-- Driven by scripts/db-test.sh. Wraps itself in BEGIN/ROLLBACK.

BEGIN;

DO $test$
DECLARE
  v_user     UUID := gen_random_uuid();
  v_vote     UUID := gen_random_uuid();
  v_other    UUID := gen_random_uuid();
  v_opt      UUID;
  v_opt_other UUID;
  v_payment  UUID;
  seen       TEXT;
BEGIN
  INSERT INTO public.municipalities (code, name_he, slug_he)
       VALUES ('pbi-test-muni', 'רשות תשלומים', 'pbi-test-muni')
  ON CONFLICT (code) DO NOTHING;
  INSERT INTO public.users (id, email, municipality_id)
       VALUES (v_user, 'ballots@example.test', 'pbi-test-muni');

  -- Two votes, so "belongs to a vote" can be told apart from "exists at all".
  -- A test with one vote passes against a single-column foreign key too, which
  -- is the constraint this migration deliberately did NOT add.
  INSERT INTO public.votes (id, creator_id, title, description, municipality_id, end_date)
       VALUES (v_vote,  v_user, 'הצבעה א', 'תיאור', 'pbi-test-muni', now() + interval '7 days'),
              (v_other, v_user, 'הצבעה ב', 'תיאור', 'pbi-test-muni', now() + interval '7 days');

  INSERT INTO public.vote_options (vote_id, text) VALUES (v_vote,  'בעד')
    RETURNING id INTO v_opt;
  INSERT INTO public.vote_options (vote_id, text) VALUES (v_other, 'נגד')
    RETURNING id INTO v_opt_other;

  -- ── 1. the three legal shapes are all still accepted ──────────────────────
  -- A constraint that also refuses correct rows is not a fix, and the creation
  -- fee `createCreationFeePort` writes today is the (NULL, vote) shape, which
  -- MATCH FULL would have rejected.
  INSERT INTO public.payments (user_id, type, amount, idempotency_key, vote_id, option_id)
       VALUES (v_user, 'vote_creation', 5000, 'pbi-fee-no-vote',  NULL,   NULL),
              (v_user, 'vote_creation', 5000, 'pbi-fee-with-vote', v_vote, NULL);

  INSERT INTO public.payments (user_id, type, amount, idempotency_key, vote_id, option_id)
       VALUES (v_user, 'vote_participation', 300, 'pbi-ballot', v_vote, v_opt)
    RETURNING id INTO v_payment;
  IF v_payment IS NULL THEN
    RAISE EXCEPTION 'a participation payment naming a real option was refused';
  END IF;

  -- ── 2a. an option with no vote is refused ─────────────────────────────────
  -- The MATCH SIMPLE hole. This must fail with check_violation specifically:
  -- foreign_key_violation here would mean the foreign key somehow caught it and
  -- the CHECK is redundant, which is not what MATCH SIMPLE does.
  seen := NULL;
  BEGIN
    INSERT INTO public.payments (user_id, type, amount, idempotency_key, vote_id, option_id)
         VALUES (v_user, 'vote_participation', 300, 'pbi-orphan-option', NULL, v_opt);
  EXCEPTION WHEN check_violation THEN
    seen := 'refused';
  END;
  IF seen IS NULL THEN
    RAISE EXCEPTION
      'a payment carrying an option with no vote was accepted - the CHECK is '
      'missing, and the composite foreign key does not cover this shape';
  END IF;

  -- ── 2b. a participation payment with no ballot ids is refused ─────────────
  -- The shape the weaker "an option implies a vote" rule admitted. Nothing is
  -- NULL-violating about it structurally; it is simply a charge for a ballot
  -- the webhook will never cast, because it casts only when BOTH ids are
  -- present. The route refuses it, and alternate writers exist.
  seen := NULL;
  BEGIN
    INSERT INTO public.payments (user_id, type, amount, idempotency_key, vote_id, option_id)
         VALUES (v_user, 'vote_participation', 300, 'pbi-no-ids', NULL, NULL);
  EXCEPTION WHEN check_violation THEN
    seen := 'refused';
  END;
  IF seen IS NULL THEN
    RAISE EXCEPTION
      'a participation payment with neither a vote nor an option was accepted - '
      'it can be charged and can never produce a ballot';
  END IF;

  -- ── 2c. a participation payment naming a vote but no option is refused ────
  seen := NULL;
  BEGIN
    INSERT INTO public.payments (user_id, type, amount, idempotency_key, vote_id, option_id)
         VALUES (v_user, 'vote_participation', 300, 'pbi-no-option', v_vote, NULL);
  EXCEPTION WHEN check_violation THEN
    seen := 'refused';
  END;
  IF seen IS NULL THEN
    RAISE EXCEPTION
      'a participation payment with no ballot choice was accepted';
  END IF;

  -- ── 2d. a creation fee carrying a ballot choice is refused ────────────────
  -- Real vote, real option of that vote, so the foreign key is satisfied. Only
  -- the type-aware CHECK refuses it. A fee buys the right to open a vote; it
  -- does not buy a choice inside one.
  seen := NULL;
  BEGIN
    INSERT INTO public.payments (user_id, type, amount, idempotency_key, vote_id, option_id)
         VALUES (v_user, 'vote_creation', 5000, 'pbi-fee-with-option', v_vote, v_opt);
  EXCEPTION WHEN check_violation THEN
    seen := 'refused';
  END;
  IF seen IS NULL THEN
    RAISE EXCEPTION 'a creation fee carrying a ballot choice was accepted';
  END IF;

  -- ── 3. an option belonging to a DIFFERENT vote is refused ─────────────────
  -- The case a single-column foreign key on option_id would have allowed: the
  -- option is real, the vote is real, and the pair is a charge whose ballot
  -- `cast_vote` will refuse in the webhook, after the money has moved.
  seen := NULL;
  BEGIN
    INSERT INTO public.payments (user_id, type, amount, idempotency_key, vote_id, option_id)
         VALUES (v_user, 'vote_participation', 300, 'pbi-crossed', v_vote, v_opt_other);
  EXCEPTION WHEN foreign_key_violation THEN
    seen := 'refused';
  END;
  IF seen IS NULL THEN
    RAISE EXCEPTION 'a payment naming another vote''s option was accepted';
  END IF;

  -- ── 3b. an option that exists nowhere is refused ──────────────────────────
  seen := NULL;
  BEGIN
    INSERT INTO public.payments (user_id, type, amount, idempotency_key, vote_id, option_id)
         VALUES (v_user, 'vote_participation', 300, 'pbi-invented', v_vote, gen_random_uuid());
  EXCEPTION WHEN foreign_key_violation THEN
    seen := 'refused';
  END;
  IF seen IS NULL THEN
    RAISE EXCEPTION 'a payment naming an option that does not exist was accepted';
  END IF;

  -- ── 4. the payment record outlives the vote ───────────────────────────────
  -- ON DELETE RESTRICT, not CASCADE. Deleting the vote cascades to its options,
  -- and the payment must block that rather than disappear with it. Asserted by
  -- deletion actually failing AND by the row still being there afterwards - a
  -- CASCADE would satisfy neither, and this is the difference between keeping a
  -- financial record and destroying one.
  seen := NULL;
  BEGIN
    DELETE FROM public.votes WHERE id = v_vote;
  EXCEPTION WHEN foreign_key_violation THEN
    seen := 'blocked';
  END;
  IF seen IS NULL THEN
    RAISE EXCEPTION
      'deleting a vote destroyed or orphaned the payments made into it';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.payments WHERE id = v_payment) THEN
    RAISE EXCEPTION 'the payment record did not survive the attempted deletion';
  END IF;

  RAISE NOTICE 'payments ballot integrity: behaviour OK';
END;
$test$;

-- ── 5. both constraints exist AND were validated ────────────────────────────
DO $catalog$
DECLARE
  r RECORD;
  found INTEGER := 0;
BEGIN
  FOR r IN
    SELECT c.conname, c.contype, c.convalidated, c.confdeltype
      FROM pg_constraint c
      JOIN pg_class t     ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
       AND t.relname = 'payments'
       AND c.conname IN ('payments_ids_match_type',
                         'payments_option_belongs_to_vote')
  LOOP
    found := found + 1;
    IF NOT r.convalidated THEN
      RAISE EXCEPTION
        '% is NOT VALID - it exempts every row that already existed', r.conname;
    END IF;
    IF r.conname = 'payments_option_belongs_to_vote' THEN
      IF r.contype <> 'f' THEN
        RAISE EXCEPTION 'payments_option_belongs_to_vote is not a foreign key';
      END IF;
      -- 'r' = RESTRICT. 'c' (cascade) here would silently delete payment rows
      -- with their vote, which is the outcome section 4 exists to prevent.
      IF r.confdeltype <> 'r' THEN
        RAISE EXCEPTION
          'payments_option_belongs_to_vote has ON DELETE %, expected RESTRICT',
          r.confdeltype;
      END IF;
    END IF;
  END LOOP;

  IF found <> 2 THEN
    RAISE EXCEPTION
      'expected both ballot-integrity constraints on payments, found %', found;
  END IF;

  RAISE NOTICE 'payments ballot integrity: catalog OK';
END;
$catalog$;

ROLLBACK;
