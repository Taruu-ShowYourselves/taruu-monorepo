-- Restore the original discovery lifecycle without exposing half-assembled
-- ballots: discovery -> ingest -> pending during assembly -> active.
--
-- Version note: this file sorts ABOVE 20260901000003_security_score, the
-- highest version already applied to production. An ingest-lifecycle migration
-- numbered into an already-applied range is a migration the ledger can silently
-- skip, so the version is deliberately later than every applied row.
--
-- The application invokes this for any vote it created OR adopted in the
-- current request, provided that vote was created at/after the cutover the
-- caller passes. This migration contains no data statement: the pre-cutover
-- pending backlog is out of reach of this function by construction, not by
-- application-side restraint.
--
-- Rollback (application first, then database):
--   1. deploy the preceding application commit so no caller uses the RPC;
--   2. REVOKE ALL ON FUNCTION ... FROM service_role for both
--        public.activate_ingest_vote(uuid, uuid, timestamptz) and
--        public.ensure_ingest_vote_options(uuid, uuid, timestamptz, text[]);
--   3. DROP both functions.

-- The two-argument shape from the first revision of this change carried no
-- cutover bound, so leaving it installed anywhere would leave a strictly more
-- permissive overload reachable under the same name.
DROP FUNCTION IF EXISTS public.activate_ingest_vote(uuid, uuid);
-- The boolean-returning shape of the three-argument form, replaced by one that
-- reports the resulting status.
DROP FUNCTION IF EXISTS public.activate_ingest_vote(uuid, uuid, timestamptz);

