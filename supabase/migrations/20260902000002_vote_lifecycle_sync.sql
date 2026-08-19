-- The vote lifecycle as a function of the clock, not of a job that must run.
--
-- `votes.status` has to track wall-clock time, but nothing moved it: no writer
-- opened a scheduled ballot when its start_date arrived, and none closed one
-- when its end_date passed. The column drifted in both directions at once -
-- 406 ballots sat 'pending' with an open window (invisible on 31 municipality
-- desks and unvotable, because /api/votes/[id]/participate requires 'active'),
-- while 4 sat 'active' with the window already elapsed.
--
-- This is deliberately NOT a second copy of `activate_ingest_vote`
-- (20260902000001). That function is the SYNCHRONOUS path: it opens one
-- discovery vote inside the ingest request that created it, and is bounded to
-- `created_at >= cutover` precisely because the rows predating the cutover had
-- no rule yet. This migration supplies that missing rule, for every origin -
-- discovery ingest and space-admin approval alike - and leaves the ingest
-- fast-path exactly as it is.
--
-- The predicate is shared, not duplicated: `vote_is_openable` states once what
-- makes a ballot fit to open, and the ingest RPC's gates are a superset of it
-- (it additionally demands a vote_source, which is a claim about discovery
-- provenance rather than about the ballot itself).

-- ---------------------------------------------------------------------------
-- What makes a ballot fit to open
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.vote_is_openable(p_vote_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
  SELECT v.hidden_at IS NULL
     AND v.flagged_at IS NULL
     AND v.start_date <= now()
     AND v.end_date   >  now()
     AND (
       SELECT count(DISTINCT btrim(o.text))
         FROM public.vote_options AS o
        WHERE o.vote_id = v.id
          AND btrim(o.text) <> ''
     ) >= 2
    FROM public.votes AS v
   WHERE v.id = p_vote_id;
$function$;

COMMENT ON FUNCTION public.vote_is_openable(UUID) IS
  'True when a ballot may legitimately be open right now: inside its own window, not moderated away, and holding at least two distinct choices. A ballot nobody can answer must never reach ''active'', whatever put it there.';

-- ---------------------------------------------------------------------------
-- The transitions themselves
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_vote_lifecycle()
RETURNS TABLE (opened INTEGER, closed INTEGER)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  n_opened INTEGER := 0;
  n_closed INTEGER := 0;
BEGIN
  -- Close first. A ballot whose window elapsed is a decision, and ordering it
  -- ahead of the open pass means one run can never open something it is about
  -- to close in the same breath.
  WITH shut AS (
    UPDATE public.votes AS v
       SET status = 'ended', updated_at = now()
     WHERE v.status IN ('pending', 'active')
       AND v.end_date <= now()
    RETURNING 1
  )
  SELECT count(*) INTO n_closed FROM shut;

  WITH opened_rows AS (
    UPDATE public.votes AS v
       SET status = 'active', updated_at = now()
     WHERE v.status = 'pending'
       AND public.vote_is_openable(v.id)
    RETURNING 1
  )
  SELECT count(*) INTO n_opened FROM opened_rows;

  RETURN QUERY SELECT n_opened, n_closed;
END;
$function$;

COMMENT ON FUNCTION public.sync_vote_lifecycle() IS
  'Advances every vote whose status has fallen behind the clock: opens scheduled ballots whose start_date has arrived and that are fit to open, closes any whose end_date has passed. Idempotent - a run with nothing due reports (0,0). Scheduled by pg_cron; also safe to call by hand after a backfill.';

REVOKE ALL ON FUNCTION public.sync_vote_lifecycle() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_vote_lifecycle() TO service_role;

-- ---------------------------------------------------------------------------
-- Who runs it
-- ---------------------------------------------------------------------------
--
-- pg_cron rather than a Cloudflare Cron Trigger: this account's cron gate
-- rejects a multi-schedule deploy (see the note in apps/web/wrangler.jsonc),
-- so only one Worker schedule is registered today and adding a second would
-- fail the whole deploy. The transition is a pure database concern with no
-- application step in it, so it belongs here regardless.

-- Conditional on the extension being installable, because pg_cron needs a
-- `shared_preload_libraries` entry - a stock `postgres:16` service container,
-- which is what .github/workflows/agent-verification.yml runs the migrations
-- against, cannot provide one at any price. Demanding it unconditionally would
-- fail CI over a property of the test harness rather than of this schema.
--
-- The skip is loud, never silent: everything above this block is the schema
-- contribution and runs everywhere, so an environment without pg_cron still
-- gets both functions and the backfill - it just has nothing calling them on a
-- timer, and says so.
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    RAISE NOTICE
      'pg_cron unavailable - sync_vote_lifecycle() installed but NOT scheduled. Schedule it wherever this database really runs.';
    RETURN;
  END IF;

  EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron';
  EXECUTE $sql$
    SELECT cron.unschedule('vote-lifecycle')
     WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'vote-lifecycle')
  $sql$;
  EXECUTE $sql$
    SELECT cron.schedule(
      'vote-lifecycle',
      '*/5 * * * *',
      'SELECT public.sync_vote_lifecycle()'
    )
  $sql$;
END
$do$;

-- ---------------------------------------------------------------------------
-- Backfill
-- ---------------------------------------------------------------------------
--
-- No separate one-time script: the backlog is exactly "what the job would have
-- done had it existed", so the first run IS the backfill.

SELECT public.sync_vote_lifecycle();
