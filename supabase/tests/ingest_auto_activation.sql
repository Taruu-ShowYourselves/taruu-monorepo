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
  repair_vote    UUID := uuid_generate_v4();
  candidate      UUID;
  written        INTEGER;
  option_rows    INTEGER;
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

  IF has_function_privilege('anon',
       'public.ensure_ingest_vote_options(uuid,uuid,timestamptz,text[])', 'EXECUTE')
     OR has_function_privilege('authenticated',
       'public.ensure_ingest_vote_options(uuid,uuid,timestamptz,text[])', 'EXECUTE')
     OR NOT has_function_privilege('service_role',
       'public.ensure_ingest_vote_options(uuid,uuid,timestamptz,text[])', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'ensure_ingest_vote_options ACL is not service-role only';
  END IF;

  -- The boolean-returning activation shape must not survive alongside the new
  -- one: a caller resolving to it would read `true` as "it is active now".
  IF EXISTS (
    SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'activate_ingest_vote'
       AND pg_catalog.format_type(p.prorettype, NULL) = 'boolean'
  ) THEN
    RAISE EXCEPTION 'the boolean-returning activation overload is still installed';
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
    (late_vote,     ingest_creator, 'fx-late-'     || late_vote,     'fx', town, 'pending', now(), now() + interval '14 days', now()),
    -- The poisoned row: vote written, options never were.
    (repair_vote,   ingest_creator, 'fx-repair-'   || repair_vote,   'fx', town, 'pending', now(), now() + interval '14 days', now());

  UPDATE public.votes SET hidden_at  = now() WHERE id = hidden_vote;
  UPDATE public.votes SET flagged_at = now() WHERE id = flagged_vote;

  -- ── assembly incomplete: no options, no source ───────────────────────────
  IF public.activate_ingest_vote(eligible_vote, ingest_creator, cutover) IS NOT NULL THEN
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
  IF public.activate_ingest_vote(eligible_vote, ingest_creator, cutover) IS NOT NULL THEN
    RAISE EXCEPTION 'activated without a source';
  END IF;

  INSERT INTO public.vote_sources (vote_id, post_count)
  SELECT v, 1 FROM (VALUES
    (eligible_vote),(human_vote),(future_vote),(expired_vote),(hidden_vote),
    (flagged_vote),(backlog_vote),(one_option),(dup_option),(blank_option),
    (late_vote),(repair_vote)
  ) AS f(v);

  -- ── the happy path ───────────────────────────────────────────────────────
  IF public.activate_ingest_vote(eligible_vote, ingest_creator, cutover) IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'a fully assembled eligible vote did not report active';
  END IF;
  IF (SELECT status FROM public.votes WHERE id = eligible_vote) <> 'active' THEN
    RAISE EXCEPTION 'activation reported success without writing active';
  END IF;

  -- ── repeated activation is a no-op success ───────────────────────────────
  IF public.activate_ingest_vote(eligible_vote, ingest_creator, cutover) IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'second activation call was not idempotent';
  END IF;

  -- ── late retry after the lifecycle legitimately advanced ─────────────────
  PERFORM public.activate_ingest_vote(late_vote, ingest_creator, cutover);
  UPDATE public.votes SET status = 'ended' WHERE id = late_vote;
  -- Succeeds, and says `ended` - not `active`. Reporting the latter would tell
  -- the caller a finished ballot had just been opened.
  IF public.activate_ingest_vote(late_vote, ingest_creator, cutover) IS DISTINCT FROM 'ended' THEN
    RAISE EXCEPTION 'a late retry on an ended vote did not report ended';
  END IF;
  UPDATE public.votes SET status = 'resolved' WHERE id = late_vote;
  IF public.activate_ingest_vote(late_vote, ingest_creator, cutover) IS DISTINCT FROM 'resolved' THEN
    RAISE EXCEPTION 'a late retry on a resolved vote did not report resolved';
  END IF;
  IF (SELECT status FROM public.votes WHERE id = late_vote) <> 'resolved' THEN
    RAISE EXCEPTION 'a late retry rewound an advanced lifecycle';
  END IF;


  -- ── the poisoned row repairs itself ──────────────────────────────────────
  -- A vote whose options never landed. Before ensure_ingest_vote_options
  -- existed, no later ingest run could add them: activation refused it on
  -- every retry, forever.
  IF public.activate_ingest_vote(repair_vote, ingest_creator, cutover) IS NOT NULL THEN
    RAISE EXCEPTION 'a vote with no options activated';
  END IF;

  -- Blank and duplicate texts normalize away; two distinct choices land.
  written := public.ensure_ingest_vote_options(
    repair_vote, ingest_creator, cutover, ARRAY['כן', '  כן  ', '', '   ', 'לא']
  );
  IF written <> 2 THEN
    RAISE EXCEPTION 'option repair wrote % rows, expected 2', written;
  END IF;

  IF public.activate_ingest_vote(repair_vote, ingest_creator, cutover) IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'the repaired vote did not activate';
  END IF;

  -- ── repair is idempotent: a second run adds nothing ──────────────────────
  UPDATE public.votes SET status = 'pending' WHERE id = repair_vote;
  written := public.ensure_ingest_vote_options(
    repair_vote, ingest_creator, cutover, ARRAY['כן', 'לא']
  );
  SELECT count(*) INTO option_rows FROM public.vote_options WHERE vote_id = repair_vote;
  IF written <> 0 OR option_rows <> 2 THEN
    RAISE EXCEPTION 'repeated repair wrote % rows, ballot now has % options', written, option_rows;
  END IF;
  UPDATE public.votes SET status = 'active' WHERE id = repair_vote;

  -- ── an open ballot is never altered underneath its voters ────────────────
  IF public.ensure_ingest_vote_options(
       repair_vote, ingest_creator, cutover, ARRAY['אולי', 'בהחלט']
     ) <> 0 THEN
    RAISE EXCEPTION 'options were added to an active ballot';
  END IF;

  -- ── a ballot that already offers a choice is never grown ─────────────────
  -- `no_source` is still pending and already carries two distinct options. A
  -- dedup hit whose request happens to carry different texts must leave that
  -- ballot exactly as the first attempt wrote it: repair exists to finish an
  -- unusable ballot, not to re-open a settled one.
  IF public.ensure_ingest_vote_options(
       no_source, ingest_creator, cutover, ARRAY['כן', 'לא', 'אולי']
     ) <> 0 THEN
    RAISE EXCEPTION 'repair grew a ballot that already had two distinct options';
  END IF;
  SELECT count(*) INTO option_rows FROM public.vote_options WHERE vote_id = no_source;
  IF option_rows <> 2 THEN
    RAISE EXCEPTION 'the assembled ballot now has % options', option_rows;
  END IF;

  -- The one-option ballot is unusable, so repair still completes it - the
  -- predicate is "fewer than two distinct choices", not "no rows at all".
  IF public.ensure_ingest_vote_options(
       one_option, ingest_creator, cutover, ARRAY['כן', 'לא']
     ) <> 1 THEN
    RAISE EXCEPTION 'repair did not complete a single-option ballot';
  END IF;
  DELETE FROM public.vote_options
   WHERE vote_id = one_option AND btrim(text) = 'לא';

  -- ── repair honours the same scoping as activation ────────────────────────
  IF public.ensure_ingest_vote_options(
       human_vote, ingest_creator, cutover, ARRAY['א', 'ב']
     ) <> 0 THEN
    RAISE EXCEPTION 'repair touched a vote owned by another creator';
  END IF;
  IF public.ensure_ingest_vote_options(
       backlog_vote, ingest_creator, cutover, ARRAY['א', 'ב']
     ) <> 0 THEN
    RAISE EXCEPTION 'repair reached a pre-cutover backlog row';
  END IF;
  IF public.ensure_ingest_vote_options(
       one_option, ingest_creator, cutover, NULL
     ) <> 0 THEN
    RAISE EXCEPTION 'a NULL text array produced a write';
  END IF;

  -- The single-option vote must still be single: repair adds only what it was
  -- asked for, and the ineligibility sweep below depends on that.
  SELECT count(*) INTO option_rows FROM public.vote_options WHERE vote_id = one_option;
  IF option_rows <> 1 THEN
    RAISE EXCEPTION 'the single-option fixture gained options';
  END IF;

  -- ── everything that must NOT activate ────────────────────────────────────
  ineligible := ARRAY[
    human_vote, future_vote, expired_vote, hidden_vote, flagged_vote,
    backlog_vote, one_option, dup_option, blank_option, no_source
  ];
  FOREACH candidate IN ARRAY ineligible LOOP
    IF public.activate_ingest_vote(candidate, ingest_creator, cutover) IS NOT NULL THEN
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
  IF public.activate_ingest_vote(NULL, ingest_creator, cutover) IS NOT NULL
     OR public.activate_ingest_vote(eligible_vote, NULL, cutover) IS NOT NULL
     OR public.activate_ingest_vote(eligible_vote, ingest_creator, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'a NULL argument produced a match';
  END IF;

  RAISE NOTICE 'ingest_auto_activation: all assertions passed';
END;
$test$;

ROLLBACK;
