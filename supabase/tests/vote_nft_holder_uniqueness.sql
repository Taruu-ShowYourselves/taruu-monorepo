-- An NFT mint is irreversible on chain, so "one per holder per vote" has to be
-- a fact the database enforces rather than a convention a future minter is
-- trusted to keep.
--
-- The interesting half of this file is the NEGATIVE control at the top: it
-- proves the shape the old `uq_vote_nft_holder UNIQUE (vote_id, user_id,
-- wallet_address)` accepted. Without it, the positive cases below would pass
-- against the broken constraint too and prove nothing about the change.
--
-- `scripts/db-test.sh` drives this in CI. It wraps itself in BEGIN/ROLLBACK and
-- leaves no rows behind.

BEGIN;

DO $test$
DECLARE
  v_user   UUID := gen_random_uuid();
  v_other  UUID := gen_random_uuid();
  v_vote   UUID := gen_random_uuid();
  v_vote_b UUID := gen_random_uuid();
  v_wallet TEXT := 'So1anaWa11etAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  n        INTEGER;
  seen     TEXT;
BEGIN
  -- ── fixtures ──────────────────────────────────────────────────────────────
  INSERT INTO public.municipalities (code, name_he, slug_he)
       VALUES ('nft-test-muni', 'רשות בדיקת NFT', 'nft-test-muni')
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO public.users (id, email, municipality_id)
       VALUES (v_user,  'holder@example.test', 'nft-test-muni'),
              (v_other, 'other@example.test',  'nft-test-muni');

  INSERT INTO public.votes (id, creator_id, title, description, municipality_id,
                            status, end_date)
       VALUES (v_vote,   v_user, 'nft vote',   'd', 'nft-test-muni', 'active',
               now() + interval '1 day'),
              (v_vote_b, v_user, 'other vote', 'd', 'nft-test-muni', 'active',
               now() + interval '1 day');

  -- ── 1. the rule the old constraint could not state ────────────────────────
  INSERT INTO public.vote_nfts (vote_id, user_id, type)
       VALUES (v_vote, v_user, 'verified_voter');

  seen := NULL;
  BEGIN
    INSERT INTO public.vote_nfts (vote_id, user_id, type)
         VALUES (v_vote, v_user, 'verified_voter');
  EXCEPTION WHEN unique_violation THEN
    seen := 'refused';
  END;
  IF seen IS DISTINCT FROM 'refused' THEN
    RAISE EXCEPTION 'a second NFT for the same user and vote was accepted; '
                    'this is the exact row shape uq_vote_nft_holder allowed, '
                    'because its wallet_address is NULL on both rows';
  END IF;

  -- ── 2. and it is not escapable by choosing another NFT type ───────────────
  -- `type` is deliberately absent from the key. If it were in the key this
  -- would insert, and one holder would end up with two irreversible mints for
  -- one vote -- which is the duplicate the whole constraint exists to stop.
  seen := NULL;
  BEGIN
    INSERT INTO public.vote_nfts (vote_id, user_id, type)
         VALUES (v_vote, v_user, 'civic_patron');
  EXCEPTION WHEN unique_violation THEN
    seen := 'refused';
  END;
  IF seen IS DISTINCT FROM 'refused' THEN
    RAISE EXCEPTION 'a second NFT of a different type reached the same holder '
                    'for the same vote; `type` must not be part of the key';
  END IF;

  -- ── 3. the wallet half of the same rule ───────────────────────────────────
  INSERT INTO public.vote_nfts (vote_id, wallet_address, type)
       VALUES (v_vote, v_wallet, 'verified_voter');

  seen := NULL;
  BEGIN
    INSERT INTO public.vote_nfts (vote_id, wallet_address, type)
         VALUES (v_vote, v_wallet, 'civic_patron');
  EXCEPTION WHEN unique_violation THEN
    seen := 'refused';
  END;
  IF seen IS DISTINCT FROM 'refused' THEN
    RAISE EXCEPTION 'a second NFT for the same external wallet and vote was '
                    'accepted';
  END IF;

  -- ── 4. what must STILL be allowed ─────────────────────────────────────────
  -- Same holder, different vote; and a different holder on the same vote.
  -- A rule that blocks these is not stricter, it is wrong.
  INSERT INTO public.vote_nfts (vote_id, user_id, type)
       VALUES (v_vote_b, v_user, 'verified_voter');
  INSERT INTO public.vote_nfts (vote_id, user_id, type)
       VALUES (v_vote, v_other, 'verified_voter');
  INSERT INTO public.vote_nfts (vote_id, wallet_address, type)
       VALUES (v_vote_b, v_wallet, 'verified_voter');

  -- Scoped to this block's own votes: the migration is meant to run against
  -- populated staging databases too, and a global count would fail there for
  -- reasons that have nothing to do with the rule under test.
  SELECT count(*) INTO n FROM public.vote_nfts WHERE vote_id IN (v_vote, v_vote_b);
  IF n <> 5 THEN
    RAISE EXCEPTION 'expected the five legitimate rows to survive, found %', n;
  END IF;

  -- ── 5. exactly one holder identity, neither zero nor two ──────────────────
  -- Two partial indexes cannot cover a row that is in neither, and a row in
  -- BOTH reserves two unrelated holders at once. The CHECK is what rules out
  -- each end.
  seen := NULL;
  BEGIN
    INSERT INTO public.vote_nfts (vote_id, type) VALUES (v_vote, 'civic_patron');
  EXCEPTION WHEN check_violation THEN
    seen := 'refused';
  END;
  IF seen IS DISTINCT FROM 'refused' THEN
    RAISE EXCEPTION 'a row with no holder identity at all was accepted';
  END IF;

  seen := NULL;
  BEGIN
    INSERT INTO public.vote_nfts (vote_id, user_id, wallet_address, type)
         VALUES (v_vote_b, v_other, 'SomeOtherWa11etBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
                 'civic_patron');
  EXCEPTION WHEN check_violation THEN
    seen := 'refused';
  END;
  IF seen IS DISTINCT FROM 'refused' THEN
    RAISE EXCEPTION 'a row naming BOTH a user and an unrelated wallet was '
                    'accepted; it sits in both unique indexes and blocks '
                    'issuance to two different holders';
  END IF;

  -- The subtle version of the same row. A blank wallet reads as "no wallet" to
  -- anything that trims, but `'   ' IS NOT NULL` is true, so the row still
  -- enters the wallet index and reserves the blank slot. The CHECK therefore
  -- states the physical shape rather than the logical one.
  seen := NULL;
  BEGIN
    INSERT INTO public.vote_nfts (vote_id, user_id, wallet_address, type)
         VALUES (v_vote_b, v_other, '   ', 'civic_patron');
  EXCEPTION WHEN check_violation THEN
    seen := 'refused';
  END;
  IF seen IS DISTINCT FROM 'refused' THEN
    RAISE EXCEPTION 'a user-held row carrying a blank wallet_address was '
                    'accepted; it occupies a slot in the wallet index that no '
                    'real wallet can then take';
  END IF;

  -- A padded wallet is a different STRING from its trimmed form but the same
  -- RECIPIENT, so the index would hold both and both would mint. The column is
  -- therefore required to be canonical rather than merely non-blank.
  seen := NULL;
  BEGIN
    INSERT INTO public.vote_nfts (vote_id, wallet_address, type)
         VALUES (v_vote_b, '  PaddedWa11etEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE  ',
                 'civic_patron');
  EXCEPTION WHEN check_violation THEN
    seen := 'refused';
  END;
  IF seen IS DISTINCT FROM 'refused' THEN
    RAISE EXCEPTION 'a wallet stored with surrounding whitespace was accepted; '
                    'it would sit in the index beside its own canonical form';
  END IF;

  -- The same thing wrapped in a tab. `btrim` strips only the space character by
  -- default, so a trim-equality test would have let this through.
  seen := NULL;
  BEGIN
    INSERT INTO public.vote_nfts (vote_id, wallet_address, type)
         VALUES (v_vote_b, E'\tTabbedWa11etFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF\n',
                 'civic_patron');
  EXCEPTION WHEN check_violation THEN
    seen := 'refused';
  END;
  IF seen IS DISTINCT FROM 'refused' THEN
    RAISE EXCEPTION 'a wallet wrapped in non-space whitespace was accepted';
  END IF;

  -- The empty-string variant of the both-holders row: reads as "no wallet" to a
  -- trimming test, is NOT NULL to the index.
  seen := NULL;
  BEGIN
    INSERT INTO public.vote_nfts (vote_id, user_id, wallet_address, type)
         VALUES (v_vote_b, v_other, '', 'civic_patron');
  EXCEPTION WHEN check_violation THEN
    seen := 'refused';
  END;
  IF seen IS DISTINCT FROM 'refused' THEN
    RAISE EXCEPTION 'a user-held row carrying an empty wallet_address was '
                    'accepted';
  END IF;
