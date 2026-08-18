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
--   2. REVOKE ALL ON FUNCTION
--        public.activate_ingest_vote(uuid, uuid, timestamptz) FROM service_role;
--   3. DROP FUNCTION public.activate_ingest_vote(uuid, uuid, timestamptz);

-- The two-argument shape from the first revision of this change carried no
-- cutover bound, so leaving it installed anywhere would leave a strictly more
-- permissive overload reachable under the same name.
DROP FUNCTION IF EXISTS public.activate_ingest_vote(uuid, uuid);

CREATE OR REPLACE FUNCTION public.activate_ingest_vote(
  p_vote_id UUID,
  p_ingest_creator_id UUID,
  p_min_created_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  activated_id UUID;
BEGIN
  -- A NULL argument must never widen the match: `col = NULL` is NULL, not
  -- false, only because every predicate below is ANDed - state that here
  -- rather than relying on it.
  IF p_vote_id IS NULL OR p_ingest_creator_id IS NULL OR p_min_created_at IS NULL THEN
    RETURN FALSE;
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
  RETURNING v.id INTO activated_id;

  IF activated_id IS NOT NULL THEN
    RETURN TRUE;
  END IF;

  -- Idempotent, and safe for a LATE retry. Once the row has left `pending`
  -- forward it has completed the transition this function exists to make, and
  -- saying otherwise would report a successful lifecycle as an ingest failure.
  -- Deliberately no end_date/moderation predicate here: an ended or hidden
  -- vote still left `pending` forward. Creator and cutover still bind, so this
  -- branch can never bless a manual vote or a backlog row.
  RETURN EXISTS (
    SELECT 1
      FROM public.votes AS v
     WHERE v.id = p_vote_id
       AND v.creator_id = p_ingest_creator_id
       AND v.created_at >= p_min_created_at
       AND v.status IN ('active', 'ended', 'resolving', 'resolved', 'failed')
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.activate_ingest_vote(UUID, UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_ingest_vote(UUID, UUID, TIMESTAMPTZ)
  TO service_role;

COMMENT ON FUNCTION public.activate_ingest_vote(UUID, UUID, TIMESTAMPTZ) IS
  'Idempotently activates one fully assembled pending discovery vote created at or after the caller''s cutover. Service-role only; no backlog scan, no human-vote path.';
