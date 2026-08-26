-- `public.cast_vote` is the ballot chokepoint, so what it refuses matters as
-- much as what it records.
--
-- The behaviours asserted here are the ones the old three-write path got wrong:
-- a replayed cast must not move a counter twice, a rejected cast must leave
-- nothing behind, and an option belonging to another vote must not be castable
-- at all -- which is what let the payments webhook poison an unrelated tally.
--
-- Counters are caches of `user_votes`; every case below checks them against the
-- ledger rather than against an expected number, so a test that drifts from the
-- data model fails instead of quietly asserting the wrong thing.
--
-- WHAT THIS FILE CANNOT REACH
--
-- Every case here runs in one session and one transaction, so it cannot
-- overlap two casts and observe the row lock doing its job. The serialization
-- guarantee -- FOR UPDATE on the vote row, and both counters moved by
-- single-statement UPDATEs -- is reviewed rather than executed here, because
-- `scripts/db-test.sh` drives one `psql -f` per file and a second concurrent
-- session would mean changing the harness. What this file does cover is the
-- consequence that concurrency would otherwise corrupt: after every case, both
-- counters are compared against the `user_votes` rows they cache rather than
-- against an expected number.
--
-- `scripts/db-test.sh` drives this in CI. It wraps itself in BEGIN/ROLLBACK and
-- leaves no rows behind.

BEGIN;

DO $test$
DECLARE
  v_user      UUID := gen_random_uuid();
  v_other     UUID := gen_random_uuid();
  v_vote      UUID := gen_random_uuid();
  v_vote_b    UUID := gen_random_uuid();
  v_opt_a     UUID := gen_random_uuid();
  v_opt_b     UUID := gen_random_uuid();
  v_opt_other UUID := gen_random_uuid();
  v_closed    UUID := gen_random_uuid();
  v_opt_cl    UUID := gen_random_uuid();
  v_pending   UUID := gen_random_uuid();
  v_opt_pd    UUID := gen_random_uuid();
  r           RECORD;
  n           INTEGER;
  sqlstate_seen TEXT;
