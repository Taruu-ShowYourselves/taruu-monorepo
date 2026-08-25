-- =============================================================================
-- `payments.option_id` is a UUID, and the one routine the conversion would have
-- broken still works.
--
-- Run by scripts/db-test.sh against a database built from every migration in
-- order. Self-contained: everything happens inside one transaction that is
-- rolled back at the end, so this file leaves no rows behind.
--
-- The negative control is section 1. Without 20260904000006 the column is TEXT
-- and accepts the string 'not-a-uuid' happily, so section 1 fails while every
-- other section still passes -- which is what makes section 1, rather than the
-- catalog assertion in section 3, the test that proves the migration does
-- something.
-- =============================================================================

BEGIN;

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- A municipality, a user, a vote and two options: the minimum needed for a
-- payment row that names a real ballot choice. The ids are hand-written so the
-- assertions can name them; every character in them is hex, which a UUID
-- literal requires and which is easy to get wrong when spelling ids by hand.

INSERT INTO public.municipalities (code, name_he, slug_he)
     VALUES ('payopt-muni', 'רשות תשלום', 'payopt-muni')
  ON CONFLICT (code) DO NOTHING;

INSERT INTO public.users (id, email, municipality_id)
     VALUES ('00000000-0000-4000-8000-00000000fee1'::UUID,
             'payopt@example.test', 'payopt-muni');

INSERT INTO public.votes
       (id, creator_id, title, description, municipality_id, status, end_date)
     VALUES ('00000000-0000-4000-8000-00000000fee2'::UUID,
             '00000000-0000-4000-8000-00000000fee1'::UUID,
             'Payment option shape', 'fixture', 'payopt-muni', 'active',
             now() + interval '7 days');

INSERT INTO public.vote_options (id, vote_id, text)
     VALUES ('00000000-0000-4000-8000-00000000fee3'::UUID,
             '00000000-0000-4000-8000-00000000fee2'::UUID, 'For'),
            ('00000000-0000-4000-8000-00000000fee4'::UUID,
             '00000000-0000-4000-8000-00000000fee2'::UUID, 'Against');

-- ── 1. NEGATIVE CONTROL: the column refuses a value that is not a UUID ──────
-- This is the defect. Before the migration this insert succeeded, the caller
-- was charged, and the failure surfaced later inside cast_vote -- after
-- markPaymentCompleted had claimed the row, so the provider's retry could no
-- longer reach the fulfilment path.

DO $$
BEGIN
  BEGIN
    INSERT INTO public.payments
      (user_id, type, amount, idempotency_key, vote_id, option_id)
    VALUES
      ('00000000-0000-4000-8000-00000000fee1'::UUID, 'vote_participation', 1000,
       'payopt-key-garbage', '00000000-0000-4000-8000-00000000fee2'::UUID,
       'not-a-uuid');
    RAISE EXCEPTION
      'payments.option_id accepted the string ''not-a-uuid''. The column is '
      'still TEXT: a payment can be created and charged for a ballot choice '
      'that can never be cast.';
  EXCEPTION WHEN invalid_text_representation THEN
    NULL;  -- expected
  END;
END;
$$;

-- An option id that is *almost* a UUID is refused too -- a truncated one, one
-- carrying trailing text, and the empty and blank strings that `optionId || null`
-- in the API layer does not turn into NULL for anything but ''. All of these
-- are shapes a hand-built or mangled request body produces, and all of them
-- used to be stored verbatim.

-- The insert is built with format(%L) rather than passing a TEXT variable, and
-- that is not cosmetic. A TEXT-typed plpgsql variable assigned to a UUID column
-- raises datatype_mismatch no matter what the value is -- the same error the
-- unrepaired function raises in section 4 -- so a loop written that way would
-- pass against a TEXT column too and prove nothing. A quoted literal is
-- untyped, resolves to whatever the column is, and so actually asks the
-- question: TEXT accepts every shape below, UUID rejects all of them.

DO $$
DECLARE
  v_shape TEXT;
BEGIN
  FOREACH v_shape IN ARRAY ARRAY[
    '00000000-0000-4000-8000-00000000fee',         -- truncated
    '00000000-0000-4000-8000-00000000fee3-extra',  -- trailing text
    ' ',                                           -- blank, not absent
    '',                                            -- empty; the API layer maps
                                                   -- this to NULL, the column
                                                   -- refuses it either way
    '00000000-0000-4000-8000-00000000feeg'         -- 'g' is not hex
  ]
  LOOP
    BEGIN
      EXECUTE format(
        'INSERT INTO public.payments '
        '  (user_id, type, amount, idempotency_key, vote_id, option_id) '
        'VALUES (%L, %L, 1000, %L, %L, %L)',
        '00000000-0000-4000-8000-00000000fee1',
        'vote_participation',
        'payopt-key-' || md5(v_shape),
        '00000000-0000-4000-8000-00000000fee2',
        v_shape);
      RAISE EXCEPTION
        'payments.option_id accepted a malformed option id of length %',
        length(v_shape);
    EXCEPTION WHEN invalid_text_representation THEN
      NULL;  -- expected
    END;
  END LOOP;
