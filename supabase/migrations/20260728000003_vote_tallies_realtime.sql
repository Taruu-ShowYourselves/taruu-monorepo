-- Live tallies surface: a read view for seeding + vote_options added to the
-- Realtime publication so clients subscribe to tally changes directly from
-- Supabase (the Cloudflare Worker can't hold sockets).

CREATE OR REPLACE VIEW vote_tallies
WITH (security_invoker = true) AS
  SELECT
    v.id              AS vote_id,
    v.municipality_id,
    v.status,
    o.id              AS option_id,
    o.text            AS option_text,
    o.votes           AS ballots
  FROM votes v
  JOIN vote_options o ON o.vote_id = v.id;

COMMENT ON VIEW vote_tallies IS
  'Flat tally rows per vote option; security_invoker so RLS of votes/vote_options applies.';

-- Realtime: emit change events for vote_options (tally increments).
-- RLS still gates what each subscriber may see (public read on active votes).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE vote_options;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE vote_options REPLICA IDENTITY FULL;
