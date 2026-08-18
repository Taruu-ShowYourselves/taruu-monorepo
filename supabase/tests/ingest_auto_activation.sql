-- Behavioural contract for public.activate_ingest_vote.
--
-- Run after the migration set, against a disposable database. Every fixture is
-- created and rolled back inside one transaction, so the file is safe to
-- re-run and leaves nothing behind. `scripts/db-test.sh` drives it in CI.

BEGIN;

DO $test$
DECLARE
  ingest_creator CONSTANT UUID := '99999999-9999-4999-8999-999999999999';
  human_creator  CONSTANT UUID := '11111111-1111-4111-8111-111111111111';
  town           TEXT;
  cutover        CONSTANT TIMESTAMPTZ := now() - interval '1 hour';
  -- Every fixture below is created AFTER the cutover except `backlog_vote`.
  eligible_vote  UUID := uuid_generate_v4();
  human_vote     UUID := uuid_generate_v4();
  future_vote    UUID := uuid_generate_v4();
  expired_vote   UUID := uuid_generate_v4();
  hidden_vote    UUID := uuid_generate_v4();
  flagged_vote   UUID := uuid_generate_v4();
  backlog_vote   UUID := uuid_generate_v4();
  one_option     UUID := uuid_generate_v4();
  dup_option     UUID := uuid_generate_v4();
  blank_option   UUID := uuid_generate_v4();
  no_source      UUID := uuid_generate_v4();
  late_vote      UUID := uuid_generate_v4();
  candidate      UUID;
  ineligible     UUID[];
