-- Topics set aside — the desk's third gesture, given somewhere to land.
--
-- Sliding a tile down means "this is not a matter of consensus". Until now
-- that went to localStorage and nowhere else: the reader's own copy of the
-- edition dropped the topic and the desk was never told. The tile said so
-- rather than pretending otherwise, which was the honest interim, but it made
-- the gesture the only one of the three that does not exist as far as the
-- platform is concerned.
--
-- Deliberately NOT a ballot:
--
--   * it costs no points and touches no treasury,
--   * it never enters a tally, so it cannot move a result,
--   * it carries no GPS and no blockchain record.
--
-- It is a claim about whether a question belongs on the desk, not an answer to
-- the question. Storing it in vote_participants would make it one, and every
-- count that reads that table would silently start including opinions that
-- were never cast as votes.
--
-- One row per reader per topic: setting a topic aside twice is the same
-- statement made twice, and amending the reason replaces it rather than
-- stacking. Retraction is a real delete — a reader who changes their mind and
-- votes on a topic after all has not left a trace worth keeping, and the row
-- is not evidence of anything the platform needs to audit.

CREATE TABLE IF NOT EXISTS topic_set_aside (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_id    uuid NOT NULL REFERENCES votes (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  reason     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT topic_set_aside_reason_check CHECK (
    reason IN ('not_consensus', 'already_decided', 'unclear', 'not_my_authority')
  ),
  -- The statement is per reader per topic; a second one amends the first.
  CONSTRAINT topic_set_aside_unique UNIQUE (vote_id, user_id)
);

-- The only read the desk performs is "how many for this topic", once per tile.
CREATE INDEX IF NOT EXISTS topic_set_aside_vote_idx ON topic_set_aside (vote_id);

-- RLS on with no policies: service-role only, like newsletter_subscribers.
-- Who set a topic aside is not a public fact, and the count the desk prints is
-- served through the API rather than by letting a client read the rows.
ALTER TABLE topic_set_aside ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE topic_set_aside IS
  'Readers'' "not a matter of consensus" signal on a topic. Never a ballot: no points, no tally, no chain. Service-role only.';
COMMENT ON COLUMN topic_set_aside.reason IS
  'not_consensus | already_decided | unclear | not_my_authority. Closed list on purpose — free text would collect prose nobody reads and detail nobody asked for.';
