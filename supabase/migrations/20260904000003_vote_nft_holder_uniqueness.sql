-- =============================================================================
-- One NFT per holder per vote — stated so the database can enforce it, and made
-- reachable by the one writer that creates these rows.
--
-- WHAT WAS WRONG
--
--   CONSTRAINT uq_vote_nft_holder UNIQUE (vote_id, user_id, wallet_address)
--
-- Every row sets exactly one of the two holder columns, so the third column is
-- always NULL. NULLs are distinct in a UNIQUE constraint, so
-- (v, user-A, NULL) never conflicts with (v, user-A, NULL). The constraint
-- named the invariant and enforced nothing: the table it guards has been open
-- to unlimited duplicate holders since it was created.
--
-- That is not theoretical here. `createNftRecordsForVote` (apps/web/src/
-- services/nft/index.ts) enumerates every voter and Issue Coin holder and
-- inserts a row each. It can run twice over the same participant list two ways:
--
--   * Overlapping cron ticks. `getVotesNeedingResolution` selects votes whose
--     `resolution_status` IS NULL, and `resolveVote` only writes 'resolving'
--     AFTER selection -- there is no atomic claim on the vote. A resolution
--     that outlives the five-minute schedule is therefore selected again by the
--     next tick, and both runs enumerate the same participants.
--   * A hand re-run. A vote whose resolution failed is written
--     `resolution_status = 'failed'` and is never selected by the cron again,
--     so re-running it by hand is the only recovery -- and that re-run meets
--     whatever rows the failed attempt already wrote.
--
-- Each duplicate row is later picked up by the mint-nfts cron and becomes a
-- second irreversible on-chain NFT for the same person.
--
-- WHY THE CONSTRAINT ALONE WOULD HAVE MADE THIS WORSE
--
-- `bulkCreateVoteNfts` inserted the whole participant list as one plain INSERT.
-- Adding a real uniqueness rule under an unchanged writer converts a silent
-- duplicate into a unique_violation that aborts the entire batch, which
-- `resolveVote` catches as 'Failed to create NFT records' — and the vote is
-- then written `resolution_status = 'failed'`, which the cron never selects
-- again. A vote that already had one duplicated participant would need hand
-- recovery, and that hand re-run would hit the same violation.
--
-- So the constraint and the way to satisfy it ship together. Section 3 adds
-- `claim_vote_nft_records`, which inserts ON CONFLICT DO NOTHING against these
-- exact partial indexes and returns how many rows it actually claimed. Re-running
-- a resolution is then a no-op instead of either a duplicate or an outage.
--
-- WHY `type` IS NOT IN THE KEY
--
-- Adding it would make the key one NFT per holder per vote PER TYPE, which
-- permits exactly the duplicate this is here to stop: the same person holding
-- both a verified_voter and a civic_patron NFT for one vote. The record builder
-- already treats those as mutually exclusive (an Issue Coin holder who also
-- voted is skipped). The database now agrees.
--
-- WHY THE HOLDER CHECK BECOMES EXCLUSIVE
--
-- The old CHECK was `user_id IS NOT NULL OR wallet_address IS NOT NULL`, so a
-- row could name both. Such a row lands in BOTH indexes below and reserves two
-- unrelated holders at once — a (user A, wallet B) row would block later
-- issuance to user A and to wallet B. Nothing writes that shape: both writers
-- set exactly one column, and the RPC below refuses anything else. The CHECK is
-- tightened to say so.
--
-- PRODUCTION EVIDENCE (read-only, 2026-08-25)
--
--   select count(*) from public.vote_nfts;                            -- 0
--   -- duplicates under either holder shape, had the rule been real:
--   select count(*) from (select vote_id, user_id from public.vote_nfts
--     where user_id is not null group by 1,2 having count(*) > 1) d;  -- 0
--   select count(*) from (select vote_id, wallet_address from public.vote_nfts
--     where wallet_address is not null group by 1,2 having count(*) > 1) d; -- 0
--   -- rows naming both holders, which the tightened CHECK would reject:
--   select count(*) from public.vote_nfts
--    where user_id is not null and wallet_address is not null;        -- 0
--
-- The table is empty, so every statement here is instant and cannot fail on
-- existing data. The database is nonetheless the live one (users 3, votes 947,
-- vote_options 2838, municipalities 260) — vote_nfts has simply never been
-- written to in production. That is what makes this the moment to fix it: the
-- rule can be stated before the first row exists, rather than reconciled after
-- duplicate mints are already on chain.
--
-- WHAT THIS DOES NOT DO
--
--   * It does not give a user and their linked wallet a shared identity. A row
--     keyed by user A and a row keyed by A's `users.qubik_wallet_address` are
--     two different holders to these indexes, even though both mint to the same
--     address. That gap is closed in the record builder (which now skips an
--     Issue Coin holding whose wallet belongs to a voter) rather than here,
--     because expressing it in an index would mean denormalising the wallet
--     into this table and keeping it in step with the user's.
--   * It does not touch `vote_nfts.user_id`'s ON DELETE SET NULL, which cannot
--     succeed for a user-held row: nulling user_id leaves both holder columns
--     NULL and the CHECK rejects it, so deleting such a user fails. That was
--     already true under the old CHECK. Whether a deleted user's NFT should be
--     rewritten to its wallet, retained, or cascade-deleted is a retention
--     decision, not a constraint fix. Recorded as a follow-up.
--
-- ROLLBACK
--   DROP FUNCTION IF EXISTS public.claim_vote_nft_records(UUID, JSONB);
--   DROP INDEX IF EXISTS public.uq_vote_nft_user_holder;
--   DROP INDEX IF EXISTS public.uq_vote_nft_wallet_holder;
--   ALTER TABLE public.vote_nfts DROP CONSTRAINT chk_nft_holder_identity;
--   ALTER TABLE public.vote_nfts ADD CONSTRAINT chk_nft_holder_identity
--     CHECK (user_id IS NOT NULL OR wallet_address IS NOT NULL);
--   ALTER TABLE public.vote_nfts ADD CONSTRAINT uq_vote_nft_holder
--     UNIQUE (vote_id, user_id, wallet_address);
--   This restores a rule that enforces nothing, and the writer would have to be
--   reverted with it. Prefer fixing forward.
-- =============================================================================

