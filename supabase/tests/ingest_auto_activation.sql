-- Run after 20260818000002_ingest_auto_activation.sql on a disposable or
-- transaction-wrapped database. Every fixture is rolled back.

BEGIN;

DO $test$
DECLARE
  ingest_creator CONSTANT UUID := '99999999-9999-4999-8999-999999999999';
  human_creator UUID;
  machine_vote UUID := uuid_generate_v4();
  human_vote UUID := uuid_generate_v4();
  future_vote UUID := uuid_generate_v4();
  hidden_vote UUID := uuid_generate_v4();
  flagged_vote UUID := uuid_generate_v4();
  candidate UUID;
BEGIN
  IF has_function_privilege('anon', 'public.activate_ingest_vote(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.activate_ingest_vote(uuid,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.activate_ingest_vote(uuid,uuid)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'activate_ingest_vote ACL is not service-role only';
  END IF;

  SELECT id INTO human_creator
    FROM public.users
   WHERE id <> ingest_creator
   LIMIT 1;
  IF human_creator IS NULL THEN
    RAISE EXCEPTION 'fixture needs one non-ingest user';
  END IF;

  INSERT INTO public.votes
    (id, creator_id, title, description, municipality_id, status, start_date, end_date)
  VALUES
    (machine_vote, ingest_creator, 'rpc-machine-fixture-' || machine_vote, 'fixture', 'בת ים', 'pending', now(), now() + interval '1 day'),
    (human_vote, human_creator, 'rpc-human-fixture-' || human_vote, 'fixture', 'בת ים', 'pending', now(), now() + interval '1 day'),
    (future_vote, ingest_creator, 'rpc-future-fixture-' || future_vote, 'fixture', 'בת ים', 'pending', now() + interval '1 day', now() + interval '2 days'),
    (hidden_vote, ingest_creator, 'rpc-hidden-fixture-' || hidden_vote, 'fixture', 'בת ים', 'pending', now(), now() + interval '1 day'),
    (flagged_vote, ingest_creator, 'rpc-flagged-fixture-' || flagged_vote, 'fixture', 'בת ים', 'pending', now(), now() + interval '1 day');

  UPDATE public.votes SET hidden_at = now() WHERE id = hidden_vote;
  UPDATE public.votes SET flagged_at = now() WHERE id = flagged_vote;

  -- No options or source: assembly is incomplete.
  IF public.activate_ingest_vote(machine_vote, ingest_creator) THEN
    RAISE EXCEPTION 'machine vote activated without options/source';
  END IF;

  INSERT INTO public.vote_options (vote_id, text) VALUES
    (machine_vote, 'yes'), (machine_vote, 'no'),
    (human_vote, 'yes'), (human_vote, 'no'),
    (future_vote, 'yes'), (future_vote, 'no'),
    (hidden_vote, 'yes'), (hidden_vote, 'no'),
    (flagged_vote, 'yes'), (flagged_vote, 'no');

  -- Options alone are not enough.
  IF public.activate_ingest_vote(machine_vote, ingest_creator) THEN
    RAISE EXCEPTION 'machine vote activated without a source';
  END IF;

  INSERT INTO public.vote_sources (vote_id, post_count) VALUES
    (machine_vote, 1), (human_vote, 1), (future_vote, 1),
    (hidden_vote, 1), (flagged_vote, 1);

  IF NOT public.activate_ingest_vote(machine_vote, ingest_creator) THEN
    RAISE EXCEPTION 'eligible machine vote did not activate';
  END IF;
  IF NOT public.activate_ingest_vote(machine_vote, ingest_creator) THEN
    RAISE EXCEPTION 'second call was not idempotent';
  END IF;

  FOREACH candidate IN ARRAY ARRAY[human_vote, future_vote, hidden_vote, flagged_vote]
  LOOP
    IF public.activate_ingest_vote(candidate, ingest_creator) THEN
      RAISE EXCEPTION 'ineligible vote % activated', candidate;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.votes
     WHERE id IN (human_vote, future_vote, hidden_vote, flagged_vote)
       AND status <> 'pending'
  ) THEN
    RAISE EXCEPTION 'an ineligible/manual vote changed status';
  END IF;
END;
$test$;

ROLLBACK;
