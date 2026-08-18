-- The first reviewer of the machine feed.
--
-- `POST /api/ingest/topics` now files discovery-fleet topics as `in_review`
-- (see docs/INGEST.md). That queue is only a queue if somebody can open it, and
-- `space_capability_grants` has been empty since the governance tables shipped:
-- zero grants, zero platform admins, zero decisions ever taken. This migration
-- is the bootstrap `.planning/phases/05-.../05-RESEARCH.md` §3 said would be
-- needed, written down instead of typed into a psql prompt at 2am -- which is
-- how the 267 votes activated on 2026-08-10 got activated, and why nobody can
-- now say by whom or under what rule.
--
-- WHAT IT GRANTS: three capabilities out of eleven.
--
--   proposal.read     -- open the queue and read a proposal's detail panel
--   proposal.approve  -- publish it
--   proposal.reject   -- decline it, or return it for changes
--
-- and nothing else. No member.suspend, no grant.create, no content.moderate,
-- no notification.send, no audit.read, no metrics.read. An editorial reviewer
-- decides what gets printed; they are not a space administrator.
--
-- WHERE IT GRANTS: every municipality space that has actually received a
-- machine-written topic. Not all 260 -- a space with no machine content has no
-- editorial queue, so a grant there would be power with no purpose. The set is
-- computed, not listed, so re-running this after the fleet reaches new towns
-- extends the reviewer to exactly those towns and no others.
--
-- WHO IT GRANTS TO: one existing account, resolved by email. This deliberately
-- does not create a user. If the account is missing the migration fails loudly
-- rather than silently granting nothing -- an empty queue and an unpermitted
-- reviewer look identical from the outside, and that ambiguity is what a
-- bootstrap must not leave behind.
--
-- REVERSIBLE: suspension, not deletion. See the block at the foot of this file.
--   UPDATE public.space_capability_grants
--      SET suspended_at = now(), suspended_by = <actor>
--    WHERE granted_via_role = 'editorial_reviewer_bootstrap'
--      AND suspended_at IS NULL;
-- `authorize()` reads `suspended_at IS NULL` on every request with no caching,
-- so revocation takes effect on the next click, and the grant history survives.

DO $$
DECLARE
  reviewer_email CONSTANT TEXT := 'dolevseren33@gmail.com';
  reviewer_id    UUID;
  ingest_creator CONSTANT UUID := '99999999-9999-4999-8999-999999999999';
  granted        INTEGER;
BEGIN
  SELECT id INTO reviewer_id FROM public.users WHERE email = reviewer_email;

  IF reviewer_id IS NULL THEN
    RAISE EXCEPTION
      'editorial reviewer bootstrap: no user with email %. Create the account first; this migration never creates one.',
      reviewer_email;
  END IF;

  INSERT INTO public.space_capability_grants
    (space_id, user_id, capability, granted_via_role, granted_by)
  SELECT s.id,
         reviewer_id,
         c.capability,
         'editorial_reviewer_bootstrap',
         -- Self-granted, and the row says so. There is no prior grant holder to
         -- attribute this to: it is the first grant in the table's life.
         reviewer_id
  FROM public.spaces s
  CROSS JOIN (VALUES
      ('proposal.read'),
      ('proposal.approve'),
      ('proposal.reject')
    ) AS c(capability)
  WHERE s.type = 'municipality'
    -- authorize() refuses to mint a scope without a scoping key, so a space
    -- with no municipality_code could never be used even if granted.
    AND s.municipality_code IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.votes v
      WHERE v.municipality_id = s.municipality_code
        AND v.creator_id = ingest_creator
    )
  -- Matches uq_active_grant. Re-running is a no-op for spaces already covered,
  -- which is what makes "run it again when the fleet reaches new towns" safe.
  ON CONFLICT (space_id, user_id, capability)
    WHERE suspended_at IS NULL
    DO NOTHING;

  GET DIAGNOSTICS granted = ROW_COUNT;
  RAISE NOTICE 'editorial reviewer bootstrap: % new grant(s) for %', granted, reviewer_email;
END $$;

COMMENT ON TABLE public.space_capability_grants IS
  'Object-level authorization for space-admin surfaces. RLS cannot secure these reads (every server query runs as the service role), so authorize() resolves a grant per request with no caching -- suspension therefore takes effect on the next request. granted_via_role is provenance only and is never consulted at authorization time. The editorial reviewer bootstrap (20260818000001) is the first population of this table.';
