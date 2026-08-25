-- A duplicate holding is not a tidy-up problem: it splits one holder's tokens
-- and invested ILS across two rows, and the next purchase's `.single()` lookup
-- then errors, so one race permanently breaks buying for that holder.
--
-- Section 1 is the negative control -- the exact row shape the old
-- `uq_issue_coin_holding UNIQUE (issue_coin_id, user_id, wallet_address)`
-- accepted. Without it the rest would pass against the broken constraint too.
--
-- Driven by scripts/db-test.sh. Wraps itself in BEGIN/ROLLBACK.

BEGIN;

DO $test$
DECLARE
  v_user   UUID := gen_random_uuid();
  v_other  UUID := gen_random_uuid();
  v_vote   UUID := gen_random_uuid();
  v_vote_b UUID := gen_random_uuid();
  v_coin   UUID := gen_random_uuid();
  v_coin_b UUID := gen_random_uuid();
  v_wallet TEXT := 'Ho1derWa11etAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  n        INTEGER;
  seen     TEXT;
BEGIN
  INSERT INTO public.municipalities (code, name_he, slug_he)
       VALUES ('ich-test-muni', 'רשות אחזקות', 'ich-test-muni')
  ON CONFLICT (code) DO NOTHING;
  INSERT INTO public.users (id, email, municipality_id)
       VALUES (v_user,  'holding-a@example.test', 'ich-test-muni'),
              (v_other, 'holding-b@example.test', 'ich-test-muni');
  INSERT INTO public.votes (id, creator_id, title, description, municipality_id,
                            status, end_date)
       VALUES (v_vote,   v_user, 'holding vote',   'd', 'ich-test-muni', 'active',
               now() + interval '1 day'),
              (v_vote_b, v_user, 'holding vote b', 'd', 'ich-test-muni', 'active',
               now() + interval '1 day');
  -- issue_coins.vote_id is UNIQUE, so two coins need two votes.
  INSERT INTO public.issue_coins (id, vote_id, token_mint, token_name, token_symbol)
       VALUES (v_coin,   v_vote,   'Mint1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
               'coin a', 'TARU-A'),
              (v_coin_b, v_vote_b, 'Mint2BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
               'coin b', 'TARU-B');

  -- ── 1. the rule the old constraint could not state ────────────────────────
  INSERT INTO public.issue_coin_holdings (issue_coin_id, user_id, token_amount)
       VALUES (v_coin, v_user, '100');

  seen := NULL;
  BEGIN
    INSERT INTO public.issue_coin_holdings (issue_coin_id, user_id, token_amount)
         VALUES (v_coin, v_user, '250');
  EXCEPTION WHEN unique_violation THEN
    seen := 'refused';
  END;
  IF seen IS DISTINCT FROM 'refused' THEN
    RAISE EXCEPTION 'a second holding for the same user and Issue Coin was '
                    'accepted; both rows have a NULL wallet_address, which is '
                    'exactly the shape uq_issue_coin_holding allowed';
  END IF;

  -- ── 2. the wallet half of the same rule ───────────────────────────────────
  INSERT INTO public.issue_coin_holdings (issue_coin_id, wallet_address, token_amount)
       VALUES (v_coin, v_wallet, '10');

  seen := NULL;
  BEGIN
    INSERT INTO public.issue_coin_holdings (issue_coin_id, wallet_address, token_amount)
         VALUES (v_coin, v_wallet, '20');
  EXCEPTION WHEN unique_violation THEN
    seen := 'refused';
  END;
  IF seen IS DISTINCT FROM 'refused' THEN
    RAISE EXCEPTION 'a second holding for the same wallet and Issue Coin was '
                    'accepted';
  END IF;

  -- ── 3. what must STILL be allowed ─────────────────────────────────────────
  INSERT INTO public.issue_coin_holdings (issue_coin_id, user_id, token_amount)
       VALUES (v_coin_b, v_user, '5'), (v_coin, v_other, '7');
  INSERT INTO public.issue_coin_holdings (issue_coin_id, wallet_address, token_amount)
       VALUES (v_coin_b, v_wallet, '9');

  SELECT count(*) INTO n FROM public.issue_coin_holdings
   WHERE issue_coin_id IN (v_coin, v_coin_b);
  IF n <> 5 THEN
    RAISE EXCEPTION 'expected the five legitimate holdings to survive, found %', n;
  END IF;

  -- ── 4. exactly one holder identity, and a usable wallet ───────────────────
  seen := NULL;
  BEGIN
    INSERT INTO public.issue_coin_holdings (issue_coin_id, token_amount)
         VALUES (v_coin, '1');
  EXCEPTION WHEN check_violation THEN seen := 'refused';
  END;
  IF seen IS DISTINCT FROM 'refused' THEN
    RAISE EXCEPTION 'a holding naming no holder at all was accepted';
  END IF;

  seen := NULL;
  BEGIN
    INSERT INTO public.issue_coin_holdings (issue_coin_id, user_id, wallet_address, token_amount)
         VALUES (v_coin_b, v_other, 'SomeWa11etBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', '1');
  EXCEPTION WHEN check_violation THEN seen := 'refused';
  END;
  IF seen IS DISTINCT FROM 'refused' THEN
    RAISE EXCEPTION 'a holding naming BOTH a user and a wallet was accepted; it '
                    'sits in both unique indexes and reserves two holders';
  END IF;

  seen := NULL;
  BEGIN
    INSERT INTO public.issue_coin_holdings (issue_coin_id, wallet_address, token_amount)
         VALUES (v_coin_b, E' \t ', '1');
  EXCEPTION WHEN check_violation THEN seen := 'refused';
  END;
  IF seen IS DISTINCT FROM 'refused' THEN
    RAISE EXCEPTION 'an all-whitespace wallet was accepted as a holder';
  END IF;

  seen := NULL;
  BEGIN
    INSERT INTO public.issue_coin_holdings (issue_coin_id, wallet_address, token_amount)
         VALUES (v_coin_b, '  PaddedWa11etCCCCCCCCCCCCCCCCCCCCCCCCCCCC  ', '1');
  EXCEPTION WHEN check_violation THEN seen := 'refused';
  END;
  IF seen IS DISTINCT FROM 'refused' THEN
    RAISE EXCEPTION 'a wallet stored with surrounding whitespace was accepted; '
                    'it would sit in the index beside its own canonical form';
  END IF;
