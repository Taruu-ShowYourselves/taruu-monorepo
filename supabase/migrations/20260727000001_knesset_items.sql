-- Knesset day-order items: plenum agenda (סדר יום המליאה) pulled from the
-- official Knesset OData API (KNS_PlenumSession + KNS_PlmSessionItem).
-- Each row links one agenda item to the vote that measures the civic
-- position on it. Synced by /api/cron/knesset-agenda; ItemID is the
-- upstream dedup key so re-runs are idempotent.

CREATE TABLE IF NOT EXISTS knesset_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vote_id           UUID NOT NULL UNIQUE REFERENCES votes(id) ON DELETE CASCADE,
  -- Knesset OData KNS_PlmSessionItem.ItemID — the upstream identity.
  item_id           BIGINT NOT NULL UNIQUE,
  -- The plenum sitting the item is scheduled in.
  plenum_session_id BIGINT NOT NULL,
  session_date      TIMESTAMPTZ,
  session_number    INTEGER,
  knesset_num       INTEGER,
  -- ItemTypeDesc, e.g. 'הצעה לסדר היום', 'הצעת חוק'.
  item_type         TEXT,
  -- Position in the sitting's day order.
  ordinal           INTEGER,
  status_id         INTEGER,
  is_discussion     BOOLEAN NOT NULL DEFAULT false,
  -- LastUpdatedDate reported by the Knesset API for the item.
  source_updated_at TIMESTAMPTZ,
  fetched_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knesset_items_vote ON knesset_items(vote_id);
CREATE INDEX IF NOT EXISTS idx_knesset_items_session ON knesset_items(plenum_session_id);

ALTER TABLE knesset_items ENABLE ROW LEVEL SECURITY;

-- Day-order metadata is public press data — readable by anyone.
DROP POLICY IF EXISTS "knesset_items_public_read" ON knesset_items;
CREATE POLICY "knesset_items_public_read" ON knesset_items
  FOR SELECT USING (true);

-- Writes go through the service role (agenda sync cron) only.
