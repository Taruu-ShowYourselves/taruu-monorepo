-- =============================================================================
-- One holding per holder per Issue Coin — the same defect as vote_nfts, in the
-- table that decides who gets an NFT.
--
-- WHAT WAS WRONG
--
--   CONSTRAINT uq_issue_coin_holding UNIQUE (issue_coin_id, user_id, wallet_address)
--
-- Identical to the vote_nfts case closed by 20260904000003: every row sets
-- exactly one holder column, the third is always NULL, and NULLs are distinct
-- in a UNIQUE constraint. (c, user-A, NULL) never conflicts with
-- (c, user-A, NULL), so the constraint names an invariant and enforces none.
--
-- AND THE WRITER RACES INTO THE GAP
--
-- `upsertIssueCoinHolding` is an upsert in name only: it SELECTs the holding,
-- then either UPDATEs it or INSERTs a new one. Two purchases by the same holder
-- that overlap both read "no existing holding" and both insert. Nothing stops
-- them today, and the result is worse than a duplicate row:
--
--   * The holder's tokens and invested ILS are split across two rows, so every
--     balance read is wrong.
--   * The next purchase calls `.single()` on that lookup, which errors when it
--     matches more than one row — so one race permanently breaks purchasing for
--     that holder.
--   * `getIssueCoinHolders` feeds `createNftRecordsForVote`, so a split holding
--     is also a distorted view of who supported a vote.
--
-- WHY BOTH HALVES SHIP TOGETHER
--
-- Installing the uniqueness rule under the read-then-insert writer would turn
-- the silent split into a unique_violation thrown at a purchaser mid-payment.
-- So section 4 adds `claim_issue_coin_holding`, which does the whole thing in
-- one INSERT ... ON CONFLICT DO UPDATE against these exact partial indexes:
-- the accumulate-or-create decision is made by the database, under the same
-- lock that enforces the constraint, and a losing concurrent purchase adds to
-- the winner's row instead of creating a second one.
--
-- PRODUCTION EVIDENCE (read-only, 2026-08-25)
--
--   issue_coin_holdings                                        0 rows
--   issue_coins                                                0 rows
--   rows failing the new holder shape                          0
--   duplicated (issue_coin_id, user_id) groups                 0
--   duplicated (issue_coin_id, trimmed wallet) groups          0
--
-- The Issue Coin purchase path has never run in production, and
-- `upsertIssueCoinHolding` currently has no callers. That is precisely why this
-- is the moment: the rule and the writer can be corrected before the first
-- purchase exists, rather than reconciled afterwards against money.
--
-- The holder-shape rules and the reasoning behind them are the same as
-- 20260904000003; that file carries the long form. In brief: exactly one holder
-- column, a wallet with no whitespace in it (a Solana address is base58, and
-- 'W' beside ' W ' would be two index entries for one holder), and the
-- preflight is the exact negation of the CHECK so the two cannot drift.
--
-- WHAT THIS DOES NOT DO
--
-- It does not touch `issue_coin_holdings.user_id`'s ON DELETE SET NULL, which
-- cannot succeed for a user-held row: nulling user_id leaves no holder and the
-- CHECK rejects it, so deleting such a user fails. This is NOT a regression
-- from the tightened CHECK -- under the old `user_id IS NOT NULL OR
-- wallet_address IS NOT NULL` the same SET NULL also evaluated to false, since
-- `IS NOT NULL` yields a strict boolean and never NULL. What to do with a
-- deleted holder's financial record -- anonymise it to a wallet, retain it,
-- cascade it -- is a retention and erasure decision that has to be made before
-- the purchase path goes live, not guessed at inside a constraint fix. The
-- equivalent behaviour on vote_nfts is asserted in
-- supabase/tests/vote_nft_holder_uniqueness.sql so the decision is anchored.
--
-- ROLLBACK
--   DROP FUNCTION IF EXISTS public.claim_issue_coin_holding(UUID, UUID, TEXT, TEXT, INTEGER, BOOLEAN);
--   DROP INDEX IF EXISTS public.uq_issue_coin_holding_user;
--   DROP INDEX IF EXISTS public.uq_issue_coin_holding_wallet;
--   ALTER TABLE public.issue_coin_holdings DROP CONSTRAINT chk_holder_identity;
--   ALTER TABLE public.issue_coin_holdings ADD CONSTRAINT chk_holder_identity
--     CHECK (user_id IS NOT NULL OR wallet_address IS NOT NULL);
--   ALTER TABLE public.issue_coin_holdings ADD CONSTRAINT uq_issue_coin_holding
--     UNIQUE (issue_coin_id, user_id, wallet_address);
--   The writer would have to be reverted with it. Prefer fixing forward.
-- =============================================================================

