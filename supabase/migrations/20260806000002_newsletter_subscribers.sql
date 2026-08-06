-- Newsletter list, held in our own database instead of Beehiiv.
--
-- The Beehiiv key went dead and every signup since has been lost: the route
-- posted to their API, took a 401, and printed a generic failure to a reader
-- who had just handed us their address. An address is not something to store
-- on a third party we cannot verify from CI, so the list moves here.
--
-- `email` is stored already normalised - the route lowercases and trims before
-- it ever reaches the database, and the CHECK makes that a property of the
-- table rather than a habit of the caller. A plain UNIQUE on the column then
-- gives the route a conflict target it can name, which an expression index on
-- lower(email) would not.
--
-- Unsubscribing sets `status` and keeps the row: a resubscribe has to be able
-- to find the old record and reactivate it, and a deleted row would silently
-- become a new subscriber with a fresh welcome.

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE CHECK (email = lower(btrim(email))),
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'unsubscribed')),
  -- Where the address came from: which form, which page, which edition.
  source          TEXT,
  source_page     TEXT,
  locale          TEXT CHECK (locale IS NULL OR locale IN ('he', 'en')),
  subscribed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The only query the app runs against this table other than the upsert.
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_status
  ON newsletter_subscribers(status);

-- No policies, deliberately. RLS on with an empty policy set denies anon and
-- authenticated outright, and the service role bypasses it - so the list is
-- reachable only from the API route that owns it. A subscriber list is a pile
-- of personal data with no reason to be readable from a browser.
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE newsletter_subscribers IS
  'Newsletter list. Service-role only: RLS is enabled with no policies on purpose.';
COMMENT ON COLUMN newsletter_subscribers.status IS
  'active | unsubscribed. Rows are never deleted so a resubscribe reactivates rather than re-creates.';