END;
$$;

-- ── 2. What must still be allowed ───────────────────────────────────────────
-- A real option id, and NULL for a vote-creation fee that has no ballot choice.
-- A change that also broke the legitimate path would be worse than the bug.

INSERT INTO public.payments
  (user_id, type, amount, idempotency_key, vote_id, option_id)
VALUES
  ('00000000-0000-4000-8000-00000000fee1'::UUID, 'vote_participation', 1000,
   'payopt-key-real', '00000000-0000-4000-8000-00000000fee2'::UUID,
   '00000000-0000-4000-8000-00000000fee3'::UUID),
  ('00000000-0000-4000-8000-00000000fee1'::UUID, 'vote_creation', 5000,
   'payopt-key-creation', NULL, NULL);

DO $$
DECLARE
  v_stored UUID;
BEGIN
  SELECT option_id INTO v_stored
    FROM public.payments WHERE idempotency_key = 'payopt-key-real';
  IF v_stored IS DISTINCT FROM '00000000-0000-4000-8000-00000000fee3'::UUID THEN
    RAISE EXCEPTION 'a valid option id did not round-trip: %', v_stored;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.payments
     WHERE idempotency_key = 'payopt-key-creation' AND option_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'a vote-creation fee with no option id was refused; it has no ballot '
      'choice by design';
  END IF;
END;
$$;

-- ── 3. The column really is UUID, in the catalog ────────────────────────────
-- The behaviour above could in principle be produced by a CHECK constraint on a
-- TEXT column. Assert the type itself, so the test says what it means.

DO $$
DECLARE
  v_type TEXT;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO v_type
    FROM pg_attribute a
   WHERE a.attrelid = 'public.payments'::regclass
     AND a.attname = 'option_id'
     AND NOT a.attisdropped;

  IF v_type IS DISTINCT FROM 'uuid' THEN
    RAISE EXCEPTION 'payments.option_id is %, expected uuid', v_type;
  END IF;
END;
$$;

-- ── 4. get_or_create_payment survived the conversion ────────────────────────
-- The conversion breaks this function's INSERT, and breaks it lazily: the ALTER
-- succeeds and the failure appears at call time. Every assertion here is
-- skipped if PR #142 has already dropped the function, which is the same guard
-- the migration itself uses.

DO $$
DECLARE
  v_sig   TEXT := 'public.get_or_create_payment('
                  'uuid, public.payment_type, integer, text, uuid, text)';
  v_row   public.payments;
  v_again public.payments;
