-- Ranker v3: the stakes axis.
--
-- The v2 blend (0.6·relevance + 0.4·media) let ceremonial items win the
-- desk: a memorial-day item resonates maximally (relevance) and its topic
-- saturates the press (media), yet the vote itself changes nothing. v3
-- separates "does the topic touch the public" (relevance) from "what
-- actually changes if this passes" (stakes) and blends
-- hotness = 0.45·media + 0.35·stakes + 0.20·relevance.
--
-- media_evidence is now version 3: each counted hit carries a freshness
-- decay weight (half-life 4 days; undated hits at a flat 0.4 discount) and
-- the evidence records `effectiveOutlets` — the decay-weighted outlet
-- total the media score is computed from — alongside the unweighted
-- `outletsCounted` the web app already reads.
--
-- Null stakes = row written by an older ranker; the blend falls back to
-- relevance, so old rows stay comparable until re-ranked.

ALTER TABLE knesset_rankings
  ADD COLUMN IF NOT EXISTS stakes INTEGER CHECK (stakes BETWEEN 0 AND 100);

COMMENT ON COLUMN knesset_rankings.stakes IS
  'What actually changes if the item passes, 0-100. Ceremonial/declaratory items score low regardless of resonance. Null = ranked before v3.';
