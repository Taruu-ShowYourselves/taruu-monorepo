-- Knesset item documents + AI summary.
--
-- Each day-order item can carry an attached official document (bill text,
-- agenda-proposal text) published on fs.knesset.gov.il and indexed by the
-- Knesset OData document tables (KNS_DocumentBill / KNS_DocumentAgenda).
-- /api/cron/knesset-docs discovers the best attachment per item, extracts
-- its text and stores a short Hebrew summary for the vote detail page.
--
-- summarized_at marks the attempt (set even when no document / no summary
-- could be produced) so the cron never re-grinds the same items.

ALTER TABLE knesset_items
  ADD COLUMN IF NOT EXISTS doc_url       TEXT,
  -- GroupTypeDesc of the chosen document, e.g. 'חוק - נוסח לא רשמי'.
  ADD COLUMN IF NOT EXISTS doc_group     TEXT,
  ADD COLUMN IF NOT EXISTS summary       TEXT,
  ADD COLUMN IF NOT EXISTS summary_model TEXT,
  ADD COLUMN IF NOT EXISTS summarized_at TIMESTAMPTZ;

-- Work queue: items not yet attempted.
CREATE INDEX IF NOT EXISTS idx_knesset_items_pending_summary
  ON knesset_items(created_at)
  WHERE summarized_at IS NULL;
