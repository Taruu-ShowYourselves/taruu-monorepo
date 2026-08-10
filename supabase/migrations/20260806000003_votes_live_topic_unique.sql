-- One live ballot per (municipality, title).
--
-- The desk printed the same Bat Yam topic four times because the ingest dedup
-- lookup (`findVoteByMunicipalityAndTitle`) filters on a status window that
-- names the review labels added in 20260802000011. That migration had not been
-- applied to the deployed database, so every lookup came back 22P02, the
-- reader degraded the error to `null`, and POST /api/ingest/topics read "no
-- such vote" and inserted a fresh copy of the whole batch on every run: 98
-- topics duplicated, 184 surplus rows, some four deep.
--
-- The reader now throws instead of returning null, but application-level
-- dedup is a read-then-write with no lock: two ingest runs overlapping, or one
-- retried mid-flight, can still both see nothing and both insert. This index
-- is the structural half of the fix.
--
-- The window is deliberately identical to the lookup's. It must not be wider:
-- a status the lookup ignores but the index covers would let a legal insert
-- fail on a row the caller was never shown. Ended, resolving, resolved and
-- failed ballots stay outside it, so a seasonal topic may be raised again once
-- its predecessor has closed.

-- Clear the accumulated duplicates first: keep the earliest copy of every live
-- (municipality, title), and touch only copies nobody has voted on. A surplus
-- row carrying ballots is left in place on purpose - the index creation below
-- will then fail, which is the correct outcome. Merging real ballots is an
-- editorial decision, not something a migration may take.
WITH live AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY municipality_id, title
      ORDER BY created_at, id
    ) AS copy
  FROM public.votes
  WHERE status IN (
    'draft', 'in_review', 'changes_requested', 'rejected', 'pending', 'active'
  )
)
DELETE FROM public.votes v
USING live
WHERE v.id = live.id
  AND live.copy > 1
  AND COALESCE(v.participant_count, 0) = 0
  AND NOT EXISTS (SELECT 1 FROM public.user_votes uv WHERE uv.vote_id = v.id)
  AND NOT EXISTS (
    SELECT 1 FROM public.vote_options o WHERE o.vote_id = v.id AND o.votes > 0
  );

CREATE UNIQUE INDEX ux_votes_live_topic
  ON public.votes (municipality_id, title)
  WHERE status IN (
    'draft', 'in_review', 'changes_requested', 'rejected', 'pending', 'active'
  );

COMMENT ON INDEX ux_votes_live_topic IS
  'One open ballot per (municipality, title). Window mirrors the ingest dedup lookup in lib/supabase/db.ts; widening it here without widening the lookup turns a legal proposal into a 23505.';