-- ── 0. preflight: refuse to install a rule the data already breaks ──────────
-- Production is empty, but this migration also has to run against staging and
-- any self-hosted copy, and the old constraint permitted every shape the new
-- rules forbid. Without this, such a database fails at section 2 or 3 with a
-- bare `check_violation` / `unique_violation` naming no row, and the operator
-- has to reverse-engineer what happened.
--
-- It refuses rather than cleans, on purpose. Each of these rows may correspond
-- to an NFT that is already on chain, and choosing which duplicate to delete is
-- not a decision a migration gets to make silently.

DO $preflight$
DECLARE
  v_shape  BIGINT;
  v_user   BIGINT;
  v_wallet BIGINT;
BEGIN
  -- The exact negation of chk_nft_holder_identity below: rows naming both
  -- holders, neither, a blank wallet, or a wallet stored with surrounding
  -- whitespace. Written once, here, so the two can never disagree.
  SELECT count(*) INTO v_shape
    FROM public.vote_nfts
   WHERE NOT (
     (user_id IS NOT NULL AND wallet_address IS NULL)
     OR
     (user_id IS NULL
      AND wallet_address IS NOT NULL
      AND wallet_address ~ '^[^[:space:]]+$')
   );

  SELECT count(*) INTO v_user FROM (
    SELECT 1 FROM public.vote_nfts WHERE user_id IS NOT NULL
     GROUP BY vote_id, user_id HAVING count(*) > 1
  ) d;

  -- Grouped on the whitespace-stripped wallet, which is stricter than the
  -- index: 'W' and ' W ' are two index entries but one recipient, and both
  -- would mint.
  SELECT count(*) INTO v_wallet FROM (
    SELECT 1 FROM public.vote_nfts WHERE wallet_address IS NOT NULL
     GROUP BY vote_id, regexp_replace(wallet_address, '[[:space:]]', '', 'g')
    HAVING count(*) > 1
  ) d;

  IF v_shape > 0 OR v_user > 0 OR v_wallet > 0 THEN
    RAISE EXCEPTION
      'vote_nfts already holds rows the new holder rules forbid: % with a '
      'holder shape the new CHECK refuses (both holders, neither, a blank '
      'wallet, or a wallet stored with surrounding whitespace), % duplicated '
      '(vote_id, user_id) groups, % duplicated (vote_id, trimmed wallet) '
      'groups. Resolve them before applying this migration -- each duplicate '
      'may already be minted on chain, so which one survives is an operator '
      'decision, not a migration''s, and trimming a stored address changes '
      'which recipient the row names.',
      v_shape, v_user, v_wallet
      USING HINT = 'select vote_id, user_id, wallet_address, status, mint_address'
                   ' from public.vote_nfts order by vote_id, created_at;';
  END IF;