END;
$test$;

-- ── 5. the writer: a second purchase adds, it does not duplicate ────────────
-- This is the half that makes the constraint safe. The old writer SELECTed and
-- then INSERTed, so two overlapping purchases both saw "no holding" and both
-- inserted. The RPC decides inside one statement, under the lock that enforces
-- the index.
DO $writer$
DECLARE
  v_user   UUID := gen_random_uuid();
  v_vote   UUID := gen_random_uuid();
  v_coin   UUID := gen_random_uuid();
  v_wallet TEXT := 'C1aimHo1derWa11etDDDDDDDDDDDDDDDDDDDDDDDDD';
  v_row    public.issue_coin_holdings;
  v_first  TIMESTAMPTZ;
  n        INTEGER;
  seen     TEXT;
BEGIN
  INSERT INTO public.municipalities (code, name_he, slug_he)
       VALUES ('ich-claim-muni', 'רשות רכישה', 'ich-claim-muni')
  ON CONFLICT (code) DO NOTHING;
  INSERT INTO public.users (id, email, municipality_id)
       VALUES (v_user, 'claim@example.test', 'ich-claim-muni');
  INSERT INTO public.votes (id, creator_id, title, description, municipality_id,
                            status, end_date)
       VALUES (v_vote, v_user, 'claim vote', 'd', 'ich-claim-muni', 'active',
               now() + interval '1 day');
  INSERT INTO public.issue_coins (id, vote_id, token_mint, token_name, token_symbol)
       VALUES (v_coin, v_vote, 'Mint3CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
               'claim coin', 'TARU-C');

  v_row := public.claim_issue_coin_holding(v_coin, v_user, NULL, '100', 250, TRUE);
  IF v_row.token_amount <> '100' OR v_row.invested_ils <> 250 THEN
    RAISE EXCEPTION 'first purchase recorded % tokens / % ILS',
      v_row.token_amount, v_row.invested_ils;
  END IF;
  v_first := v_row.first_purchase_at;

  -- The second purchase ACCUMULATES rather than creating a second row. Under
  -- the old writer two concurrent callers each got a row and the balance split.
  v_row := public.claim_issue_coin_holding(v_coin, v_user, NULL, '250', 300, FALSE);
  IF v_row.token_amount <> '350' OR v_row.invested_ils <> 550 THEN
    RAISE EXCEPTION 'second purchase gave % tokens / % ILS, expected 350 / 550',
      v_row.token_amount, v_row.invested_ils;
  END IF;

  SELECT count(*) INTO n FROM public.issue_coin_holdings
   WHERE issue_coin_id = v_coin AND user_id = v_user;
  IF n <> 1 THEN
    RAISE EXCEPTION 'two purchases produced % holdings', n;
  END IF;

  -- first_purchase_at is when they FIRST bought, so a later purchase must not
  -- move it, and residency once verified must not be cleared by a call that
  -- omits it.
  IF v_row.first_purchase_at <> v_first THEN
    RAISE EXCEPTION 'a later purchase moved first_purchase_at';
  END IF;
  IF NOT v_row.is_local_resident THEN
    RAISE EXCEPTION 'a later purchase cleared verified residency';
  END IF;
  -- Strictly later, not merely not-earlier: `now()` is fixed at transaction
  -- start, so an implementation using it would tie here and record both
  -- purchases at the same instant.
  IF v_row.last_purchase_at <= v_first THEN
    RAISE EXCEPTION 'last_purchase_at did not advance between two purchases; '
                    'a transaction-start timestamp cannot tell them apart';
  END IF;

  -- An out-of-order arrival must not invert the timestamps. A call that started
  -- earlier can commit later after waiting on the row lock, so the row keeps the
  -- earliest first_purchase_at and the latest last_purchase_at rather than
  -- whichever value arrived last.
  UPDATE public.issue_coin_holdings
     SET last_purchase_at = v_first + interval '1 hour'
   WHERE issue_coin_id = v_coin AND user_id = v_user;
  v_row := public.claim_issue_coin_holding(v_coin, v_user, NULL, '1', 0, FALSE);
  IF v_row.last_purchase_at <> v_first + interval '1 hour' THEN
    RAISE EXCEPTION 'a later-stamped purchase was overwritten by an '
                    'earlier-stamped one: last_purchase_at is %',
      v_row.last_purchase_at;
  END IF;
  IF v_row.first_purchase_at <> v_first THEN
    RAISE EXCEPTION 'first_purchase_at moved';
  END IF;

  -- Amounts far beyond BIGINT: token_amount is TEXT because these are base
  -- units of an SPL token, and the accumulation must not silently overflow.
  v_row := public.claim_issue_coin_holding(
    v_coin, NULL, v_wallet, '99999999999999999999999999', 0, FALSE);
  v_row := public.claim_issue_coin_holding(
    v_coin, NULL, v_wallet, '1', 0, FALSE);
  IF v_row.token_amount <> '100000000000000000000000000' THEN
    RAISE EXCEPTION 'large-amount accumulation gave %', v_row.token_amount;
  END IF;

  -- A wallet is stored canonically, so a padded repeat purchase finds the same
  -- holding rather than being refused by the CHECK.
  v_row := public.claim_issue_coin_holding(
    v_coin, NULL, '  ' || v_wallet || E'\t', '9', 0, FALSE);
  IF v_row.wallet_address <> v_wallet THEN
    RAISE EXCEPTION 'the RPC stored a wallet it had not canonicalised: %',
      v_row.wallet_address;
  END IF;
  SELECT count(*) INTO n FROM public.issue_coin_holdings
   WHERE issue_coin_id = v_coin AND wallet_address IS NOT NULL;
  IF n <> 1 THEN
    RAISE EXCEPTION 'a padded wallet created a second holding (% rows)', n;
  END IF;

  -- Inputs that would corrupt a balance are refused by name.
  FOR seen IN SELECT unnest(ARRAY['-5', 'abc', '1.5', '', '0']) LOOP
    DECLARE
      caught TEXT := NULL;
    BEGIN
      BEGIN
        PERFORM public.claim_issue_coin_holding(v_coin, v_user, NULL, seen, 0, FALSE);
      EXCEPTION WHEN SQLSTATE '22023' THEN caught := 'refused';
      END;
      IF caught IS DISTINCT FROM 'refused' THEN
        RAISE EXCEPTION 'the RPC accepted % as a token amount', quote_literal(seen);
      END IF;
    END;
  END LOOP;

  seen := NULL;
  BEGIN
    PERFORM public.claim_issue_coin_holding(v_coin, v_user, NULL, '1', -1, FALSE);
  EXCEPTION WHEN SQLSTATE '22023' THEN seen := 'refused';
  END;
  IF seen IS DISTINCT FROM 'refused' THEN
    RAISE EXCEPTION 'the RPC accepted a negative invested_ils';
  END IF;

  seen := NULL;
  BEGIN
    PERFORM public.claim_issue_coin_holding(v_coin, v_user, v_wallet, '1', 0, FALSE);
  EXCEPTION WHEN SQLSTATE '22023' THEN seen := 'refused';
  END;
  IF seen IS DISTINCT FROM 'refused' THEN
    RAISE EXCEPTION 'the RPC accepted a call naming both holders';
  END IF;

  seen := NULL;
  BEGIN
    PERFORM public.claim_issue_coin_holding(v_coin, NULL, E'  \t ', '1', 0, FALSE);
  EXCEPTION WHEN SQLSTATE '22023' THEN seen := 'refused';
  END;
  IF seen IS DISTINCT FROM 'refused' THEN
    RAISE EXCEPTION 'the RPC accepted an all-whitespace wallet as a holder';
  END IF;

  -- Interior whitespace is REFUSED, not repaired. Stripping it would turn
  -- 'A B' into 'AB' -- a different and possibly real wallet, whose balance this
  -- call would then credit. On a table that records money, guessing is worse
  -- than failing.
  seen := NULL;
  BEGIN
    PERFORM public.claim_issue_coin_holding(
      v_coin, NULL, substr(v_wallet, 1, 10) || ' ' || substr(v_wallet, 11),
      '1', 0, FALSE);
  EXCEPTION WHEN SQLSTATE '22023' THEN seen := 'refused';
  END;
  IF seen IS DISTINCT FROM 'refused' THEN
    RAISE EXCEPTION 'the RPC accepted a wallet with an interior space, which '
                    'would have been silently rewritten into another address';
  END IF;

  -- Nothing above left a stray row behind.
  SELECT count(*) INTO n FROM public.issue_coin_holdings WHERE issue_coin_id = v_coin;
  IF n <> 2 THEN
    RAISE EXCEPTION 'expected one user holding and one wallet holding, found %', n;
  END IF;
