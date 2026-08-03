-- Ranker hardening: the media sub-score is now COMPUTED from counted,
-- HTTP-validated press coverage instead of estimated by the model. This
-- column stores the full evidence behind the number: the WebSearch queries
-- the agent ran, every coverage hit with its validation result (HTTP status,
-- freshness ≤14 days, Israeli-press classification, whether it counted),
-- the distinct-outlet count, and when validation happened.
--
-- Shape (version 2):
--   { "version": 2,
--     "queries": ["..."],
--     "hits": [{ "url", "outlet", "publishedAt", "status", "ok",
--                "fresh", "israeliPress", "counted" }],
--     "outletsCounted": 3,
--     "checkedAt": "2026-07-29T12:00:00Z" }
--
-- Rows written before the hardening keep the default '{}' — the web app
-- treats missing evidence as "legacy judgment score".

ALTER TABLE knesset_rankings
  ADD COLUMN IF NOT EXISTS media_evidence JSONB NOT NULL DEFAULT '{}';