END;
$test$;

-- ── 6. the writer contract: re-running a resolution claims nothing new ──────
-- This is the half that makes the constraint safe to install. `resolveVote` is
-- driven by a five-minute cron and re-runs whenever anything earlier in
-- resolution failed, so it WILL present the same participant list twice. Under
-- a plain batch INSERT the second run either duplicates (before this migration)
-- or aborts the whole batch on unique_violation (after it, without the RPC).
DO $writer$
DECLARE
  v_user   UUID := gen_random_uuid();
  v_other  UUID := gen_random_uuid();
  v_dup    UUID := gen_random_uuid();
  v_vote   UUID := gen_random_uuid();
  v_wallet TEXT := 'C1aimWa11etCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
  v_batch  JSONB;
  n        INTEGER;
BEGIN
  INSERT INTO public.municipalities (code, name_he, slug_he)
       VALUES ('nft-claim-muni', 'רשות תביעה', 'nft-claim-muni')
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO public.users (id, email, municipality_id)
       VALUES (v_user,  'claim-a@example.test', 'nft-claim-muni'),
              (v_other, 'claim-b@example.test', 'nft-claim-muni'),
              (v_dup,   'claim-c@example.test', 'nft-claim-muni');

  INSERT INTO public.votes (id, creator_id, title, description, municipality_id,
                            status, end_date)
       VALUES (v_vote, v_user, 'claim vote', 'd', 'nft-claim-muni', 'active',
               now() + interval '1 day');

  v_batch := jsonb_build_array(
    jsonb_build_object('user_id', v_user,  'type', 'verified_voter',
                       'metadata', jsonb_build_object('voteCast', 'opt-1')),
    jsonb_build_object('user_id', v_other, 'type', 'verified_voter'),
    jsonb_build_object('wallet_address', v_wallet, 'type', 'civic_patron')
  );

  n := public.claim_vote_nft_records(v_vote, v_batch);
  IF n <> 3 THEN
    RAISE EXCEPTION 'first claim should have created three rows, created %', n;
  END IF;

  -- The whole point: the identical second run neither duplicates nor raises.
  n := public.claim_vote_nft_records(v_vote, v_batch);
  IF n <> 0 THEN
    RAISE EXCEPTION 're-running the same resolution claimed % more rows', n;
  END IF;

  SELECT count(*) INTO n FROM public.vote_nfts WHERE vote_id = v_vote;
  IF n <> 3 THEN
    RAISE EXCEPTION 'expected three rows after two identical runs, found %', n;
  END IF;

  -- A partly-overlapping run claims only what is genuinely new. This is the
  -- shape a retry takes after a voter arrives between attempts.
  n := public.claim_vote_nft_records(v_vote, v_batch || jsonb_build_array(
         jsonb_build_object('wallet_address', 'LateWa11etDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
                            'type', 'civic_patron')));
  IF n <> 1 THEN
    RAISE EXCEPTION 'a retry with one new participant claimed % rows', n;
  END IF;

  -- Duplicates WITHIN a single call are absorbed too: ON CONFLICT DO NOTHING
  -- arbitrates against rows the same statement is still inserting, so a caller
  -- that enumerates one participant twice does not need to pre-deduplicate.
  n := public.claim_vote_nft_records(v_vote, jsonb_build_array(
         jsonb_build_object('user_id', v_dup, 'type', 'verified_voter'),
         jsonb_build_object('user_id', v_dup, 'type', 'verified_voter')));
  IF n <> 1 THEN
    RAISE EXCEPTION 'a batch naming the same voter twice claimed % rows', n;
  END IF;
