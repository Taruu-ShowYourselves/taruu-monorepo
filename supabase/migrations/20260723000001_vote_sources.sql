-- Vote sources: the Facebook post(s) a consensus topic was discovered from.
-- Powers the hotness rate + engagement row on topic cards: comment count,
-- per-reaction tallies, and how many posts were consolidated into the topic.
-- One row per vote (consolidated across posts); discovery pipeline upserts.

CREATE TABLE IF NOT EXISTS vote_sources (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vote_id        UUID NOT NULL UNIQUE REFERENCES votes(id) ON DELETE CASCADE,
  -- Number of source posts consolidated into this topic (>= 1).
  post_count     INTEGER NOT NULL DEFAULT 1 CHECK (post_count >= 1),
  -- Total comments across the consolidated posts.
  comments_count INTEGER NOT NULL DEFAULT 0 CHECK (comments_count >= 0),
  -- Per-reaction tallies, e.g. {"like": 120, "love": 30, "haha": 4,
  -- "wow": 11, "sad": 2, "angry": 45}. Keys absent when zero.
  reactions      JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Public permalink of the (primary) source post, when shareable.
  source_url     TEXT,
  fetched_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vote_sources_vote ON vote_sources(vote_id);

ALTER TABLE vote_sources ENABLE ROW LEVEL SECURITY;

-- Engagement metrics are public press data — readable by anyone.
DROP POLICY IF EXISTS "vote_sources_public_read" ON vote_sources;
CREATE POLICY "vote_sources_public_read" ON vote_sources
  FOR SELECT USING (true);

-- Writes go through the service role (discovery pipeline / seeds) only.