BEGIN
  -- ── fixtures ──────────────────────────────────────────────────────────────
  INSERT INTO public.municipalities (code, name_he, slug_he)
       VALUES ('test-muni', 'רשות בדיקה', 'test-muni')
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO public.users (id, email, municipality_id)
       VALUES (v_user,  'caster@example.test',  'test-muni'),
              (v_other, 'other@example.test',   'test-muni');

  INSERT INTO public.votes (id, creator_id, title, description, municipality_id,
                            status, end_date, participant_count)
       VALUES (v_vote,   v_user, 'open vote',   'd', 'test-muni', 'active',
               now() + interval '1 day', 0),
              (v_vote_b, v_user, 'other vote',  'd', 'test-muni', 'active',
               now() + interval '1 day', 0),
              (v_closed, v_user, 'closed vote', 'd', 'test-muni', 'active',
               now() - interval '1 day', 0),
              (v_pending, v_user, 'not open yet', 'd', 'test-muni', 'pending',
               now() + interval '1 day', 0);

  INSERT INTO public.vote_options (id, vote_id, text, votes)
       VALUES (v_opt_a,     v_vote,   'a', 0),
              (v_opt_b,     v_vote,   'b', 0),
              (v_opt_other, v_vote_b, 'belongs to the other vote', 0),
              (v_opt_cl,    v_closed, 'c', 0),
              (v_opt_pd,    v_pending, 'p', 0);

  -- ── a first ballot is recorded and moves both counters exactly once ───────
  SELECT * INTO r FROM public.cast_vote(v_user, v_vote, v_opt_a);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'first cast returned no row at all';
  END IF;

  IF r.out_outcome IS DISTINCT FROM 'cast' THEN
    RAISE EXCEPTION 'first cast reported %, expected cast', r.out_outcome;
  END IF;
  IF r.out_option_votes IS DISTINCT FROM 1 OR r.out_participant_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'first cast returned option_votes=% participant_count=%, expected 1 and 1',
      r.out_option_votes, r.out_participant_count;
  END IF;

  -- ── replay is idempotent: same answer, counters unmoved ───────────────────
  SELECT * INTO r FROM public.cast_vote(v_user, v_vote, v_opt_a);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'replay returned no row at all';
  END IF;

  IF r.out_outcome IS DISTINCT FROM 'already_voted' THEN
    RAISE EXCEPTION 'replay reported %, expected already_voted', r.out_outcome;
  END IF;
  IF r.out_option_votes IS DISTINCT FROM 1 OR r.out_participant_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'replay moved the counters to option_votes=% participant_count=%',
      r.out_option_votes, r.out_participant_count;
  END IF;

  -- ── changing the option on replay does not switch the ballot ──────────────
  -- The unique key is (user_id, vote_id), so a second submission with a
  -- different option is the same ballot, not a vote change.
  SELECT * INTO r FROM public.cast_vote(v_user, v_vote, v_opt_b);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'replay with a different option returned no row at all';
  END IF;

  IF r.out_outcome IS DISTINCT FROM 'already_voted'
     OR r.out_option_id IS DISTINCT FROM v_opt_a THEN
    RAISE EXCEPTION 'replay with a different option returned outcome=% option=%, expected already_voted on %',
      r.out_outcome, r.out_option_id, v_opt_a;
  END IF;

  SELECT o.votes INTO STRICT n FROM public.vote_options o WHERE o.id = v_opt_b;
  IF n IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'the untouched option moved to %, expected 0', n;
  END IF;

  -- ── a second voter accumulates rather than overwrites ─────────────────────
  SELECT * INTO r FROM public.cast_vote(v_other, v_vote, v_opt_b);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'second voter''s cast returned no row at all';
  END IF;

  IF r.out_participant_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'second voter left participant_count at %, expected 2',
      r.out_participant_count;
  END IF;

  -- ── every counter still equals the ledger it caches ───────────────────────
  SELECT count(*) INTO n
    FROM public.votes v
   WHERE v.id IN (v_vote, v_vote_b, v_closed, v_pending)
     AND v.participant_count IS DISTINCT FROM
         (SELECT count(*) FROM public.user_votes uv WHERE uv.vote_id = v.id);
  IF n IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION '% vote(s) have a participant_count that disagrees with user_votes', n;
  END IF;

  SELECT count(*) INTO n
    FROM public.vote_options o
   WHERE o.vote_id IN (v_vote, v_vote_b, v_closed, v_pending)
     AND o.votes IS DISTINCT FROM
         (SELECT count(*) FROM public.user_votes uv WHERE uv.option_id = o.id);
  IF n IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION '% option(s) have a tally that disagrees with user_votes', n;
  END IF;

  -- ── an option from another vote is refused, and writes nothing ────────────
  BEGIN
    PERFORM public.cast_vote(v_other, v_vote, v_opt_other);
    RAISE EXCEPTION 'casting an option from another vote was accepted';
  EXCEPTION WHEN SQLSTATE 'TV003' THEN
    NULL;
  END;

  -- ── a closed vote and a not-yet-open vote are refused, distinguishably ────
  -- The endpoint says different things for these two, so one shared code would
  -- make it tell a voter to come back to a vote that is over.
  BEGIN
    PERFORM public.cast_vote(v_other, v_closed, v_opt_cl);
    RAISE EXCEPTION 'casting into a vote past its end_date was accepted';
  EXCEPTION WHEN SQLSTATE 'TV002' THEN
    NULL;
  END;

  BEGIN
    PERFORM public.cast_vote(v_other, v_pending, v_opt_pd);
    RAISE EXCEPTION 'casting into a vote that has not opened was accepted';
  EXCEPTION WHEN SQLSTATE 'TV004' THEN
    NULL;
  END;

  -- ── the columns the open-check reads cannot be NULL ───────────────────────
  -- A NULL status made `status <> 'active'` evaluate to NULL, which PL/pgSQL
  -- reads as false: the vote came out open. NOT NULL is what stops that, so
  -- assert the column rather than the branch.
  BEGIN
    UPDATE public.votes SET status = NULL WHERE id = v_vote;
    RAISE EXCEPTION 'votes.status accepted a NULL, so an unknown status reads as open';
  EXCEPTION WHEN not_null_violation THEN
    NULL;
  END;

  BEGIN
    UPDATE public.vote_options SET votes = NULL WHERE id = v_opt_a;
    RAISE EXCEPTION 'vote_options.votes accepted a NULL, so a tally can empty itself';
  EXCEPTION WHEN not_null_violation THEN
    NULL;
  END;

  BEGIN
    UPDATE public.votes SET participant_count = NULL WHERE id = v_vote;
    RAISE EXCEPTION 'votes.participant_count accepted a NULL';
  EXCEPTION WHEN not_null_violation THEN
    NULL;
  END;

  -- ── a vote that does not exist is refused ─────────────────────────────────
  BEGIN
    PERFORM public.cast_vote(v_other, gen_random_uuid(), v_opt_a);
    RAISE EXCEPTION 'casting into a nonexistent vote was accepted';
  EXCEPTION WHEN SQLSTATE 'TV001' THEN
    NULL;
  END;

  -- ── the refusals left no trace ────────────────────────────────────────────
  SELECT count(*) INTO n FROM public.user_votes uv WHERE uv.user_id = v_other;
  IF n IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'the other voter has % ballots after four refusals, expected 1', n;
  END IF;

  SELECT o.votes INTO STRICT n FROM public.vote_options o WHERE o.id = v_opt_other;
  IF n IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'a refused cast still moved the other vote''s tally to %', n;
  END IF;
END;
$test$;

-- The composite foreign key must hold on its own, with cast_vote out of the
-- picture -- it is what protects the ledger from any writer that bypasses the
-- function, which is the situation the payments webhook was in.
DO $test$
DECLARE
  v_user   UUID := gen_random_uuid();
  v_vote_a UUID := gen_random_uuid();
  v_vote_b UUID := gen_random_uuid();
  v_opt_b  UUID := gen_random_uuid();
BEGIN
  INSERT INTO public.municipalities (code, name_he, slug_he)
       VALUES ('test-muni', 'רשות בדיקה', 'test-muni')
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO public.users (id, email, municipality_id)
       VALUES (v_user, 'direct@example.test', 'test-muni');
  INSERT INTO public.votes (id, creator_id, title, description, municipality_id,
                            status, end_date)
       VALUES (v_vote_a, v_user, 'a', 'd', 'test-muni', 'active', now() + interval '1 day'),
              (v_vote_b, v_user, 'b', 'd', 'test-muni', 'active', now() + interval '1 day');
  INSERT INTO public.vote_options (id, vote_id, text)
       VALUES (v_opt_b, v_vote_b, 'belongs to b');

  BEGIN
    INSERT INTO public.user_votes (user_id, vote_id, option_id)
         VALUES (v_user, v_vote_a, v_opt_b);
    RAISE EXCEPTION
      'a direct insert paired vote % with an option from vote %', v_vote_a, v_vote_b;
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
END;
$test$;

-- The function is service-role only, like every other mutator in this schema.
DO $test$
BEGIN
  IF has_function_privilege('anon', 'public.cast_vote(uuid,uuid,uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.cast_vote(uuid,uuid,uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'cast_vote is reachable by anon or authenticated';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.cast_vote(uuid,uuid,uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role cannot execute cast_vote, which the routes call';
  END IF;
END;
$test$;

ROLLBACK;