END;
$writer$;

-- ── 7. the RPC refuses the shapes the CHECK refuses, by name ────────────────
DO $shapes$
DECLARE
  v_user UUID := gen_random_uuid();
  v_vote UUID := gen_random_uuid();
  seen   TEXT;
BEGIN
  INSERT INTO public.municipalities (code, name_he, slug_he)
       VALUES ('nft-shape-muni', 'רשות צורה', 'nft-shape-muni')
  ON CONFLICT (code) DO NOTHING;
  INSERT INTO public.users (id, email, municipality_id)
       VALUES (v_user, 'shape@example.test', 'nft-shape-muni');
  INSERT INTO public.votes (id, creator_id, title, description, municipality_id,
                            status, end_date)
       VALUES (v_vote, v_user, 'shape vote', 'd', 'nft-shape-muni', 'active',
               now() + interval '1 day');

  -- neither holder
  seen := NULL;
  BEGIN
    PERFORM public.claim_vote_nft_records(v_vote, jsonb_build_array(
      jsonb_build_object('type', 'civic_patron')));
  EXCEPTION WHEN SQLSTATE '22023' THEN seen := 'refused';
  END;
  IF seen IS DISTINCT FROM 'refused' THEN
    RAISE EXCEPTION 'the RPC accepted a record naming no holder';
  END IF;

  -- both holders
  seen := NULL;
  BEGIN
    PERFORM public.claim_vote_nft_records(v_vote, jsonb_build_array(
      jsonb_build_object('user_id', v_user, 'wallet_address', 'W', 'type', 'civic_patron')));
  EXCEPTION WHEN SQLSTATE '22023' THEN seen := 'refused';
  END;
  IF seen IS DISTINCT FROM 'refused' THEN
    RAISE EXCEPTION 'the RPC accepted a record naming both holders';
  END IF;

  -- a blank string is not a holder identity. The CHECK cannot catch this --
  -- '' IS NOT NULL -- so an empty wallet would otherwise become a row that can
  -- never be minted to anyone.
  seen := NULL;
  BEGIN
    PERFORM public.claim_vote_nft_records(v_vote, jsonb_build_array(
      jsonb_build_object('wallet_address', E' \t\n ', 'type', 'civic_patron')));
  EXCEPTION WHEN SQLSTATE '22023' THEN seen := 'refused';
  END;
  IF seen IS DISTINCT FROM 'refused' THEN
    RAISE EXCEPTION 'the RPC accepted an all-whitespace wallet as a holder';
  END IF;

  -- A padded wallet is stored canonically rather than refused: the caller named
  -- a real recipient, and storing it verbatim would put it in the index beside
  -- its own trimmed form.
  IF public.claim_vote_nft_records(v_vote, jsonb_build_array(
       jsonb_build_object('wallet_address', E'  Norma1isedWa11etGGGGGGGGGGGGGGGGGGGGGGGG \t',
                          'type', 'civic_patron'))) <> 1 THEN
    RAISE EXCEPTION 'the RPC did not claim a padded but real wallet';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.vote_nfts
     WHERE vote_id = v_vote
       AND wallet_address = 'Norma1isedWa11etGGGGGGGGGGGGGGGGGGGGGGGG'
  ) THEN
    RAISE EXCEPTION 'the RPC stored a wallet it had not normalised';
  END IF;
  DELETE FROM public.vote_nfts WHERE vote_id = v_vote;

  -- not an array
  seen := NULL;
  BEGIN
    PERFORM public.claim_vote_nft_records(v_vote, '{"user_id": "x"}'::jsonb);
  EXCEPTION WHEN SQLSTATE '22023' THEN seen := 'refused';
  END;
  IF seen IS DISTINCT FROM 'refused' THEN
    RAISE EXCEPTION 'the RPC accepted a non-array payload';
  END IF;

  -- One bad record must take the whole call down rather than claim the good
  -- half: a partial claim would leave resolution reporting a count it did not
  -- actually create.
  seen := NULL;
  BEGIN
    PERFORM public.claim_vote_nft_records(v_vote, jsonb_build_array(
      jsonb_build_object('user_id', v_user, 'type', 'verified_voter'),
      jsonb_build_object('type', 'civic_patron')));
  EXCEPTION WHEN SQLSTATE '22023' THEN seen := 'refused';
  END;
  IF seen IS DISTINCT FROM 'refused' THEN
    RAISE EXCEPTION 'the RPC accepted a batch containing an invalid record';
  END IF;
  IF EXISTS (SELECT 1 FROM public.vote_nfts WHERE vote_id = v_vote) THEN
    RAISE EXCEPTION 'a refused batch still left rows behind';
  END IF;