-- ── 0. preflight: the exact negation of the rules installed below ───────────

DO $preflight$
DECLARE
  v_shape  BIGINT;
  v_user   BIGINT;
  v_wallet BIGINT;
BEGIN
  SELECT count(*) INTO v_shape
    FROM public.issue_coin_holdings
   WHERE NOT (
     (user_id IS NOT NULL AND wallet_address IS NULL)
     OR
     (user_id IS NULL
      AND wallet_address IS NOT NULL
      AND wallet_address ~ '^[^[:space:]]+$')
   );

  SELECT count(*) INTO v_user FROM (
    SELECT 1 FROM public.issue_coin_holdings WHERE user_id IS NOT NULL
     GROUP BY issue_coin_id, user_id HAVING count(*) > 1
  ) d;

  SELECT count(*) INTO v_wallet FROM (
    SELECT 1 FROM public.issue_coin_holdings WHERE wallet_address IS NOT NULL
     GROUP BY issue_coin_id, regexp_replace(wallet_address, '[[:space:]]', '', 'g')
    HAVING count(*) > 1
  ) d;

  IF v_shape > 0 OR v_user > 0 OR v_wallet > 0 THEN
    RAISE EXCEPTION
      'issue_coin_holdings already holds rows the new rules forbid: % with a '
      'holder shape the new CHECK refuses, % duplicated (issue_coin_id, '
      'user_id) groups, % duplicated (issue_coin_id, trimmed wallet) groups. '
      'A duplicate here is a SPLIT BALANCE, so merging them is an operator '
      'decision about money -- summing two rows is only correct if both really '
      'belong to one holder.',
      v_shape, v_user, v_wallet
      USING HINT = 'select issue_coin_id, user_id, wallet_address, token_amount,'
                   ' invested_ils from public.issue_coin_holdings'
                   ' order by issue_coin_id, created_at;';
  END IF;
END;
$preflight$;

-- ── 1. remove the constraint that enforced nothing ──────────────────────────

ALTER TABLE public.issue_coin_holdings
  DROP CONSTRAINT IF EXISTS uq_issue_coin_holding;

-- ── 2. exactly one holder identity per row ──────────────────────────────────

ALTER TABLE public.issue_coin_holdings
  DROP CONSTRAINT IF EXISTS chk_holder_identity;
ALTER TABLE public.issue_coin_holdings
  ADD CONSTRAINT chk_holder_identity CHECK (
    (user_id IS NOT NULL AND wallet_address IS NULL)
    OR
    (user_id IS NULL
     AND wallet_address IS NOT NULL
     AND wallet_address ~ '^[^[:space:]]+$')
  );

-- ── 3. the two holder shapes, each unique within its Issue Coin ─────────────
-- Not `IF NOT EXISTS`: that matches on name alone, so a same-named index with
-- different columns would be left in place with a notice while section 1 had
-- already dropped the old constraint.

DROP INDEX IF EXISTS public.uq_issue_coin_holding_user;
CREATE UNIQUE INDEX uq_issue_coin_holding_user
  ON public.issue_coin_holdings (issue_coin_id, user_id)
  WHERE user_id IS NOT NULL;