BEGIN
  IF to_regprocedure(v_sig) IS NULL THEN
    RAISE NOTICE 'get_or_create_payment already dropped; section 4 skipped';
    RETURN;
  END IF;

  -- 4a. A well-formed option id goes in and comes back out as a UUID. If the
  -- body had not been repaired this raises datatype_mismatch instead.
  SELECT * INTO v_row FROM public.get_or_create_payment(
    '00000000-0000-4000-8000-00000000fee1'::UUID, 'vote_participation', 1000,
    'payopt-key-rpc', '00000000-0000-4000-8000-00000000fee2'::UUID,
    '00000000-0000-4000-8000-00000000fee4');

  IF v_row.option_id IS DISTINCT FROM '00000000-0000-4000-8000-00000000fee4'::UUID
  THEN
    RAISE EXCEPTION
      'get_or_create_payment stored % for the option id', v_row.option_id;
  END IF;

  -- 4b. Still idempotent on the key: the second call returns the first row
  -- rather than inserting a second payment for the same intent. Deliberately
  -- passed a DIFFERENT option id, so a function that ignored the existing row
  -- would be caught by the id comparison below rather than passing by accident.
  SELECT * INTO v_again FROM public.get_or_create_payment(
    '00000000-0000-4000-8000-00000000fee1'::UUID, 'vote_participation', 1000,
    'payopt-key-rpc', '00000000-0000-4000-8000-00000000fee2'::UUID,
    '00000000-0000-4000-8000-00000000fee3');

  IF v_again.id IS DISTINCT FROM v_row.id THEN
    RAISE EXCEPTION
      'get_or_create_payment created a second payment for one idempotency key';
  END IF;

  -- 4c. NULL still means "no ballot choice", not a cast failure.
  SELECT * INTO v_row FROM public.get_or_create_payment(
    '00000000-0000-4000-8000-00000000fee1'::UUID, 'vote_creation', 5000,
    'payopt-key-rpc-creation', NULL, NULL);

  IF v_row.option_id IS NOT NULL THEN
    RAISE EXCEPTION 'get_or_create_payment invented an option id for a fee';
  END IF;

  -- 4d. Garbage is refused, and refused for the RIGHT reason. Both a repaired
  -- and an unrepaired function error on this input; only the repaired one
  -- errors with invalid_text_representation ("that is not a UUID"). The
  -- unrepaired one raises datatype_mismatch ("column is of type uuid but
  -- expression is of type text"), which would mean the function is broken for
  -- every input including valid ones. Distinguishing the two is the point.
  BEGIN
    SELECT * INTO v_row FROM public.get_or_create_payment(
      '00000000-0000-4000-8000-00000000fee1'::UUID, 'vote_participation', 1000,
      'payopt-key-rpc-garbage', '00000000-0000-4000-8000-00000000fee2'::UUID,
      'not-a-uuid');
    RAISE EXCEPTION 'get_or_create_payment accepted a non-UUID option id';
  EXCEPTION
    WHEN invalid_text_representation THEN
      NULL;  -- expected
    WHEN datatype_mismatch THEN
      RAISE EXCEPTION
        'get_or_create_payment still inserts p_option_id without a cast: the '
        'conversion broke it and the repair did not run';
  END;
END;
$$;

-- ── 5. Replacing the function did not restore its default grants ────────────
-- 20260904000001 revoked EXECUTE from PUBLIC, anon and authenticated. A DROP
-- followed by a CREATE would have handed all three back, because a newly
-- created function grants EXECUTE to PUBLIC by default. CREATE OR REPLACE of an
-- existing function keeps the ACL -- this asserts that it actually did, rather
-- than trusting the documentation.
--
-- PUBLIC is checked through aclexplode rather than has_function_privilege,
-- because that function resolves a role name and PUBLIC is not a role. A
-- grantee oid of 0 in the ACL is what PUBLIC looks like.

DO $$
DECLARE
  v_sig  TEXT := 'public.get_or_create_payment('
                 'uuid, public.payment_type, integer, text, uuid, text)';
  v_oid  OID;
  v_role TEXT;
BEGIN
  v_oid := to_regprocedure(v_sig);
  IF v_oid IS NULL THEN
    RAISE NOTICE 'get_or_create_payment already dropped; section 5 skipped';
    RETURN;
  END IF;

  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated']
  LOOP
    IF has_function_privilege(v_role, v_oid, 'EXECUTE') THEN
      RAISE EXCEPTION
        'replacing get_or_create_payment restored EXECUTE to %; the revoke in '
        '20260904000001 has been undone', v_role;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
      FROM pg_proc p, aclexplode(p.proacl) AS a
     WHERE p.oid = v_oid
       AND a.grantee = 0
       AND a.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION
      'replacing get_or_create_payment restored EXECUTE to PUBLIC; the revoke '
      'in 20260904000001 has been undone';
  END IF;
END;
$$;

-- ── 6. The rewritten body pins its search_path ──────────────────────────────
-- It is SECURITY DEFINER, so an unpinned search_path lets a caller who can
-- create objects in a schema earlier on the path shadow `payments` and have the
-- function write somewhere else as the owner. The rewrite is where that gets
-- fixed, and this keeps it fixed.

DO $$
DECLARE
  v_sig    TEXT := 'public.get_or_create_payment('
                   'uuid, public.payment_type, integer, text, uuid, text)';
  v_oid    OID;
  v_config TEXT[];
BEGIN
  v_oid := to_regprocedure(v_sig);
  IF v_oid IS NULL THEN
    RAISE NOTICE 'get_or_create_payment already dropped; section 6 skipped';
    RETURN;
  END IF;

  SELECT proconfig INTO v_config FROM pg_proc WHERE oid = v_oid;

  IF v_config IS NULL
     OR NOT EXISTS (SELECT 1 FROM unnest(v_config) AS c
                     WHERE c LIKE 'search\_path=%')
  THEN
    RAISE EXCEPTION
      'get_or_create_payment is SECURITY DEFINER with no pinned search_path';
  END IF;
END;
$$;

-- ── 7. Nothing else in the schema still treats an option id as text ─────────
-- A convention check rather than a spot check, so the next column named
-- option_id cannot quietly be added as TEXT the way this one was. Scoped to
-- ordinary and partitioned tables in `public`; views are excluded because their
-- column types follow the tables underneath.

DO $$
DECLARE
  v_offenders TEXT;
BEGIN
  SELECT string_agg(format('%s.%s (%s)',
                           c.relname, a.attname,
                           format_type(a.atttypid, a.atttypmod)), ', '
                    ORDER BY c.relname, a.attname)
    INTO v_offenders
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
   WHERE n.nspname = 'public'
     AND c.relkind IN ('r', 'p')
     AND a.attnum > 0
     AND NOT a.attisdropped
     AND a.attname = 'option_id'
     AND a.atttypid <> 'uuid'::regtype;

  IF v_offenders IS NOT NULL THEN
    RAISE EXCEPTION
      'these option_id columns are not UUID: %. Every ballot option in this '
      'schema is identified by vote_options.id, which is a UUID.', v_offenders;
  END IF;
END;
$$;

ROLLBACK;