END;
$preflight$;

-- ── 1. remove the constraint that enforced nothing ──────────────────────────

ALTER TABLE public.vote_nfts
  DROP CONSTRAINT IF EXISTS uq_vote_nft_holder;

-- ── 2. exactly one holder identity per row ──────────────────────────────────
-- The check states a PHYSICAL shape, not a logical one, because everything
-- downstream reads the column verbatim:
--
--   * `'' IS NOT NULL` is true, so a blank wallet takes a slot in the wallet
--     index while naming nobody -- a row that can never be minted, blocking one
--     that could.
--   * A user-held row carrying wallet_address = '   ' would read as
--     exactly-one-holder under any trimming test while still entering BOTH
--     partial indexes.
--   * `'W'` and `' W '` are one recipient but two distinct index entries, so a
--     padded row would sit beside its own canonical form and both would mint.
--     The test is `~ '^[^[:space:]]+$'` rather than `= btrim(...)` because
--     `btrim` strips only the space character by default: a wallet wrapped in
--     tabs or a trailing newline passes a trim comparison unchanged. A Solana
--     address is base58 and contains no whitespace at all, so requiring that
--     directly covers every variant at once.
--
-- So: a user-held row has wallet_address IS NULL, and a wallet-held row has no
-- user and a wallet that is non-empty and free of whitespace. The preflight in
-- section 0 is the exact negation of this expression, so the two cannot drift
-- into disagreeing about what a holder is.
--
-- The explicit `wallet_address IS NOT NULL` is load-bearing, not redundant with
-- the pattern test. Without it a row naming NO holder evaluates the second arm
-- to NULL, `false OR NULL` is NULL, and a CHECK treats NULL as satisfied -- so
-- the one shape this constraint most obviously exists to reject would be
-- accepted.

ALTER TABLE public.vote_nfts
  DROP CONSTRAINT IF EXISTS chk_nft_holder_identity;
ALTER TABLE public.vote_nfts
  ADD CONSTRAINT chk_nft_holder_identity CHECK (
    (user_id IS NOT NULL AND wallet_address IS NULL)
    OR
    (user_id IS NULL
     AND wallet_address IS NOT NULL
     AND wallet_address ~ '^[^[:space:]]+$')
  );

-- ── 3. the two holder shapes, each unique within its vote ───────────────────
-- Deliberately NOT `CREATE UNIQUE INDEX IF NOT EXISTS`. That form matches on
-- name alone: an index of the same name with different columns, a different
-- predicate, or no uniqueness would be left in place with only a notice, and
-- since section 1 has already dropped the old constraint the migration would be
-- recorded as applied while enforcing neither rule. Dropping by name first
-- makes the definition below the one that ends up installed.

DROP INDEX IF EXISTS public.uq_vote_nft_user_holder;
CREATE UNIQUE INDEX uq_vote_nft_user_holder
  ON public.vote_nfts (vote_id, user_id)
  WHERE user_id IS NOT NULL;

DROP INDEX IF EXISTS public.uq_vote_nft_wallet_holder;
CREATE UNIQUE INDEX uq_vote_nft_wallet_holder
  ON public.vote_nfts (vote_id, wallet_address)
  WHERE wallet_address IS NOT NULL;

COMMENT ON INDEX public.uq_vote_nft_user_holder IS
  'One NFT per Taruu user per vote. Partial because a wallet-held row has a '
  'NULL user_id, and NULLs are distinct in a unique index -- which is exactly '
  'how the constraint this replaced came to enforce nothing. `type` is out of '
  'the key on purpose: a holder gets one NFT for a vote, not one per type.';

COMMENT ON INDEX public.uq_vote_nft_wallet_holder IS
  'One NFT per external wallet per vote. Sibling of uq_vote_nft_user_holder; '
  'see chk_nft_holder_identity, which guarantees every row is in exactly one '
  'of the two.';

-- ── 4. the only supported way to create these rows ──────────────────────────
-- A batch insert cannot be made idempotent from PostgREST: inferring a PARTIAL
-- unique index as an ON CONFLICT arbiter requires restating its WHERE clause,
-- which the client cannot express. So the claim lives in the database, where
-- both arbiters can be named exactly, and the writer calls it.
--
-- SECURITY INVOKER, not DEFINER: every caller is `supabaseAdmin`, the
-- service-role client, which is not subject to RLS anyway. Making it DEFINER
-- would add an ownership-privileged, PostgREST-reachable mutator for no gain --
-- the class of function that 20260904000001 exists to close. The ACL is still
-- stated explicitly rather than left to the PUBLIC default.