DROP INDEX IF EXISTS public.uq_issue_coin_holding_wallet;
CREATE UNIQUE INDEX uq_issue_coin_holding_wallet
  ON public.issue_coin_holdings (issue_coin_id, wallet_address)
  WHERE wallet_address IS NOT NULL;

COMMENT ON INDEX public.uq_issue_coin_holding_user IS
  'One holding per Taruu user per Issue Coin. Partial because a wallet-held '
  'row has a NULL user_id, and NULLs are distinct in a unique index -- which is '
  'how uq_issue_coin_holding came to enforce nothing. A duplicate here splits '
  'one holder''s balance across two rows.';

COMMENT ON INDEX public.uq_issue_coin_holding_wallet IS
  'One holding per external wallet per Issue Coin. Sibling of '
  'uq_issue_coin_holding_user; chk_holder_identity guarantees every row is in '
  'exactly one of the two.';

-- ── 4. the only supported way to record a purchase ──────────────────────────
-- One statement per call. The accumulate-or-create decision is made by the
-- database under the same lock that enforces uniqueness, so two overlapping
-- purchases by one holder produce one row with both amounts rather than two
-- rows with one each.
--
-- Two arms because the arbiter differs by holder shape, and a PARTIAL index can
-- only be inferred by restating its predicate — which is also why this cannot
-- be done from PostgREST.
--
-- SECURITY INVOKER: the caller is the service-role client, which is not subject
-- to RLS. A DEFINER mutator on a balance table would be a new instance of the
-- class 20260904000001 exists to close.

CREATE OR REPLACE FUNCTION public.claim_issue_coin_holding(
  p_issue_coin_id     UUID,
  p_user_id           UUID,
  p_wallet_address    TEXT,
  p_token_amount      TEXT,
  p_invested_ils      INTEGER,
  p_is_local_resident BOOLEAN DEFAULT FALSE
) RETURNS public.issue_coin_holdings
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  -- SURROUNDING whitespace only. Stripping it everywhere would silently turn a
  -- malformed 'A B' into 'AB' -- a different, possibly real, wallet whose
  -- balance this call would then credit. Anything still containing whitespace
  -- after trimming is refused below rather than repaired.
  v_wallet TEXT := nullif(btrim(coalesce(p_wallet_address, ''), E' \t\r\n\f\v'), '');
  -- clock_timestamp(), not now(): now() is fixed at transaction start, so two
  -- purchases in one transaction would record the same last_purchase_at.
  v_now    TIMESTAMPTZ := clock_timestamp();
  v_row    public.issue_coin_holdings;
