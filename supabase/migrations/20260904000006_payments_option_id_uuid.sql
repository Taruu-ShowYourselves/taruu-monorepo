-- =============================================================================
-- `payments.option_id` is the ballot choice a resident paid for. Make it a UUID.
--
-- WHAT IS WRONG
--
-- Every other reference to a ballot option in this schema is UUID and points at
-- `vote_options(id)`:
--
--   user_votes.option_id       UUID NOT NULL REFERENCES vote_options(id)
--   cast_vote(p_option_id …)   UUID
--   vote_tallies.option_id     UUID
--
-- `payments.option_id` alone is TEXT (20240101000000_initial_schema.sql:159),
-- with no key and no shape. It was written in the 2024 initial schema and never
-- brought into line -- the same omission, in the same file, as the
-- `verification_runs` municipality reference that 20260904000005 closed.
--
-- The column is filled straight from a request body. Until the change that
-- accompanies this migration, POST /api/payments/create read `optionId` off the
-- JSON, validated only the payment *type* and the presence of `voteId`, and
-- handed the value to the insert unexamined as `optionId || null`. Whatever
-- string a caller sent is what got stored.
--
-- That string is read back by the Green Invoice webhook and passed to
-- `cast_vote`, whose parameter is UUID (apps/web/src/app/api/payments/webhook/
-- route.ts, the `payment.type === 'vote_participation'` branch). So a payment
-- created with a non-UUID option id is accepted, charged, and then fails at the
-- moment the ballot would be recorded -- after the money is taken and after
-- `markPaymentCompleted` has atomically claimed the row, which is precisely the
-- point at which the provider's retry no longer reaches the fulfilment path.
-- The ballot is not merely late, it is unrecoverable without hand
-- reconciliation. Converting the column moves that refusal to the first
-- statement of the flow, before a payment page is ever created.
--
-- This is a shape fix, not a referential one. `cast_vote` already refuses an
-- option that does not belong to the vote, and the composite key added in
-- 20260904000002 enforces that in the database, so cross-vote tally poisoning
-- is closed regardless. What is closed here is the case where the value is not
-- an option id at all.
--
-- PRODUCTION EVIDENCE (read-only, 2026-08-25)
--
--   payments rows                                     0
--   rows with a non-NULL option_id                    0
--   rows whose option_id is not UUID-shaped           0
--   rows whose option_id is not in vote_options       0
--   rows with an option_id but no vote_id             0
--   current type of payments.option_id                text
--   vote_options rows                                 2838
--
-- No payment record exists to convert, let alone to lose. The preflight below
-- is written for the populated case anyway, because this migration will also
-- run against CI, against staging, and against a production that may have rows
-- by the time it is applied.
--
-- WHAT THE PREFLIGHT DOES, AND WHAT IT REFUSES TO DO
--
-- It attempts the cast per row and collects the payment ids that fail, then
-- raises. It does not delete, null out, or "clean" anything: a payment row is a
-- record of money that moved, and a migration is the wrong place to decide that
-- one of them is disposable. An operator who hits this gets the ids and decides.
--
-- It deliberately does NOT print the offending value. That value is arbitrary
-- text supplied by an unauthenticated request body -- that is the whole defect
-- -- and migration output lands in deploy logs. The id of the row is enough to
-- find it.
--
-- Casting is a lower bar than being a real ballot choice, so section 1a adds a
-- second pass that REPORTS -- as warnings, not errors -- the payments whose
-- option id is now a valid UUID and still cannot produce a ballot: it names no
-- option, it names an option in another vote, or it carries an option with no
-- vote. Those are refused going forward by the route, but a legacy row already
-- holding one is not something this migration can repair, and refusing to run
-- because of it would leave the column TEXT and the whole class open. Neither
-- pass is exercised by supabase/tests: both only fire on pre-existing rows, and
-- the harness applies every migration before any test can create one.
--
-- ONE FUNCTION BREAKS, SILENTLY, AND IS REPAIRED HERE
--
-- `get_or_create_payment` declares `p_option_id TEXT` and inserts it directly.
-- PostgreSQL has no assignment cast from text to uuid, so after the conversion
-- that INSERT is a type error. It does not surface during the migration:
-- PL/pgSQL plans the statement on first execution, so the ALTER succeeds and
-- the function fails later, at call time, with
--
--   ERROR:  column "option_id" is of type uuid but expression is of type text
--
-- Verified by running exactly that sequence against a disposable postgres:16.
-- Leaving it is not an option even though the function is dead code: a
-- migration must not leave a routine behind that it knowingly broke.
--
-- The repair is a CREATE OR REPLACE with the SAME signature and an explicit
-- `p_option_id::UUID`. Same signature matters twice over. Changing the
-- parameter type would create a second overload rather than replace the first,
-- and a newly created function gets EXECUTE granted to PUBLIC by default --
-- which would silently reopen the hole 20260904000001 closed. CREATE OR REPLACE
-- of an existing function leaves its ACL untouched; the test asserts that anon
-- and authenticated still cannot execute it afterwards.
--
-- The body is also given `SET search_path = ''` and fully qualified names while
-- it is being rewritten. 20260904000001 deliberately left every function body
-- alone, on the grounds that changing one would widen a security hotfix into a
-- refactor. That reasoning does not carry here: this body is being rewritten
-- regardless, and re-emitting a SECURITY DEFINER routine with an unpinned
-- search_path when the fix costs four schema qualifications would be choosing
-- the hole on purpose.
--
-- ORDERING AGAINST PR #142
--
-- `20260903000002_drop_dead_rpcs.sql` (open, unmerged) drops this function --
-- with a bare `DROP FUNCTION`, no IF EXISTS, naming the `p_option_id text`
-- signature. Either PR may apply first, so:
--
--   * The repair is guarded on `to_regprocedure`. If #142 lands first the
--     function is gone and this migration skips it.
--   * The repair does NOT drop the function and does NOT change its signature.
--     Dropping it here would make #142's unguarded DROP fail and abort that
--     migration; changing the parameter type would make #142's DROP miss the
--     surviving overload. Keeping the signature identical is what makes both
--     orderings work.
--
-- WHAT THIS MIGRATION DELIBERATELY DOES NOT DO
--
--   * No foreign key from `payments.option_id` to `vote_options(id)`, and no
--     composite key tying it to `payments.vote_id`. `vote_id` is nullable (a
--     vote-creation fee has no vote yet), so a composite FK under the default
--     MATCH SIMPLE would not fire at all for a row carrying an option and no
--     vote -- the case it would most need to catch. Making that airtight means
--     also deciding whether an option without a vote is legal, which is a
--     product question about the payment model, not a shape question. Recorded
--     as a follow-up rather than guessed at.
--
--     Because that is a follow-up and not a fix, the writer carries the check
--     in the meantime: POST /api/payments/create now reads the vote and refuses
--     an option id that does not belong to it, the same way
--     POST /api/votes/[id]/participate already did. That closes the well-formed
--     -but-wrong case at the boundary, which is where a charge can still be
--     avoided; it is application-level and therefore weaker than a constraint,
--     which is exactly why the constraint stays on the list.
--
--     Weaker in one specific way worth naming: the route checks once, at
--     payment creation, and the ballot is not cast until the provider's webhook
--     arrives. `vote_options` rows disappear with their vote through ON DELETE
--     CASCADE, so a vote deleted inside that window leaves a charged payment
--     whose option no longer exists. A read-before-insert check cannot close
--     that; only a constraint, or a reservation that outlives the check, can.
--   * No foreign key on `payments.vote_id` either, which is likewise unanchored.
--     Same follow-up, same reason.
--   * No index on option_id. Nothing queries by it.
--
-- ROLLBACK
--   ALTER TABLE public.payments ALTER COLUMN option_id TYPE TEXT;
--   …and restore the function body from 20240101000002_functions.sql:135-166.
--   Reversing this re-accepts arbitrary text into the column, which means
--   re-accepting payments whose ballot can never be cast. If a caller turns out
--   to depend on sending a non-UUID option id, that caller is the defect.
-- =============================================================================