BEGIN
  -- ── ACL: service role only ────────────────────────────────────────────────
  IF has_function_privilege('anon',
       'public.activate_ingest_vote(uuid,uuid,timestamptz)', 'EXECUTE')
     OR has_function_privilege('authenticated',
       'public.activate_ingest_vote(uuid,uuid,timestamptz)', 'EXECUTE')
     OR NOT has_function_privilege('service_role',
       'public.activate_ingest_vote(uuid,uuid,timestamptz)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'activate_ingest_vote ACL is not service-role only';
  END IF;

  -- The permissive two-argument shape must not survive anywhere.
  IF EXISTS (
    SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'activate_ingest_vote'
       AND p.pronargs = 2
  ) THEN
    RAISE EXCEPTION 'the cutover-less 2-arg overload is still installed';
  END IF;

  SELECT code INTO town FROM public.municipalities LIMIT 1;
  INSERT INTO public.users (id, email) VALUES
    (ingest_creator, 'ingest-fixture@example.invalid'),
    (human_creator,  'human-fixture@example.invalid')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.votes
    (id, creator_id, title, description, municipality_id, status, start_date, end_date, created_at)
  VALUES
    (eligible_vote, ingest_creator, 'fx-eligible-' || eligible_vote, 'fx', town, 'pending', now(), now() + interval '14 days', now()),
    (human_vote,    human_creator,  'fx-human-'    || human_vote,    'fx', town, 'pending', now(), now() + interval '14 days', now()),
    (future_vote,   ingest_creator, 'fx-future-'   || future_vote,   'fx', town, 'pending', now() + interval '1 day', now() + interval '9 days', now()),
    (expired_vote,  ingest_creator, 'fx-expired-'  || expired_vote,  'fx', town, 'pending', now() - interval '9 days', now() - interval '1 hour', now()),
    (hidden_vote,   ingest_creator, 'fx-hidden-'   || hidden_vote,   'fx', town, 'pending', now(), now() + interval '14 days', now()),
    (flagged_vote,  ingest_creator, 'fx-flagged-'  || flagged_vote,  'fx', town, 'pending', now(), now() + interval '14 days', now()),
    -- Created BEFORE the cutover: the pre-existing pending backlog.
    (backlog_vote,  ingest_creator, 'fx-backlog-'  || backlog_vote,  'fx', town, 'pending', now(), now() + interval '14 days', cutover - interval '1 day'),
    (one_option,    ingest_creator, 'fx-oneopt-'   || one_option,    'fx', town, 'pending', now(), now() + interval '14 days', now()),
    (dup_option,    ingest_creator, 'fx-dupopt-'   || dup_option,    'fx', town, 'pending', now(), now() + interval '14 days', now()),
    (blank_option,  ingest_creator, 'fx-blankopt-' || blank_option,  'fx', town, 'pending', now(), now() + interval '14 days', now()),
    (no_source,     ingest_creator, 'fx-nosource-' || no_source,     'fx', town, 'pending', now(), now() + interval '14 days', now()),
    (late_vote,     ingest_creator, 'fx-late-'     || late_vote,     'fx', town, 'pending', now(), now() + interval '14 days', now());

  UPDATE public.votes SET hidden_at  = now() WHERE id = hidden_vote;
  UPDATE public.votes SET flagged_at = now() WHERE id = flagged_vote;

  -- ── assembly incomplete: no options, no source ───────────────────────────
  IF public.activate_ingest_vote(eligible_vote, ingest_creator, cutover) THEN
    RAISE EXCEPTION 'activated with neither options nor source';
  END IF;

  INSERT INTO public.vote_options (vote_id, text)
  SELECT v, t FROM (VALUES
    (eligible_vote,'כן'),(eligible_vote,'לא'),
    (human_vote,'כן'),(human_vote,'לא'),
    (future_vote,'כן'),(future_vote,'לא'),
    (expired_vote,'כן'),(expired_vote,'לא'),
    (hidden_vote,'כן'),(hidden_vote,'לא'),
    (flagged_vote,'כן'),(flagged_vote,'לא'),
    (backlog_vote,'כן'),(backlog_vote,'לא'),
    (no_source,'כן'),(no_source,'לא'),
    (late_vote,'כן'),(late_vote,'לא'),
    -- structurally unusable ballots
    (one_option,'כן'),
    (dup_option,'כן'),(dup_option,'  כן  '),
    (blank_option,'כן'),(blank_option,'   ')
  ) AS f(v,t);

  -- ── options alone are not enough ─────────────────────────────────────────
  IF public.activate_ingest_vote(eligible_vote, ingest_creator, cutover) THEN
    RAISE EXCEPTION 'activated without a source';
  END IF;

  INSERT INTO public.vote_sources (vote_id, post_count)
  SELECT v, 1 FROM (VALUES
    (eligible_vote),(human_vote),(future_vote),(expired_vote),(hidden_vote),
    (flagged_vote),(backlog_vote),(one_option),(dup_option),(blank_option),(late_vote)
  ) AS f(v);

  -- ── the happy path ───────────────────────────────────────────────────────
  IF NOT public.activate_ingest_vote(eligible_vote, ingest_creator, cutover) THEN
    RAISE EXCEPTION 'a fully assembled eligible vote did not activate';
  END IF;
  IF (SELECT status FROM public.votes WHERE id = eligible_vote) <> 'active' THEN
    RAISE EXCEPTION 'activation reported success without writing active';
  END IF;

  -- ── repeated activation is a no-op success ───────────────────────────────
  IF NOT public.activate_ingest_vote(eligible_vote, ingest_creator, cutover) THEN
    RAISE EXCEPTION 'second activation call was not idempotent';
  END IF;

  -- ── late retry after the lifecycle legitimately advanced ─────────────────
  PERFORM public.activate_ingest_vote(late_vote, ingest_creator, cutover);
  UPDATE public.votes SET status = 'ended' WHERE id = late_vote;
  IF NOT public.activate_ingest_vote(late_vote, ingest_creator, cutover) THEN
    RAISE EXCEPTION 'a late retry on an ended vote reported a false failure';
  END IF;
  UPDATE public.votes SET status = 'resolved' WHERE id = late_vote;
  IF NOT public.activate_ingest_vote(late_vote, ingest_creator, cutover) THEN
    RAISE EXCEPTION 'a late retry on a resolved vote reported a false failure';
  END IF;
  IF (SELECT status FROM public.votes WHERE id = late_vote) <> 'resolved' THEN
    RAISE EXCEPTION 'a late retry rewound an advanced lifecycle';
  END IF;

  -- ── everything that must NOT activate ────────────────────────────────────
  ineligible := ARRAY[
    human_vote, future_vote, expired_vote, hidden_vote, flagged_vote,
    backlog_vote, one_option, dup_option, blank_option, no_source
  ];
  FOREACH candidate IN ARRAY ineligible LOOP
    IF public.activate_ingest_vote(candidate, ingest_creator, cutover) THEN
      RAISE EXCEPTION 'ineligible vote % activated', candidate;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.votes
     WHERE id = ANY (ineligible) AND status <> 'pending'
  ) THEN
    RAISE EXCEPTION 'an ineligible vote changed status';
  END IF;

  -- ── NULL arguments never widen the match ─────────────────────────────────
  IF public.activate_ingest_vote(NULL, ingest_creator, cutover)
     OR public.activate_ingest_vote(eligible_vote, NULL, cutover)
     OR public.activate_ingest_vote(eligible_vote, ingest_creator, NULL) THEN
    RAISE EXCEPTION 'a NULL argument produced a match';
  END IF;

  RAISE NOTICE 'ingest_auto_activation: all assertions passed';
END;
$test$;

ROLLBACK;