CREATE OR REPLACE FUNCTION public.claim_vote_nft_records(
  p_vote_id UUID,
  p_records JSONB
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_claimed INTEGER := 0;
  v_batch   INTEGER;
BEGIN
  IF p_vote_id IS NULL THEN
    RAISE EXCEPTION 'p_vote_id is required' USING ERRCODE = '22023';
  END IF;
  IF p_records IS NULL OR jsonb_typeof(p_records) <> 'array' THEN
    RAISE EXCEPTION 'p_records must be a JSON array' USING ERRCODE = '22023';
  END IF;

  -- Refuse the shapes chk_nft_holder_identity refuses, with a message that says
  -- which record is wrong. Letting the CHECK fire instead would abort the whole
  -- batch on a generic violation.
  --
  -- Whitespace is stripped and a blank result treated as absent throughout,
  -- matching chk_nft_holder_identity, which requires a wallet with no
  -- whitespace in it at all. The default `btrim` strips only spaces, so the
  -- character set is spelled out.
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_records) AS r
     WHERE (nullif(btrim(r ->> 'user_id', E' \t\r\n\f\v'), '') IS NULL)
         = (nullif(btrim(r ->> 'wallet_address', E' \t\r\n\f\v'), '') IS NULL)
  ) THEN
    RAISE EXCEPTION
      'every record must name exactly one holder: user_id or wallet_address'
      USING ERRCODE = '22023';
  END IF;

  -- User-held rows. ON CONFLICT DO NOTHING also absorbs duplicates WITHIN one
  -- call, so a caller that enumerates the same voter twice is harmless.
  WITH claimed AS (
    INSERT INTO public.vote_nfts (vote_id, user_id, type, metadata, status)
    SELECT p_vote_id,
           nullif(btrim(r ->> 'user_id', E' \t\r\n\f\v'), '')::UUID,
           (r ->> 'type')::public.nft_type,
           r -> 'metadata',
           'pending'
      FROM jsonb_array_elements(p_records) AS r
     WHERE nullif(btrim(r ->> 'user_id', E' \t\r\n\f\v'), '') IS NOT NULL
    ON CONFLICT (vote_id, user_id) WHERE user_id IS NOT NULL DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_batch FROM claimed;
  v_claimed := v_claimed + v_batch;

  -- Wallet-held rows.
  WITH claimed AS (
    INSERT INTO public.vote_nfts (vote_id, wallet_address, type, metadata, status)
    SELECT p_vote_id,
           nullif(btrim(r ->> 'wallet_address', E' \t\r\n\f\v'), ''),
           (r ->> 'type')::public.nft_type,
           r -> 'metadata',
           'pending'
      FROM jsonb_array_elements(p_records) AS r
     WHERE nullif(btrim(r ->> 'wallet_address', E' \t\r\n\f\v'), '') IS NOT NULL
    ON CONFLICT (vote_id, wallet_address) WHERE wallet_address IS NOT NULL DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_batch FROM claimed;
  v_claimed := v_claimed + v_batch;

  RETURN v_claimed;
END;
$$;

COMMENT ON FUNCTION public.claim_vote_nft_records(UUID, JSONB) IS
  'Idempotently claim the NFT rows for one vote''s participants. Returns how '
  'many rows this call actually created, so a re-run of vote resolution returns '
  '0 rather than duplicating or failing. Each record names exactly one holder.';

REVOKE ALL ON FUNCTION public.claim_vote_nft_records(UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_vote_nft_records(UUID, JSONB)
  TO service_role;

-- SECURITY INVOKER means the INSERT inside runs with the CALLER's table rights,
-- so EXECUTE alone is not enough. The hosted project already grants these
-- through Supabase's default privileges, which makes the dependency invisible
-- and easy to break: a database built from this repository alone has the
-- EXECUTE grant and still fails with 'permission denied for table vote_nfts'.
-- Stating it here makes the function self-supporting in every environment.
-- Granting on an existing privilege is a no-op, so this changes nothing in
-- production. DELETE is deliberately absent: nothing deletes these rows, and an
-- NFT row is the record of an irreversible on-chain asset.
GRANT SELECT, INSERT, UPDATE ON public.vote_nfts TO service_role;