END;
$shapes$;

-- ── 8. the RPC is not another anonymously reachable mutator ─────────────────
DO $acl$
BEGIN
  IF (SELECT prosecdef FROM pg_proc
       WHERE oid = 'public.claim_vote_nft_records(uuid, jsonb)'::regprocedure) THEN
    RAISE EXCEPTION 'claim_vote_nft_records is SECURITY DEFINER; it has no need '
                    'to be, and definer mutators are the class 20260904000001 '
                    'exists to close';
  END IF;
  IF has_function_privilege('anon', 'public.claim_vote_nft_records(uuid, jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.claim_vote_nft_records(uuid, jsonb)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'anon or authenticated can EXECUTE claim_vote_nft_records';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.claim_vote_nft_records(uuid, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role cannot EXECUTE claim_vote_nft_records; the '
                    'writer would fail closed';
  END IF;
END;
$acl$;

-- ── 9. the grant is real, not just present in the ACL ───────────────────────
-- Section 8 reads privileges; this exercises them. `claim_vote_nft_records` is
-- SECURITY INVOKER, so its INSERT runs with the CALLER's rights -- an EXECUTE
-- grant alone proves nothing if service_role cannot write the table. Every
-- other block here runs as the test superuser, which would never notice.
DO $asrole$
DECLARE
  v_user UUID := gen_random_uuid();
  v_vote UUID := gen_random_uuid();
  n      INTEGER;
BEGIN
  INSERT INTO public.municipalities (code, name_he, slug_he)
       VALUES ('nft-role-muni', 'רשות תפקיד', 'nft-role-muni')
  ON CONFLICT (code) DO NOTHING;
  INSERT INTO public.users (id, email, municipality_id)
       VALUES (v_user, 'role@example.test', 'nft-role-muni');
  INSERT INTO public.votes (id, creator_id, title, description, municipality_id,
                            status, end_date)
       VALUES (v_vote, v_user, 'role vote', 'd', 'nft-role-muni', 'active',
               now() + interval '1 day');

  SET LOCAL ROLE service_role;
  n := public.claim_vote_nft_records(v_vote, jsonb_build_array(
         jsonb_build_object('user_id', v_user, 'type', 'verified_voter')));
  RESET ROLE;

  IF n <> 1 THEN
    RAISE EXCEPTION 'service_role could not claim through the RPC (% rows)', n;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RAISE;
END;
$asrole$;

-- ── 10. what deleting a holder does, stated rather than assumed ─────────────
-- `vote_nfts.user_id` carries ON DELETE SET NULL, which cannot satisfy the
-- holder CHECK: nulling user_id on a user-held row leaves no holder at all.
-- This was equally true of the OLD check (`user_id IS NOT NULL OR
-- wallet_address IS NOT NULL` is false when both are NULL -- `IS NOT NULL`
-- yields a strict boolean, never NULL), so the exclusive CHECK does not change
-- the outcome. Asserted here so the follow-up is anchored in observed
-- behaviour: whether a deleted user's NFT should be rewritten to their wallet,
-- retained, or cascade-deleted is a retention decision, not a constraint fix.
DO $deletion$
DECLARE
  v_creator UUID := gen_random_uuid();
  v_holder  UUID := gen_random_uuid();
  v_vote    UUID := gen_random_uuid();
  seen      TEXT;
BEGIN
  INSERT INTO public.municipalities (code, name_he, slug_he)
       VALUES ('nft-del-muni', 'רשות מחיקה', 'nft-del-muni')
  ON CONFLICT (code) DO NOTHING;
  -- The vote is created by someone ELSE. If the holder also created it,
  -- deleting them would cascade to `votes`, and `vote_nfts.vote_id` is ON
  -- DELETE RESTRICT -- so the DELETE would raise a foreign-key violation before
  -- user_id's ON DELETE SET NULL ever reached the holder CHECK, and this test
  -- would pass while proving something else entirely.
  INSERT INTO public.users (id, email, municipality_id)
       VALUES (v_creator, 'del-creator@example.test', 'nft-del-muni'),
              (v_holder,  'del-holder@example.test',  'nft-del-muni');
  INSERT INTO public.votes (id, creator_id, title, description, municipality_id,
                            status, end_date)
       VALUES (v_vote, v_creator, 'delete vote', 'd', 'nft-del-muni', 'active',
               now() + interval '1 day');
  INSERT INTO public.vote_nfts (vote_id, user_id, type)
       VALUES (v_vote, v_holder, 'verified_voter');

  seen := NULL;
  BEGIN
    DELETE FROM public.users WHERE id = v_holder;
  EXCEPTION WHEN check_violation THEN
    seen := 'check';
  END;
  IF seen IS DISTINCT FROM 'check' THEN
    RAISE EXCEPTION 'deleting a user with a held NFT no longer fails the holder '
                    'CHECK; if that is intended, the retention follow-up has '
                    'been resolved and this assertion should be updated '
                    'deliberately rather than drift';
  END IF;
END;
$deletion$;

-- ── 11. the mint claim is a claim, not an announcement ──────────────────────
-- `claimNftForMinting` mints only if its conditional UPDATE returns a row. The
-- TypeScript tests mock that call, so the predicate itself is asserted here:
-- the first claim moves the row and the second finds nothing to move. One
-- session cannot demonstrate two truly concurrent workers -- that is row-level
-- locking, and the loser re-evaluates `status = 'pending'` after the winner
-- commits, arriving at exactly the zero-row case below.
DO $claim$
DECLARE
  v_user UUID := gen_random_uuid();
  v_vote UUID := gen_random_uuid();
  v_nft  UUID;
  n      INTEGER;
BEGIN
  INSERT INTO public.municipalities (code, name_he, slug_he)
       VALUES ('nft-mint-muni', 'רשות הטבעה', 'nft-mint-muni')
  ON CONFLICT (code) DO NOTHING;
  INSERT INTO public.users (id, email, municipality_id)
       VALUES (v_user, 'mint@example.test', 'nft-mint-muni');
  INSERT INTO public.votes (id, creator_id, title, description, municipality_id,
                            status, end_date)
       VALUES (v_vote, v_user, 'mint vote', 'd', 'nft-mint-muni', 'active',
               now() + interval '1 day');

  INSERT INTO public.vote_nfts (vote_id, user_id, type, status)
       VALUES (v_vote, v_user, 'verified_voter', 'pending')
    RETURNING id INTO v_nft;

  UPDATE public.vote_nfts SET status = 'minting'
   WHERE id = v_nft AND status = 'pending';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'the first claim did not take the row (% rows)', n;
  END IF;

  UPDATE public.vote_nfts SET status = 'minting'
   WHERE id = v_nft AND status = 'pending';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN
    RAISE EXCEPTION 'a second worker also claimed the row; both would mint';
  END IF;

  -- A `failed` row is deliberately not claimable: a mint is marked failed even
  -- when the chain may have accepted the transaction, so re-minting it could
  -- produce a second asset that no constraint on this one row can see.
  UPDATE public.vote_nfts SET status = 'failed' WHERE id = v_nft;
  UPDATE public.vote_nfts SET status = 'minting'
   WHERE id = v_nft AND status = 'pending';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN
    RAISE EXCEPTION 'a failed row was claimable for minting';
  END IF;
END;
$claim$;

-- ── 12. the shape of the guarantee, not just its behaviour ──────────────────
-- Asserted structurally so a future migration cannot satisfy the cases above by
-- accident while widening the key.
DO $shape$
DECLARE
  v_defs TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.vote_nfts'::regclass AND conname = 'uq_vote_nft_holder'
  ) THEN
    RAISE EXCEPTION 'uq_vote_nft_holder is back; it enforces nothing for either '
                    'holder shape and its presence hides that';
  END IF;

  SELECT string_agg(pg_get_indexdef(indexrelid), E'\n' ORDER BY indexrelid::regclass::text)
    INTO v_defs
    FROM pg_index
   WHERE indrelid = 'public.vote_nfts'::regclass AND indisunique
     AND indexrelid::regclass::text LIKE 'uq_vote_nft%';

  IF v_defs IS NULL OR v_defs NOT LIKE '%(vote_id, user_id) WHERE (user_id IS NOT NULL)%' THEN
    RAISE EXCEPTION 'the user-holder index is not (vote_id, user_id) partial on '
                    'user_id IS NOT NULL: %', coalesce(v_defs, '(none)');
  END IF;
  IF v_defs NOT LIKE '%(vote_id, wallet_address) WHERE (wallet_address IS NOT NULL)%' THEN
    RAISE EXCEPTION 'the wallet-holder index is not (vote_id, wallet_address) '
                    'partial on wallet_address IS NOT NULL: %', v_defs;
  END IF;
  IF v_defs LIKE '%type%' THEN
    RAISE EXCEPTION 'the holder key names `type`, which weakens it to one NFT '
                    'per holder per vote per type: %', v_defs;
  END IF;
END;
$shape$;

ROLLBACK;