END;
$writer$;

-- ── 6. the grant is real, and the function is not a definer mutator ─────────
DO $acl$
DECLARE
  v_user UUID := gen_random_uuid();
  v_vote UUID := gen_random_uuid();
  v_coin UUID := gen_random_uuid();
  v_row  public.issue_coin_holdings;
  v_sig  TEXT := 'public.claim_issue_coin_holding(uuid, uuid, text, text, integer, boolean)';
BEGIN
  IF (SELECT prosecdef FROM pg_proc WHERE oid = v_sig::regprocedure) THEN
    RAISE EXCEPTION 'claim_issue_coin_holding is SECURITY DEFINER; a balance '
                    'mutator has no business ignoring RLS';
  END IF;
  IF has_function_privilege('anon', v_sig, 'EXECUTE')
     OR has_function_privilege('authenticated', v_sig, 'EXECUTE') THEN
    RAISE EXCEPTION 'anon or authenticated can EXECUTE claim_issue_coin_holding';
  END IF;

  INSERT INTO public.municipalities (code, name_he, slug_he)
       VALUES ('ich-role-muni', 'רשות תפקיד', 'ich-role-muni')
  ON CONFLICT (code) DO NOTHING;
  INSERT INTO public.users (id, email, municipality_id)
       VALUES (v_user, 'ich-role@example.test', 'ich-role-muni');
  INSERT INTO public.votes (id, creator_id, title, description, municipality_id,
                            status, end_date)
       VALUES (v_vote, v_user, 'role vote', 'd', 'ich-role-muni', 'active',
               now() + interval '1 day');
  INSERT INTO public.issue_coins (id, vote_id, token_mint, token_name, token_symbol)
       VALUES (v_coin, v_vote, 'Mint4DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
               'role coin', 'TARU-D');

  -- SECURITY INVOKER means the INSERT runs with the CALLER's table rights, so
  -- an EXECUTE grant alone proves nothing. Every other block here runs as the
  -- test superuser and would never notice a missing table grant.
  SET LOCAL ROLE service_role;
  v_row := public.claim_issue_coin_holding(v_coin, v_user, NULL, '1', 0, FALSE);
  RESET ROLE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'service_role could not record a holding through the RPC';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RAISE;
