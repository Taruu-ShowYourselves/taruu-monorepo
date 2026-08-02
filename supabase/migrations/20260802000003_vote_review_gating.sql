-- Everything that USES the review labels added in 20260802000002, plus the
-- moderation columns the proposal detail panel acts on.
--
-- No backfill: every existing votes row already holds pending|active|ended|
-- resolving|resolved|failed, all of which mean "already past review".
-- "Default existing rows to approved" is satisfied by leaving history alone.

CREATE INDEX idx_votes_review_queue
  ON public.votes (municipality_id, created_at DESC)
  WHERE status IN ('draft', 'in_review', 'changes_requested');

ALTER TABLE public.votes
  ADD COLUMN hidden_at   TIMESTAMPTZ,
  ADD COLUMN hidden_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN flagged_at  TIMESTAMPTZ,
  ADD COLUMN flagged_by  UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX idx_votes_moderated ON public.votes (municipality_id)
  WHERE hidden_at IS NOT NULL OR flagged_at IS NOT NULL;

COMMENT ON COLUMN public.votes.hidden_at IS
  'Set by a space admin holding content.moderate. A hidden vote is excluded from public read paths; the proposal itself stays in the review queue.';

-- Deliberately NOT changing the column default. Both writers set status
-- explicitly (server/app/votes/create-vote.ts via initialStatus, and
-- app/api/ingest/topics/route.ts with 'pending'); moving the DB default would
-- silently rewire the ingest path. Change initialStatus() instead.