-- ── 0. Preflight: refuse rather than clean ──────────────────────────────────

DO $preflight$
DECLARE
  r          RECORD;
  bad_ids    UUID[] := '{}';
BEGIN
  FOR r IN
    SELECT id, option_id FROM public.payments WHERE option_id IS NOT NULL
  LOOP
    BEGIN
      PERFORM r.option_id::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      bad_ids := bad_ids || r.id;
    END;
  END LOOP;

  IF array_length(bad_ids, 1) > 0 THEN
    RAISE EXCEPTION
      'payments.option_id cannot be converted to UUID: % row(s) hold a value '
      'that is not a UUID. Payment ids: %. These are records of money that '
      'moved; this migration will not alter or discard them. Reconcile each '
      'against the provider, then re-run. (The offending values are not '
      'printed: they are arbitrary request-body text and this output is logged.)',
      array_length(bad_ids, 1), bad_ids;
  END IF;
END;
$preflight$;

-- ── 1. The conversion ───────────────────────────────────────────────────────
-- USING is required: there is no implicit or assignment cast from text to uuid.
-- Nothing depends on this column -- no view, no rule, no policy, no generated
-- column, no index -- verified against production and against the migration
-- set, so the rewrite has no dependent objects to drop and recreate.

ALTER TABLE public.payments
  ALTER COLUMN option_id TYPE UUID USING option_id::UUID;

