-- Knesset ranker output — editorial hotness per national vote.
--
-- Produced by agents/knesset-ranker (Claude Agent SDK, runs off-platform with
-- Claude Code credentials): each active Knesset vote is scored for how
-- relevant and pressing it is to the Israeli public and how much media
-- coverage it currently draws. The web app only reads this table — the
-- Knesset desk orders its topics by hotness.

CREATE TABLE IF NOT EXISTS knesset_rankings (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vote_id    UUID NOT NULL UNIQUE REFERENCES votes(id) ON DELETE CASCADE,
  -- Combined editorial heat, 0 (routine) to 100 (front page).
  hotness    INTEGER NOT NULL CHECK (hotness BETWEEN 0 AND 100),
  -- Sub-scores behind the combined figure.
  relevance  INTEGER CHECK (relevance BETWEEN 0 AND 100),
  media      INTEGER CHECK (media BETWEEN 0 AND 100),
  -- One-sentence Hebrew editorial rationale.
  rationale  TEXT,
  -- Press-coverage URLs the ranker saw, JSON array of strings.
  media_refs JSONB NOT NULL DEFAULT '[]',
  model      TEXT,
  ranked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knesset_rankings_vote ON knesset_rankings(vote_id);

ALTER TABLE knesset_rankings ENABLE ROW LEVEL SECURITY;

-- Editorial ranking is public press data — readable by anyone.
DROP POLICY IF EXISTS "knesset_rankings_public_read" ON knesset_rankings;
CREATE POLICY "knesset_rankings_public_read" ON knesset_rankings
  FOR SELECT USING (true);

-- Writes go through the service role (ranker agent) only.