END;
$acl$;

-- ── 7. the shape of the guarantee, not just its behaviour ───────────────────
DO $shape$
DECLARE
  v_defs TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.issue_coin_holdings'::regclass
       AND conname = 'uq_issue_coin_holding'
  ) THEN
    RAISE EXCEPTION 'uq_issue_coin_holding is back; it enforces nothing for '
                    'either holder shape and its presence hides that';
  END IF;

  SELECT string_agg(pg_get_indexdef(indexrelid), E'\n' ORDER BY indexrelid::regclass::text)
    INTO v_defs
    FROM pg_index
   WHERE indrelid = 'public.issue_coin_holdings'::regclass AND indisunique
     AND indexrelid::regclass::text LIKE 'uq_issue_coin_holding%';

  IF v_defs IS NULL
     OR v_defs NOT LIKE '%(issue_coin_id, user_id) WHERE (user_id IS NOT NULL)%' THEN
    RAISE EXCEPTION 'the user-holder index is not (issue_coin_id, user_id) '
                    'partial on user_id IS NOT NULL: %', coalesce(v_defs, '(none)');
  END IF;
  IF v_defs NOT LIKE '%(issue_coin_id, wallet_address) WHERE (wallet_address IS NOT NULL)%' THEN
    RAISE EXCEPTION 'the wallet-holder index is not (issue_coin_id, '
                    'wallet_address) partial on wallet_address IS NOT NULL: %', v_defs;
  END IF;
