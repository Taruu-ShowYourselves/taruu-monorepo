-- Vote card art — AI-generated duotone background plates for desk tiles.
--
-- Produced by the desk agents' `art` job (agents/knesset-ranker, Seedream
-- text-to-image via fal.ai): each active vote gets one two-colour risograph
-- plate in the press theme — black ink + pillarbox red on newsprint cream,
-- halftone — generated from the vote's description. The web app only reads
-- this table; desk tiles print the plate as a faded layer under the type.

CREATE TABLE IF NOT EXISTS vote_card_art (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vote_id      UUID NOT NULL UNIQUE REFERENCES votes(id) ON DELETE CASCADE,
  -- Public URL of the plate (Supabase Storage `vote-art` bucket). Null while
  -- the row only records a failed attempt.
  image_url    TEXT,
  -- The full prompt sent to the image model — the plate's audit trail.
  prompt       TEXT,
  model        TEXT,
  -- Work-queue semantics: every attempt stamps attempted_at, only a stored
  -- plate sets generated_at. Failed rows are retried once they go stale.
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vote_card_art_vote ON vote_card_art(vote_id);

ALTER TABLE vote_card_art ENABLE ROW LEVEL SECURITY;

-- Card art is public press furniture — readable by anyone.
DROP POLICY IF EXISTS "vote_card_art_public_read" ON vote_card_art;
CREATE POLICY "vote_card_art_public_read" ON vote_card_art
  FOR SELECT USING (true);

-- Writes go through the service role (art agent) only.

-- Public bucket the agent uploads plates into.
INSERT INTO storage.buckets (id, name, public)
VALUES ('vote-art', 'vote-art', true)
ON CONFLICT (id) DO NOTHING;
