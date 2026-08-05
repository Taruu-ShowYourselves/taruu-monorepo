-- Governed notification dispatch. The campaign row is what makes SPACE-08's
-- "delivered equals previewed" checkable: preview persists the audience and
-- content fingerprints, and send refuses to proceed unless both still match.
--
-- Follows 20260802000010_space_governance.sql: ON DELETE RESTRICT into the
-- governance chain, RLS enabled with no policies (the service role bypasses
-- RLS, so RLS is a second wall against a leaked anon key and never the
-- authorization control), and no star-shaped cascade that could erase evidence.

CREATE TABLE public.space_notification_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id   UUID NOT NULL REFERENCES public.spaces(id) ON DELETE RESTRICT,
  created_by UUID NOT NULL REFERENCES public.users(id)  ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 60),
  body  TEXT NOT NULL CHECK (length(btrim(body))  BETWEEN 1 AND 300),
  audience_filter TEXT NOT NULL
    CHECK (audience_filter IN ('all_members','active_vote_participants','new_members_30d')),
  audience_hash TEXT NOT NULL,
  content_hash  TEXT NOT NULL,
  audience_size INT NOT NULL CHECK (audience_size >= 0),
  excluded_opted_out  INT NOT NULL DEFAULT 0 CHECK (excluded_opted_out  >= 0),
  excluded_no_channel INT NOT NULL DEFAULT 0 CHECK (excluded_no_channel >= 0),
  status TEXT NOT NULL DEFAULT 'previewed'
    CHECK (status IN ('previewed','sent','failed')),
  reason TEXT CHECK (reason IS NULL OR length(btrim(reason)) BETWEEN 10 AND 500),
  previewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

COMMENT ON COLUMN public.space_notification_campaigns.audience_hash IS
  'sha256 of the sorted, comma-joined recipient user ids as the preview resolved them. Send re-runs the one resolver and refuses a mismatch.';
COMMENT ON COLUMN public.space_notification_campaigns.content_hash IS
  'sha256 of the trimmed title, body and audience filter joined by newlines. Doubles as the previewToken the composer echoes back at send time.';

-- The quota index. The quota is counted from THESE ROWS, never from an
-- in-process rate limiter: lib/rate-limit.ts falls back to a per-isolate Map
-- when Upstash is unconfigured, and on Cloudflare Workers that means N
-- isolates each grant a full quota.
CREATE INDEX idx_space_campaign_quota
  ON public.space_notification_campaigns (space_id, sent_at)
  WHERE sent_at IS NOT NULL;

COMMENT ON INDEX public.idx_space_campaign_quota IS
  'Backs the calendar-month quota count (sent_at >= date_trunc(''month'', now())). The database is the quota of record precisely because the in-process Map fallback in lib/rate-limit.ts is per-isolate.';

CREATE TABLE public.space_notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.space_notification_campaigns(id) ON DELETE RESTRICT,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  channel TEXT NOT NULL CHECK (channel IN ('in_app','push')),
  state   TEXT NOT NULL DEFAULT 'delivered'
    CHECK (state IN ('delivered','suppressed','failed')),
  suppression_reason TEXT
    CHECK (suppression_reason IS NULL
        OR suppression_reason IN ('opted_out','no_active_channel')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per RECIPIENT, not per push token, so the log is directly comparable to the
-- previewed audience. The unique index makes a retry idempotent.
CREATE UNIQUE INDEX uq_delivery_once
  ON public.space_notification_deliveries (campaign_id, user_id, channel);

COMMENT ON TABLE public.space_notification_deliveries IS
  'Delivery evidence, one row per recipient per channel. Comparable row-for-row with the campaign audience_size, which is the SPACE-08 equality. ON DELETE RESTRICT on both FKs: this is evidence, like space_audit_log.';

CREATE TABLE public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The one CASCADE in this file, and it is deliberate. Everywhere else in the
  -- governance chain the FKs RESTRICT because those rows are evidence that must
  -- outlive a deleted actor. A resident's personal inbox is not evidence: it is
  -- their copy of a message whose authoritative record already lives in the
  -- campaign and delivery rows, which RESTRICT. Deleting a user should take
  -- their inbox with them rather than block on it.
  user_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  space_id UUID REFERENCES public.spaces(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.space_notification_campaigns(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body  TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_notifications_inbox
  ON public.user_notifications (user_id, created_at DESC);

ALTER TABLE public.space_notification_campaigns  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications            ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.space_notification_campaigns  FROM anon, authenticated;
REVOKE ALL ON public.space_notification_deliveries FROM anon, authenticated;

-- A resident may read their own inbox with the anon key. public.user_id() is
-- the correct helper here; the built-in Supabase session helper returns NULL
-- under this project's custom JWT, which would silently deny every row.
CREATE POLICY "Users read their own notifications"
  ON public.user_notifications FOR SELECT USING (user_id = public.user_id());
GRANT SELECT ON public.user_notifications TO authenticated;
