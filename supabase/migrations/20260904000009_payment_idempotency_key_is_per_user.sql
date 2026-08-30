-- =============================================================================
-- 20260904000009 — an idempotency key belongs to the resident who chose it
--
-- WHAT THIS CLOSES
--
--   `payments.idempotency_key` was UNIQUE across the whole table, and
--   `POST /api/payments/create` accepts a caller-supplied key verbatim. Those
--   two facts together make the key namespace a shared, first-come resource
--   that anyone can write into.
--
--   The keys are not secret and not random. The one this codebase generates for
--   the creation fee is `{userId}:vote_creation:{voteId}` (see
--   `idempotencyKeyFor` in server/infra/payments/creation-fee.ts) - every
--   component knowable by anyone who can see a vote and a profile. So:
--
--     1. An attacker posts a payment of their own with
--        `idempotencyKey = "{victim}:vote_creation:{vote}"`. It is stored under
--        THEIR user id, and the global UNIQUE now holds that string.
--     2. The victim later has that fee charged. `createCreationFeePort`
--        computes the same key, looks it up scoped to the victim (correctly,
--        since 20260904000009's sibling change) and finds nothing, inserts, and
--        hits the global UNIQUE.
--     3. It re-reads scoped, still finds nothing, and returns `paymentInvalid`
--        - a 402, "התשלום נכשל".
--
--   The victim's approval is then permanently broken by a row they cannot see
--   and did not create. Squatting one key costs one request.
--
--   Scoping the LOOKUP to the owner - which is the right fix for the read side,
--   and stops one resident reading another's payment id, status and amount -
--   is what makes this the visible failure mode rather than a silent
--   cross-user collision. The read fix and this one belong together.
--
-- WHY PER-USER UNIQUENESS RATHER THAN REFUSING CALLER-SUPPLIED KEYS
--
--   Refusing the field would also close the attack, and would be a smaller
--   diff. It would also remove the endpoint's only working idempotency: the key
--   the route generates when none is supplied ends in `Date.now()`, so a retry
--   produces a different key and a second payment. A caller-supplied key is the
--   only thing that makes a retry safe today.
--
--   So the namespace is partitioned instead. `UNIQUE (user_id, idempotency_key)`
--   says what was always meant - a key identifies a payment WITHIN a resident's
--   own payments - and leaves every honest caller working unchanged. An
--   attacker can still write any string they like, but only into their own
--   partition, where it collides with nothing.
--
-- WHAT ELSE THIS CHANGES
--
--   `idx_payments_idempotency`, a plain index on `idempotency_key` created
--   beside the UNIQUE constraint in 20240101000000, was one of the thirteen
--   duplicate indexes that 20260903000001 (PR #142, open) drops. With the
--   constraint gone it is no longer a duplicate: it is the only index on that
--   column by itself. It is left in place and removed from the allowlist in
--   supabase/tests/no_duplicate_indexes.sql, which explains the change there.
--
--   Nothing needs it: `getPaymentByIdempotencyKey` now filters on
--   (idempotency_key, user_id) and is served by the new constraint's index.
--   The one remaining reader by bare key is `get_or_create_payment`, which has
--   no EXECUTE grant at all (revoked in 20260904000001, no caller, slated for
--   deletion by #142). #142 dropping the plain index therefore stays correct,
--   which is why this migration does not drop it and does not fight over it.
--
-- PRODUCTION SHAPE (read-only, 2026-08-25)
--
--   `public.payments` is EMPTY - 0 rows, 0 distinct users. No key can collide
--   under either rule, so the constraint swap is a catalog-only change.
--
-- ROLLBACK
--   ALTER TABLE public.payments
--     DROP CONSTRAINT payments_user_id_idempotency_key_key,
--     ADD  CONSTRAINT payments_idempotency_key_key UNIQUE (idempotency_key);
--   Reversing this re-opens the squat: do it only together with removing
--   caller-supplied keys from POST /api/payments/create.
-- =============================================================================

-- ── 0. Preflight: refuse rather than clean ──────────────────────────────────
-- Per-user uniqueness is strictly weaker than global uniqueness, so nothing
-- that satisfies the old rule can fail the new one. What CAN be wrong is the
-- opposite direction on rollback, and more usefully: a key already squatted.
-- Report those rather than let them become invisible once the global rule goes.

DO $preflight$
DECLARE
  shared_keys TEXT[];
BEGIN
  SELECT coalesce(array_agg(k ORDER BY k), '{}')
    INTO shared_keys
    FROM (
      SELECT p.idempotency_key AS k
        FROM public.payments p
       GROUP BY p.idempotency_key
      HAVING count(DISTINCT p.user_id) > 1
    ) s;

  IF array_length(shared_keys, 1) > 0 THEN
    RAISE NOTICE
      'keys already held by more than one user (impossible under the old '
      'global UNIQUE, so this means it was dropped earlier): %', shared_keys;
  END IF;
END;
$preflight$;

-- ── 1. the swap ─────────────────────────────────────────────────────────────
-- Added before the old one is dropped, so the table is never briefly without a
-- uniqueness rule on this column. Both are constraint-backed unique indexes,
-- and ADD takes ACCESS EXCLUSIVE for the duration of the build; the table is
-- empty, and on a populated one this wants CREATE UNIQUE INDEX CONCURRENTLY
-- followed by ADD CONSTRAINT ... USING INDEX instead.

ALTER TABLE public.payments
  ADD CONSTRAINT payments_user_id_idempotency_key_key
  UNIQUE (user_id, idempotency_key);

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_idempotency_key_key;

-- ── 2. the one remaining reader by bare key ─────────────────────────────────
--
-- `get_or_create_payment` selects `WHERE idempotency_key = p_idempotency_key`
-- with no owner. Under the old global UNIQUE that matched at most one row, so
-- it was merely unscoped; with per-user uniqueness it can match several, and
-- `SELECT ... INTO` then takes an arbitrary one and returns another resident's
-- entire payment row to the caller.
--
-- It has no EXECUTE grant (20260904000001 revoked them all), no caller, and PR
-- #142 drops it - so this is not a live hole. It is repaired anyway, because
-- "safe only because nobody can call it" is a property of the grant, not of the
-- function, and a database API left in a state the same migration broke is a
-- trap for whoever grants it next.
--
-- Body-only replacement: the signature is byte-identical, so the ACL survives
-- (a changed parameter type would create a NEW function with a fresh default
-- PUBLIC EXECUTE, reopening exactly what 20260904000001 closed), and #142's
-- unguarded DROP FUNCTION still matches in either apply order. The
-- `to_regprocedure` guard is what makes this migration safe if #142 landed
-- first.
DO $guard$
BEGIN
  IF to_regprocedure(
       'public.get_or_create_payment(uuid, public.payment_type, integer, text, uuid, text)'
     ) IS NULL THEN
    RAISE NOTICE 'get_or_create_payment is already gone (PR #142); nothing to repair.';
    RETURN;
  END IF;

  EXECUTE $ddl$
    CREATE OR REPLACE FUNCTION public.get_or_create_payment(
      p_user_id         UUID,
      p_type            public.payment_type,
      p_amount          INTEGER,
      p_idempotency_key TEXT,
      p_vote_id         UUID DEFAULT NULL,
      p_option_id       TEXT DEFAULT NULL
    )
    RETURNS public.payments
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = ''
    AS $fn$
    DECLARE
      existing_payment public.payments;
      new_payment      public.payments;
    BEGIN
      -- Scoped to the caller's own payments, matching
      -- UNIQUE (user_id, idempotency_key) and the TypeScript repository
      -- function of the same name.
      SELECT * INTO existing_payment
        FROM public.payments
       WHERE idempotency_key = p_idempotency_key
         AND user_id = p_user_id;

      IF FOUND THEN
        RETURN existing_payment;
      END IF;

      -- The cast is inherited from 20260904000006: `p_option_id` stays TEXT so
      -- the signature is unchanged, and an input that is not a UUID raises
      -- invalid_text_representation here rather than storing a value no ballot
      -- can ever be cast from.
      INSERT INTO public.payments (
        user_id, type, amount, idempotency_key, vote_id, option_id
      ) VALUES (
        p_user_id, p_type, p_amount, p_idempotency_key, p_vote_id,
        p_option_id::UUID
      )
      RETURNING * INTO new_payment;

      RETURN new_payment;
    END;
    $fn$;
  $ddl$;
END;
$guard$;

COMMENT ON COLUMN public.payments.idempotency_key IS
  'Unique WITHIN one user''s payments, not globally. The route accepts this '
  'value from the caller and the generated form is guessable, so a global '
  'namespace let anyone reserve another resident''s key and permanently break '
  'their charge. See 20260904000009.';