COMMENT ON COLUMN public.payments.option_id IS
  'The vote_options.id this payment was made for; NULL for a vote-creation fee. '
  'UUID since 20260904000006 -- it was TEXT, and a non-UUID value here was '
  'accepted and charged, then failed at cast_vote after the payment had already '
  'been claimed completed. Not yet a foreign key: see that migration''s header.';

-- ── 1a. Report, do not refuse: rows that are now UUID but still unfulfillable ─
--
-- Casting is a lower bar than being a real ballot choice. A legacy row can hold
-- a perfectly-shaped UUID that names no option, names an option in a different
-- vote, or carries an option with no vote at all -- and every one of those
-- still fails at `cast_vote` after the payment has been claimed completed,
-- which is the failure this migration exists to move earlier.
--
-- These are reported and not refused, deliberately. Refusing would block the
-- conversion on data the conversion did not create and cannot repair, leaving
-- the column TEXT and the class open. The shape fix lands either way; the
-- notice tells an operator exactly which payments need reconciling, in the same
-- terms as the preflight above and with the same silence about the values.

DO $report$
DECLARE
  v_orphan    UUID[];
  v_crossvote UUID[];
  v_no_vote   UUID[];
BEGIN
  SELECT coalesce(array_agg(p.id), '{}')
    INTO v_orphan
    FROM public.payments p
   WHERE p.option_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.vote_options o WHERE o.id = p.option_id);

  SELECT coalesce(array_agg(p.id), '{}')
    INTO v_crossvote
    FROM public.payments p
    JOIN public.vote_options o ON o.id = p.option_id
   WHERE p.vote_id IS NOT NULL
     AND o.vote_id <> p.vote_id;

  SELECT coalesce(array_agg(p.id), '{}')
    INTO v_no_vote
    FROM public.payments p
   WHERE p.option_id IS NOT NULL
     AND p.vote_id IS NULL;

  IF array_length(v_orphan, 1) > 0 THEN
    RAISE WARNING
      'payments naming an option that does not exist: %. A ballot can never be '
      'cast from these; reconcile against the provider.', v_orphan;
  END IF;

  IF array_length(v_crossvote, 1) > 0 THEN
    RAISE WARNING
      'payments naming an option that belongs to a different vote: %. cast_vote '
      'refuses these, after the payment has already been claimed completed.',
      v_crossvote;
  END IF;

  IF array_length(v_no_vote, 1) > 0 THEN
    RAISE WARNING
      'payments carrying an option id but no vote id: %. The webhook skips '
      'castVote entirely for these and fulfils everything else.', v_no_vote;
  END IF;
END;
$report$;

-- ── 2. Repair the one routine the conversion breaks ─────────────────────────
-- Guarded because PR #142 drops this function. Same signature, same ACL, same
-- SECURITY DEFINER; the body gains the cast it now needs and a pinned
-- search_path. `public.payment_type` is spelled qualified in the parameter list
-- so the signature is unambiguous under an empty search_path -- it resolves to
-- the same type, so this stays a replace and not a new overload.

DO $guard$
BEGIN
  IF to_regprocedure(
       'public.get_or_create_payment(uuid, public.payment_type, integer, text, uuid, text)'
     ) IS NULL THEN
    RAISE NOTICE
      'get_or_create_payment is already gone (PR #142); nothing to repair.';
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
      SELECT * INTO existing_payment
        FROM public.payments
       WHERE idempotency_key = p_idempotency_key;

      IF FOUND THEN
        RETURN existing_payment;
      END IF;

      -- The cast is the point of this migration. `p_option_id` stays TEXT so
      -- the signature is unchanged (see the header on PR #142 ordering); an
      -- input that is not a UUID now raises invalid_text_representation here
      -- rather than storing a value no ballot can ever be cast from.
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
