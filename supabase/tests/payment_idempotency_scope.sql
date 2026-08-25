-- An idempotency key belongs to the resident who chose it.
--
-- Two users, one identical key. Under the old global UNIQUE the second insert
-- fails; that failure was the whole attack, because the keys are guessable and
-- the route accepts them from the caller, so one request could reserve a
-- victim's future key and permanently break their charge.
--
-- Section 3 asserts the old constraint is GONE rather than merely that the new
-- one exists. Both present would leave the global namespace in force and every
-- behavioural assertion below would still pass.
--
-- Driven by scripts/db-test.sh. Wraps itself in BEGIN/ROLLBACK.

BEGIN;

DO $test$
DECLARE
  v_alice UUID := gen_random_uuid();
  v_bob   UUID := gen_random_uuid();
  v_key   TEXT := 'squat-me:vote_creation:some-vote';
  seen    TEXT;
BEGIN
  INSERT INTO public.municipalities (code, name_he, slug_he)
       VALUES ('pis-test-muni', 'רשות מפתחות', 'pis-test-muni')
  ON CONFLICT (code) DO NOTHING;
  INSERT INTO public.users (id, email, municipality_id)
       VALUES (v_alice, 'alice-keys@example.test', 'pis-test-muni'),
              (v_bob,   'bob-keys@example.test',   'pis-test-muni');

  -- ── 1. two residents may hold the same key ────────────────────────────────
  -- Bob squats first, as an attacker would; Alice's own charge still works.
  INSERT INTO public.payments (user_id, type, amount, idempotency_key)
       VALUES (v_bob, 'vote_creation', 5000, v_key);
  INSERT INTO public.payments (user_id, type, amount, idempotency_key)
       VALUES (v_alice, 'vote_creation', 5000, v_key);

  IF (SELECT count(*) FROM public.payments WHERE idempotency_key = v_key) <> 2 THEN
    RAISE EXCEPTION
      'a key held by one resident blocked another - the global UNIQUE is still '
      'in force, and one request can still break another resident''s charge';
  END IF;

  -- ── 2. one resident may NOT hold it twice ─────────────────────────────────
  -- The property the key exists for. Weakening global to per-user must not
  -- weaken it to nothing: a retried charge has to find the original row rather
  -- than record a second obligation.
  seen := NULL;
  BEGIN
    INSERT INTO public.payments (user_id, type, amount, idempotency_key)
         VALUES (v_alice, 'vote_creation', 5000, v_key);
  EXCEPTION WHEN unique_violation THEN
    seen := 'refused';
  END;
  IF seen IS NULL THEN
    RAISE EXCEPTION
      'one resident recorded the same idempotency key twice - a retry now '
      'charges twice';
  END IF;

  -- ── 2b. the scoped lookup finds each resident only their own ──────────────
  -- What the repository function does, asserted at the level that decides it.
  IF (SELECT user_id FROM public.payments
       WHERE idempotency_key = v_key AND user_id = v_alice) <> v_alice THEN
    RAISE EXCEPTION 'the scoped lookup did not find the owner their own payment';
  END IF;

  -- ── 2c. the SECURITY DEFINER RPC is scoped too ────────────────────────────
  -- `get_or_create_payment` selects by key. Under the old global UNIQUE that
  -- matched one row; now it can match several, and an unscoped SELECT ... INTO
  -- would take an arbitrary one and hand another resident's whole payment row
  -- back. Bob's row was inserted FIRST above, so an unscoped lookup returns his.
  --
  -- Guarded on the function still existing: PR #142 drops it, and this test has
  -- to pass either side of that merge.
  IF to_regprocedure(
       'public.get_or_create_payment(uuid, public.payment_type, integer, text, uuid, text)'
     ) IS NOT NULL THEN
    DECLARE
      v_row public.payments;
    BEGIN
      v_row := public.get_or_create_payment(
        v_alice, 'vote_creation'::public.payment_type, 5000, v_key, NULL, NULL
      );
      IF v_row.user_id <> v_alice THEN
        RAISE EXCEPTION
          'get_or_create_payment returned a payment belonging to % when called '
          'for % - the lookup is not scoped to the caller', v_row.user_id, v_alice;
      END IF;
    END;
  END IF;

  RAISE NOTICE 'payment idempotency scope: behaviour OK';
END;
$test$;

-- ── 3. the catalog: new constraint present, old one gone ────────────────────
DO $catalog$
DECLARE
  v_cols TEXT;
BEGIN
  SELECT string_agg(a.attname, ',' ORDER BY k.ord)
    INTO v_cols
    FROM pg_constraint c
    JOIN pg_class t     ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON TRUE
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
   WHERE n.nspname = 'public'
     AND t.relname = 'payments'
     AND c.conname = 'payments_user_id_idempotency_key_key'
     AND c.contype = 'u';

  IF v_cols IS NULL THEN
    RAISE EXCEPTION 'payments_user_id_idempotency_key_key is missing';
  END IF;
  -- Order matters for what the index can serve, and user_id must lead: this
  -- index is what the owner-scoped lookup uses.
  IF v_cols <> 'user_id,idempotency_key' THEN
    RAISE EXCEPTION
      'payments_user_id_idempotency_key_key covers (%), expected '
      '(user_id,idempotency_key)', v_cols;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_constraint c
      JOIN pg_class t     ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
       AND t.relname = 'payments'
       AND c.contype = 'u'
       AND array_length(c.conkey, 1) = 1
       AND c.conkey[1] = (
             SELECT attnum FROM pg_attribute
              WHERE attrelid = t.oid AND attname = 'idempotency_key'
           )
  ) THEN
    RAISE EXCEPTION
      'a global UNIQUE on idempotency_key alone is still present - the squat '
      'is still possible and section 1 passed only because the new constraint '
      'happens to allow it';
  END IF;

  RAISE NOTICE 'payment idempotency scope: catalog OK';
END;
$catalog$;

ROLLBACK;