BEGIN
  IF p_issue_coin_id IS NULL THEN
    RAISE EXCEPTION 'p_issue_coin_id is required' USING ERRCODE = '22023';
  END IF;
  IF (p_user_id IS NULL) = (v_wallet IS NULL) THEN
    RAISE EXCEPTION
      'a holding must name exactly one holder: p_user_id or p_wallet_address'
      USING ERRCODE = '22023';
  END IF;
  IF v_wallet IS NOT NULL AND v_wallet !~ '^[^[:space:]]+$' THEN
    RAISE EXCEPTION
      'p_wallet_address contains whitespace after trimming; refusing rather '
      'than rewriting it, because removing an interior space would name a '
      'different wallet'
      USING ERRCODE = '22023';
  END IF;

  -- token_amount is TEXT holding an integer count of base units, so it is
  -- validated rather than trusted: a non-numeric value would otherwise fail
  -- inside the arithmetic below with a cast error naming no caller, and a
  -- negative one would silently reduce a balance through a purchase path.
  -- Zero is refused too: a holding is what makes someone eligible for a Civic
  -- Patron NFT, and `createNftRecordsForVote` does not check the amount, so a
  -- zero-token call would mint an NFT to someone holding nothing.
  IF p_token_amount IS NULL OR p_token_amount !~ '^[0-9]+$'
     OR p_token_amount::NUMERIC = 0 THEN
    RAISE EXCEPTION 'p_token_amount must be a positive integer string, got %',
      coalesce(p_token_amount, '<null>') USING ERRCODE = '22023';
  END IF;
  IF coalesce(p_invested_ils, 0) < 0 THEN
    RAISE EXCEPTION 'p_invested_ils must not be negative, got %', p_invested_ils
      USING ERRCODE = '22023';
  END IF;

  IF p_user_id IS NOT NULL THEN
    INSERT INTO public.issue_coin_holdings AS h (
      issue_coin_id, user_id, token_amount, invested_ils, is_local_resident,
      first_purchase_at, last_purchase_at
    ) VALUES (
      p_issue_coin_id, p_user_id, p_token_amount, coalesce(p_invested_ils, 0),
      coalesce(p_is_local_resident, FALSE), v_now, v_now
    )
    ON CONFLICT (issue_coin_id, user_id) WHERE user_id IS NOT NULL DO UPDATE
      SET token_amount = (h.token_amount::NUMERIC
                          + excluded.token_amount::NUMERIC)::TEXT,
          invested_ils = coalesce(h.invested_ils, 0) + excluded.invested_ils,
          -- Residency is a property of the holder, not of one purchase: once
          -- verified it must not be cleared by a later call that omits it.
          --
          -- The timestamps take the extremes rather than the arriving value.
          -- Each call stamps clock_timestamp() when it starts, but a call that
          -- started EARLIER can commit LATER after waiting on the row lock, so
          -- assigning `excluded.last_purchase_at` directly could move the last
          -- purchase backwards past the first one.
          is_local_resident = h.is_local_resident OR excluded.is_local_resident,
          first_purchase_at = least(h.first_purchase_at, excluded.first_purchase_at),
          last_purchase_at = greatest(h.last_purchase_at, excluded.last_purchase_at),
          updated_at = v_now
    RETURNING h.* INTO v_row;
  ELSE
    INSERT INTO public.issue_coin_holdings AS h (
      issue_coin_id, wallet_address, token_amount, invested_ils,
      is_local_resident, first_purchase_at, last_purchase_at
    ) VALUES (
      p_issue_coin_id, v_wallet, p_token_amount, coalesce(p_invested_ils, 0),
      coalesce(p_is_local_resident, FALSE), v_now, v_now
    )
    ON CONFLICT (issue_coin_id, wallet_address) WHERE wallet_address IS NOT NULL
    DO UPDATE
      SET token_amount = (h.token_amount::NUMERIC
                          + excluded.token_amount::NUMERIC)::TEXT,
          invested_ils = coalesce(h.invested_ils, 0) + excluded.invested_ils,
          is_local_resident = h.is_local_resident OR excluded.is_local_resident,
          first_purchase_at = least(h.first_purchase_at, excluded.first_purchase_at),
          last_purchase_at = greatest(h.last_purchase_at, excluded.last_purchase_at),
          updated_at = v_now
    RETURNING h.* INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.claim_issue_coin_holding(UUID, UUID, TEXT, TEXT, INTEGER, BOOLEAN) IS
  'Record a purchase against a holder''s single holding for one Issue Coin, '
  'creating it or adding to it in one statement. Replaces a read-then-write '
  'upsert whose two concurrent callers could each create a row and split the '
  'holder''s balance. first_purchase_at is set only on creation.';

REVOKE ALL ON FUNCTION
  public.claim_issue_coin_holding(UUID, UUID, TEXT, TEXT, INTEGER, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.claim_issue_coin_holding(UUID, UUID, TEXT, TEXT, INTEGER, BOOLEAN)
  TO service_role;

-- SECURITY INVOKER runs the INSERT with the CALLER's table rights, so EXECUTE
-- alone is not enough. The hosted project grants these through Supabase's
-- default privileges, which makes the dependency invisible; a database built
-- from this repository alone would fail with 'permission denied'. DELETE is
-- absent: a holding is a financial record.
GRANT SELECT, INSERT, UPDATE ON public.issue_coin_holdings TO service_role;