END;
$shape$;

-- ── 8. the writer decides inside one statement ──────────────────────────────
-- Every assertion above runs sequentially on one connection, so none of them
-- can distinguish this implementation from the read-then-write upsert it
-- replaced -- that one would pass them too, and still lose a race. Two real
-- sessions are not available in a single .sql file driven by one psql, so the
-- property is asserted structurally instead: the accumulate-or-create decision
-- must be an ON CONFLICT ... DO UPDATE arbitrated by the two partial indexes,
-- which is what makes it atomic, and there must be no SELECT of an existing
-- holding beforehand to branch on.
DO $atomic$
DECLARE
  v_src TEXT;
BEGIN
  SELECT prosrc INTO v_src FROM pg_proc
   WHERE oid = 'public.claim_issue_coin_holding(uuid, uuid, text, text, integer, boolean)'::regprocedure;

  IF v_src !~ 'ON CONFLICT \(issue_coin_id, user_id\)\s+WHERE user_id IS NOT NULL\s+DO UPDATE' THEN
    RAISE EXCEPTION 'the user arm does not accumulate through ON CONFLICT DO '
                    'UPDATE on uq_issue_coin_holding_user';
  END IF;
  IF v_src !~ 'ON CONFLICT \(issue_coin_id, wallet_address\)\s+WHERE wallet_address IS NOT NULL\s+DO UPDATE' THEN
    RAISE EXCEPTION 'the wallet arm does not accumulate through ON CONFLICT DO '
                    'UPDATE on uq_issue_coin_holding_wallet';
  END IF;
  IF v_src ~* 'SELECT[^;]*FROM\s+public\.issue_coin_holdings' THEN
    RAISE EXCEPTION 'the writer reads issue_coin_holdings before writing it; '
                    'that is the read-then-write shape whose two concurrent '
                    'callers each inserted a row and split the balance';
  END IF;
END;
$atomic$;

ROLLBACK;
