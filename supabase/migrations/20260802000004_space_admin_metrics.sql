-- Aggregate-only metrics for one space. Modelled on public_council_metrics():
-- a fixed return type of scalars means a future private column on users or
-- payments cannot leak by widening a SELECT, and there is no shape here in
-- which a single resident could be returned.
--
-- The k-anonymity floor of 5 is applied HERE, not in TypeScript: the client
-- must never receive the true value for a bucket of 1-4.

CREATE OR REPLACE FUNCTION public.space_admin_metrics(space_uuid UUID)
RETURNS TABLE (
  registered_residents           BIGINT,
  registered_residents_status    TEXT,
  active_participants_30d        BIGINT,
  active_participants_30d_status TEXT,
  proposals_submitted            BIGINT,
  proposals_submitted_status     TEXT,
  participation_rate_pct         BIGINT,
  participation_rate_pct_status  TEXT,
  generated_at                   TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH s AS (
    SELECT sp.municipality_code
    FROM public.spaces sp
    WHERE sp.id = space_uuid AND sp.municipality_code IS NOT NULL
  ),
  raw AS (
    SELECT
      (SELECT count(*)
         FROM public.users u
         JOIN s ON u.municipality_id = s.municipality_code)                    AS residents,
      (SELECT count(DISTINCT uv.user_id)
         FROM public.user_votes uv
         JOIN public.votes v ON v.id = uv.vote_id
         JOIN s ON v.municipality_id = s.municipality_code
        WHERE uv.created_at > now() - interval '30 days')                      AS participants,
      (SELECT count(*)
         FROM public.votes v
         JOIN s ON v.municipality_id = s.municipality_code)                    AS proposals
  )
  SELECT
    CASE WHEN raw.residents BETWEEN 1 AND 4 THEN NULL ELSE raw.residents END,
    CASE WHEN raw.residents BETWEEN 1 AND 4 THEN 'suppressed' ELSE 'available' END,
    CASE WHEN raw.participants BETWEEN 1 AND 4 THEN NULL ELSE raw.participants END,
    CASE WHEN raw.participants BETWEEN 1 AND 4 THEN 'suppressed' ELSE 'available' END,
    -- Every vote in the municipality, review states included. This is an
    -- administrative figure, not the public one, and the route that reads it is
    -- already gated on a capability.
    raw.proposals,
    'available',
    -- A ratio is a disclosure channel for its own numerator: with the resident
    -- count published, rate x residents / 100 recovers the participant count
    -- almost exactly. So the rate is withheld when EITHER side of it is below
    -- the floor, not only when the denominator is.
    CASE WHEN raw.residents < 5 OR raw.participants BETWEEN 1 AND 4 THEN NULL
         ELSE round(100.0 * raw.participants / NULLIF(raw.residents, 0))::BIGINT END,
    -- 'unavailable' rather than 'suppressed' on purpose: the UI renders a
    -- suppressed figure as the literal `<5`, which reads as a headcount. On a
    -- percentage card that would be a different and false claim, so a rate we
    -- cannot publish is presented as one we could not compute.
    CASE WHEN raw.residents < 5 OR raw.participants BETWEEN 1 AND 4 THEN 'unavailable'
         ELSE 'available' END,
    now()
  FROM raw
  -- `raw` has no FROM clause, so it yields exactly one row of scalar subqueries
  -- whatever `s` contains. Without this guard a space_uuid matching no row --
  -- or a space with a NULL municipality_code -- would return
  -- `registered_residents: 0, status: 'available'`: a fabricated zero presented
  -- as a real figure, which is the one thing this function's status column
  -- exists to prevent. The EXISTS turns "no such space" into no row, which the
  -- caller maps to four `unavailable` figures.
  WHERE EXISTS (SELECT 1 FROM s);
$$;

REVOKE ALL ON FUNCTION public.space_admin_metrics(UUID) FROM PUBLIC;

-- Only the service role. Unlike the council RPC this is an administrative
-- surface, reached exclusively through a capability check in the application
-- layer, so no public-facing database role is given execute privilege here.
GRANT EXECUTE ON FUNCTION public.space_admin_metrics(UUID) TO service_role;

COMMENT ON FUNCTION public.space_admin_metrics(UUID) IS
  'Aggregate-only space metrics. Never returns user, payment, or identity rows. Buckets of 1-4 are suppressed in SQL so the true value never leaves the database, and the participation rate is withheld whenever either side of it is below the floor. A space that does not exist, or has no municipality_code, returns no row (the WHERE EXISTS guard) rather than a fabricated zero, and the caller renders every figure as unavailable.';
