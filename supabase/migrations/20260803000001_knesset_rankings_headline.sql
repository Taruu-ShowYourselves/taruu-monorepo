-- Curated headline for a Knesset agenda item.
--
-- Agenda titles arrive from the Knesset OData feed as legal citations —
-- `הצעת חוק הגנת הצרכן (תיקון מס' 74), התשפ"ו-2026` — and the sync truncates
-- long ones mid-clause. The web app already splits a citation into instrument
-- / subject / qualifier deterministically (apps/web/src/lib/knesset/billTitle.ts),
-- which fixes the typography but cannot tell a reader what a bill DOES: the
-- subject of the citation is the name of the statute being amended, not the
-- change on the table.
--
-- The ranker agent has the document summary and the press coverage in hand
-- when it scores an item, so it writes the headline in the same pass. Null
-- means "not curated yet" and the app falls back to the split citation —
-- there is no backfill requirement and no window where a tile has no title.

ALTER TABLE knesset_rankings
  ADD COLUMN IF NOT EXISTS headline TEXT;

COMMENT ON COLUMN knesset_rankings.headline IS
  'Editor-agent Hebrew headline (<= ~9 words) describing what the item does. Null = fall back to the deterministic citation split.';