-- Repair the option set of a vote still being assembled.
--
-- `createVoteOptions` used to run only when the ingest request itself inserted
-- the vote. A first attempt that landed the vote row and then failed writing
-- its options left a `pending` vote with no ballot, and every retry deduped
-- onto that row, skipped option creation, and was refused by
-- `activate_ingest_vote` forever - wedging the whole batch behind it. Ensuring
-- the options is therefore a step of its own, run on every path.
--
-- Idempotent by construction: it inserts only the texts not already present.
-- `FOR UPDATE` on the vote row serialises two ingest runs that both find the
-- set missing, which is what stops a concurrent duplicate ingest from writing
-- the ballot twice. Restricted to `pending` so an open ballot can never have
-- choices added underneath the residents already voting on it, and to ballots
-- that are still UNUSABLE - fewer than two distinct non-blank choices - so a
-- later request carrying different texts repairs nothing it should not: a
-- ballot that already offers a real choice is finished, not broken.
CREATE OR REPLACE FUNCTION public.ensure_ingest_vote_options(
  p_vote_id UUID,
  p_ingest_creator_id UUID,
  p_min_created_at TIMESTAMPTZ,
  p_texts TEXT[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  locked_id UUID;
  usable_options INTEGER := 0;
  inserted INTEGER := 0;
BEGIN
  IF p_vote_id IS NULL OR p_ingest_creator_id IS NULL
     OR p_min_created_at IS NULL OR p_texts IS NULL THEN
    RETURN 0;
  END IF;

  SELECT v.id INTO locked_id
    FROM public.votes AS v
   WHERE v.id = p_vote_id
     AND v.creator_id = p_ingest_creator_id
     AND v.created_at >= p_min_created_at
     AND v.status = 'pending'
     FOR UPDATE;

  -- Not ours, not current, or no longer being assembled: nothing to repair.
  IF locked_id IS NULL THEN
    RETURN 0;
  END IF;

  -- The same count `activate_ingest_vote` uses to decide a ballot is votable.
  -- Once it is reached the option set is the one the first attempt wrote, and
  -- a dedup hit whose payload happens to differ must not append to it - the
  -- documented rule is that a repeat ingest refreshes engagement only. Below
  -- it the ballot is unusable, which is the state this repair exists for.
  SELECT count(DISTINCT btrim(option.text)) INTO usable_options
    FROM public.vote_options AS option
   WHERE option.vote_id = locked_id
     AND btrim(option.text) <> '';

  IF usable_options >= 2 THEN
    RETURN 0;
  END IF;

  WITH wanted AS (
    SELECT DISTINCT btrim(candidate) AS text
      FROM unnest(p_texts) AS candidate
     WHERE btrim(candidate) <> ''
  ),
  missing AS (
    SELECT wanted.text
      FROM wanted
     WHERE NOT EXISTS (
       SELECT 1
         FROM public.vote_options AS option
        WHERE option.vote_id = locked_id
          AND btrim(option.text) = wanted.text
     )
  ),
  written AS (
    INSERT INTO public.vote_options (vote_id, text)
    SELECT locked_id, missing.text FROM missing
    RETURNING 1
  )
  SELECT count(*) INTO inserted FROM written;

  RETURN inserted;
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_ingest_vote_options(UUID, UUID, TIMESTAMPTZ, TEXT[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_ingest_vote_options(UUID, UUID, TIMESTAMPTZ, TEXT[])
  TO service_role;

COMMENT ON FUNCTION public.ensure_ingest_vote_options(UUID, UUID, TIMESTAMPTZ, TEXT[]) IS
  'Idempotently completes the ballot of one pending discovery vote created at or after the caller''s cutover, and only while that ballot still holds fewer than two distinct choices. Service-role only; never touches an open or already-votable ballot.';

CREATE OR REPLACE FUNCTION public.activate_ingest_vote(
  p_vote_id UUID,
  p_ingest_creator_id UUID,
  p_min_created_at TIMESTAMPTZ
)
-- Returns the row's status AFTER the call, or NULL when this vote is not one
-- the caller may publish. A boolean could not tell "I just activated it" from
-- "it had already moved on to `ended`", which made the API answer `active` for
-- a row the database knew was finished.
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  activated_status TEXT;
  advanced_status TEXT;
BEGIN
  -- A NULL argument must never widen the match: `col = NULL` is NULL, not
  -- false, only because every predicate below is ANDed - state that here
  -- rather than relying on it.
  IF p_vote_id IS NULL OR p_ingest_creator_id IS NULL OR p_min_created_at IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.votes AS v
     SET status = 'active',
         updated_at = now()
   WHERE v.id = p_vote_id
     AND v.creator_id = p_ingest_creator_id
     -- The cutover bound. Without it a dedup hit against the pre-existing
     -- pending backlog would publish rows this change is not allowed to touch.
     AND v.created_at >= p_min_created_at
     AND v.status = 'pending'
     AND v.start_date <= now()
     -- A ballot whose window already closed must never be opened.
     AND v.end_date > now()
     AND v.hidden_at IS NULL
     AND v.flagged_at IS NULL
     AND EXISTS (
       SELECT 1
         FROM public.vote_sources AS source
        WHERE source.vote_id = v.id
          AND source.post_count >= 1
     )
     -- DISTINCT over trimmed, non-blank text: two rows holding the same word,
     -- or a blank one, are not two things a resident can choose between.
     AND (
       SELECT count(DISTINCT btrim(option.text))
         FROM public.vote_options AS option
        WHERE option.vote_id = v.id
          AND btrim(option.text) <> ''
     ) >= 2
  RETURNING v.status::text INTO activated_status;

  IF activated_status IS NOT NULL THEN
    RETURN activated_status;
  END IF;

  -- Idempotent, and safe for a LATE retry. Once the row has left `pending`
  -- forward it has completed the transition this function exists to make, and
  -- saying otherwise would report a successful lifecycle as an ingest failure.
  -- Deliberately no end_date/moderation predicate here: an ended or hidden
  -- vote still left `pending` forward. Creator and cutover still bind, so this
  -- branch can never bless a manual vote or a backlog row.
  SELECT v.status::text INTO advanced_status
    FROM public.votes AS v
   WHERE v.id = p_vote_id
     AND v.creator_id = p_ingest_creator_id
     AND v.created_at >= p_min_created_at
     AND v.status IN ('active', 'ended', 'resolving', 'resolved', 'failed');

  RETURN advanced_status;
END;
$function$;

REVOKE ALL ON FUNCTION public.activate_ingest_vote(UUID, UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_ingest_vote(UUID, UUID, TIMESTAMPTZ)
  TO service_role;

COMMENT ON FUNCTION public.activate_ingest_vote(UUID, UUID, TIMESTAMPTZ) IS
  'Idempotently activates one fully assembled pending discovery vote created at or after the caller''s cutover. Service-role only; no backlog scan, no human-vote path.';
