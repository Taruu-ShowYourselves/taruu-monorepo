-- Restore the original discovery lifecycle without exposing half-assembled
-- ballots: discovery -> ingest -> pending during assembly -> active.
--
-- The application invokes this only for a vote it created in the current
-- request. This migration contains no data statement and does not touch the
-- existing pending backlog.
--
-- Rollback (application first, then database):
--   1. deploy the preceding application commit so no caller uses the RPC;
--   2. REVOKE ALL ON FUNCTION public.activate_ingest_vote(uuid, uuid)
--        FROM service_role;
--   3. DROP FUNCTION public.activate_ingest_vote(uuid, uuid);

CREATE OR REPLACE FUNCTION public.activate_ingest_vote(
  p_vote_id UUID,
  p_ingest_creator_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  activated_id UUID;
BEGIN
  UPDATE public.votes AS v
     SET status = 'active',
         updated_at = now()
   WHERE v.id = p_vote_id
     AND v.creator_id = p_ingest_creator_id
     AND v.status = 'pending'
     AND v.start_date <= now()
     AND v.hidden_at IS NULL
     AND v.flagged_at IS NULL
     AND EXISTS (
       SELECT 1
         FROM public.vote_sources AS source
        WHERE source.vote_id = v.id
          AND source.post_count >= 1
     )
     AND (
       SELECT count(*)
         FROM public.vote_options AS option
        WHERE option.vote_id = v.id
     ) >= 2
  RETURNING v.id INTO activated_id;

  IF activated_id IS NOT NULL THEN
    RETURN TRUE;
  END IF;

  -- A retry after a successful commit is a no-op success. Restrict this check
  -- to the same machine creator so the function never blesses a manual vote.
  RETURN EXISTS (
    SELECT 1
      FROM public.votes AS v
     WHERE v.id = p_vote_id
       AND v.creator_id = p_ingest_creator_id
       AND v.status = 'active'
       AND v.start_date <= now()
       AND v.hidden_at IS NULL
       AND v.flagged_at IS NULL
       AND EXISTS (
         SELECT 1
           FROM public.vote_sources AS source
          WHERE source.vote_id = v.id
            AND source.post_count >= 1
       )
       AND (
         SELECT count(*)
           FROM public.vote_options AS option
          WHERE option.vote_id = v.id
       ) >= 2
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.activate_ingest_vote(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_ingest_vote(UUID, UUID)
  TO service_role;

COMMENT ON FUNCTION public.activate_ingest_vote(UUID, UUID) IS
  'Idempotently activates one fully assembled pending discovery vote. Service-role only; no backlog scan or human-vote path.';
