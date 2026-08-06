-- Pilot program: ten curated municipalities, five consensus votes each, tracked
-- Facebook-group campaigns with manual send, and the click→registration→ballot
-- funnel behind the founder's control desk.
--
-- Follows 20260802000010_space_governance.sql and 20260802000014: RLS enabled
-- with no policies (the service role bypasses RLS, so RLS is a second wall
-- against a leaked anon key and never the authorization control), ON DELETE
-- RESTRICT wherever a row is evidence, and a dedicated append-only audit table.
--
-- pilot_audit_log is deliberately NOT space_audit_log: cohort curation has no
-- single space_id, link codes are TEXT not UUID, and the mandatory 10-char
-- reason is the wrong ergonomics for a single-founder console.

-- ============================================
-- COHORT
-- ============================================

CREATE TABLE public.pilot_municipalities (
  municipality_id TEXT PRIMARY KEY
    REFERENCES public.municipalities(code) ON DELETE RESTRICT,
  rank INT CHECK (rank BETWEEN 1 AND 20),
  engagement_score NUMERIC NOT NULL DEFAULT 0,
  -- Frozen inputs of the ranking at curation time, so the "measured as top-10"
  -- claim in the Facebook post stays reproducible even after vote_sources moves:
  -- {votes, posts, comments, reactions, computed_at}
  engagement_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'selected'
    CHECK (status IN ('selected','active','paused','completed')),
  curated_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  curated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rank is unique among live cohort rows only; completed pilots free their slot.
CREATE UNIQUE INDEX uq_pilot_rank ON public.pilot_municipalities (rank)
  WHERE status IN ('selected','active');

COMMENT ON COLUMN public.pilot_municipalities.status IS
  'selected = curated, gate off. active = participate gate enforces residency. paused = gate off without losing the row. completed = pilot ended, rank slot freed.';

-- ============================================
-- THE FIVE CURATED VOTES PER MUNICIPALITY
-- ============================================

CREATE TABLE public.pilot_votes (
  municipality_id TEXT NOT NULL
    REFERENCES public.pilot_municipalities(municipality_id) ON DELETE RESTRICT,
  vote_id UUID NOT NULL REFERENCES public.votes(id) ON DELETE RESTRICT,
  position INT NOT NULL CHECK (position BETWEEN 1 AND 5),
  added_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (municipality_id, vote_id),
  UNIQUE (municipality_id, position)
);

CREATE INDEX idx_pilot_votes_vote ON public.pilot_votes (vote_id);

-- ============================================
-- CAMPAIGNS (one per municipality × Facebook group)
-- ============================================

CREATE TABLE public.pilot_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id TEXT NOT NULL
    REFERENCES public.pilot_municipalities(municipality_id) ON DELETE RESTRICT,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  group_name TEXT NOT NULL CHECK (length(btrim(group_name)) BETWEEN 1 AND 200),
  group_url TEXT CHECK (group_url IS NULL
    OR group_url ~* '^https://(www\.|m\.)?facebook\.com/'),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','ready','posted','archived')),
  current_copy_id UUID, -- FK added after pilot_campaign_copies exists
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES public.users(id) ON DELETE RESTRICT,
  post_permalink TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A campaign cannot claim "posted" without the evidence of the post.
  CHECK (status <> 'posted' OR (posted_at IS NOT NULL AND post_permalink IS NOT NULL))
);

CREATE INDEX idx_pilot_campaigns_muni
  ON public.pilot_campaigns (municipality_id, created_at DESC);

COMMENT ON TABLE public.pilot_campaigns IS
  'One row per municipality × Facebook group. There is no send API: Meta removed the Groups API in 2024, so "send" is the founder pasting the copy by hand and then recording the permalink via mark-posted, which is a conditional UPDATE guarded on status=''ready''.';

-- ============================================
-- COPY VERSIONS (append-only history; campaign points at current)
-- ============================================

CREATE TABLE public.pilot_campaign_copies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL
    REFERENCES public.pilot_campaigns(id) ON DELETE RESTRICT,
  version INT NOT NULL CHECK (version >= 1),
  body TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 5000),
  author TEXT NOT NULL CHECK (author IN ('llm','human')),
  author_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  model TEXT,             -- set when author='llm'
  prompt_snapshot JSONB,  -- the exact structured inputs handed to the model
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, version)
);

ALTER TABLE public.pilot_campaigns
  ADD CONSTRAINT fk_pilot_campaign_current_copy
  FOREIGN KEY (current_copy_id)
  REFERENCES public.pilot_campaign_copies(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.pilot_campaign_copies.prompt_snapshot IS
  'Audit trail in the vote_card_art mold: the full structured inputs (topics, engagement figures, tracked URL) that produced an LLM draft, so any published post can be traced to what the model was told.';

-- ============================================
-- SHORT LINKS
-- ============================================

CREATE TABLE public.pilot_links (
  code TEXT PRIMARY KEY CHECK (code ~ '^[a-z0-9]{8}$'),
  campaign_id UUID REFERENCES public.pilot_campaigns(id) ON DELETE RESTRICT,
  municipality_id TEXT NOT NULL
    REFERENCES public.pilot_municipalities(municipality_id) ON DELETE RESTRICT,
  target_path TEXT NOT NULL DEFAULT '/pilot',
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One primary link per campaign; municipality-level links carry NULL campaign_id.
CREATE UNIQUE INDEX uq_pilot_link_primary_per_campaign
  ON public.pilot_links (campaign_id) WHERE campaign_id IS NOT NULL;

-- ============================================
-- CLICKS (append-heavy evidence; hashes, never PII)
-- ============================================

CREATE TABLE public.pilot_link_clicks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  link_code TEXT NOT NULL
    REFERENCES public.pilot_links(code) ON DELETE RESTRICT,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT,  -- truncated to 256 chars by the app
  referer TEXT,     -- truncated to 512 chars by the app
  ip_hash TEXT,     -- HMAC-SHA256(ip, CLICK_HASH_SECRET) hex; the raw IP is never stored
  country TEXT,     -- cf-ipcountry, two letters
  is_bot BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_pilot_clicks_link_time
  ON public.pilot_link_clicks (link_code, clicked_at DESC);

COMMENT ON COLUMN public.pilot_link_clicks.is_bot IS
  'UA-heuristic classification. Facebook''s OG scraper (facebookexternalhit) hits every pasted link and MUST be recorded with is_bot=true rather than dropped — the log accounts for all traffic, and the dashboard reports the bot/non-bot split instead of hiding it.';

-- ============================================
-- REGISTRATIONS (one per user; the resident''s declaration + consent trail)
-- ============================================

CREATE TABLE public.pilot_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- CASCADE like user_notifications: the declaration and its GPS are personal
  -- data that should die with the account. Funnel aggregates survive in the
  -- click rows, which carry no identity.
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('participant','observer')),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  accuracy_m REAL,
  location_consent_at TIMESTAMPTZ,
  -- Pins the exact consent copy the user saw (e.g. 'pilot-gps-v1'), because the
  -- pilot flow — unlike GeoGate — sends coordinates to the server.
  consent_version TEXT,
  resolved_municipality_id TEXT
    REFERENCES public.municipalities(code) ON DELETE RESTRICT,
  resolution TEXT NOT NULL DEFAULT 'none'
    CHECK (resolution IN ('gps','manual','profile','none')),
  ref_code TEXT REFERENCES public.pilot_links(code) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((lat IS NULL) = (lng IS NULL)),
  -- Coordinates without a recorded consent are structurally impossible.
  CHECK (lat IS NULL OR location_consent_at IS NOT NULL)
);

CREATE INDEX idx_pilot_reg_muni
  ON public.pilot_registrations (resolved_municipality_id);
CREATE INDEX idx_pilot_reg_ref
  ON public.pilot_registrations (ref_code) WHERE ref_code IS NOT NULL;

COMMENT ON COLUMN public.pilot_registrations.ref_code IS
  'Attribution is exactly one hop: /l/{code} sets the taruu_ref cookie, registration stamps it here. Deliberately no column on users — attribution is pilot-scoped and dies with this table.';

-- ============================================
-- APPEND-ONLY AUDIT LOG
-- ============================================

CREATE TABLE public.pilot_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  -- Nullable: cohort-level acts (curation) span municipalities.
  municipality_id TEXT REFERENCES public.municipalities(code) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  object_type TEXT NOT NULL
    CHECK (object_type IN ('cohort','campaign','copy','link','vote_set')),
  object_id TEXT, -- TEXT on purpose: link codes and municipality codes are not UUIDs
  prior_state JSONB,
  new_state JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pilot_audit_time
  ON public.pilot_audit_log (created_at DESC, id DESC);
CREATE INDEX idx_pilot_audit_muni
  ON public.pilot_audit_log (municipality_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.pilot_audit_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'pilot_audit_log is append-only (attempted %)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END $$;

CREATE TRIGGER pilot_audit_log_no_mutate
  BEFORE UPDATE OR DELETE ON public.pilot_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.pilot_audit_append_only();

CREATE TRIGGER pilot_audit_log_no_truncate
  BEFORE TRUNCATE ON public.pilot_audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.pilot_audit_append_only();

REVOKE UPDATE, DELETE, TRUNCATE ON public.pilot_audit_log
  FROM anon, authenticated, service_role;

COMMENT ON TABLE public.pilot_audit_log IS
  'Append-only in the space_audit_log mold: BEFORE trigger plus REVOKE, not RLS, because the service role bypasses RLS. Tamper-resistant, not WORM.';

-- ============================================
-- RLS / GRANTS
-- ============================================
-- All pilot reads and writes go through the server (supabaseAdmin or
-- server-rendered pages), so nothing here needs an anon policy. Deny-all.

ALTER TABLE public.pilot_municipalities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_votes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_campaigns       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_campaign_copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_links           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_link_clicks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_registrations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_audit_log       ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.pilot_municipalities  FROM anon, authenticated;
REVOKE ALL ON public.pilot_votes           FROM anon, authenticated;
REVOKE ALL ON public.pilot_campaigns       FROM anon, authenticated;
REVOKE ALL ON public.pilot_campaign_copies FROM anon, authenticated;
REVOKE ALL ON public.pilot_links           FROM anon, authenticated;
REVOKE ALL ON public.pilot_link_clicks     FROM anon, authenticated;
REVOKE ALL ON public.pilot_registrations   FROM anon, authenticated;
REVOKE ALL ON public.pilot_audit_log       FROM anon, authenticated;

-- ============================================
-- STATS / RANKING FUNCTIONS (called via supabaseAdmin.rpc)
-- ============================================

-- Engagement ranking across all municipalities with discovery-fleet data.
-- Weights: distinct source posts show breadth (x5), comments show effortful
-- engagement (x3), reactions are cheap (x1). The knesset pseudo-municipality
-- is excluded — it is a national desk, not a candidate.
CREATE OR REPLACE FUNCTION public.pilot_engagement_ranking()
RETURNS TABLE (
  municipality_id TEXT,
  vote_count BIGINT,
  post_count BIGINT,
  comments_count BIGINT,
  reactions_count BIGINT,
  score NUMERIC
)
LANGUAGE sql STABLE AS $$
  SELECT
    v.municipality_id,
    count(DISTINCT v.id)::bigint AS vote_count,
    coalesce(sum(vs.post_count), 0)::bigint AS post_count,
    coalesce(sum(vs.comments_count), 0)::bigint AS comments_count,
    coalesce(sum((
      SELECT coalesce(sum(value::int), 0)
      FROM jsonb_each_text(coalesce(vs.reactions, '{}'::jsonb))
      WHERE value ~ '^[0-9]+$'
    )), 0)::bigint AS reactions_count,
    (
      coalesce(sum(vs.post_count), 0) * 5
      + coalesce(sum(vs.comments_count), 0) * 3
      + coalesce(sum((
          SELECT coalesce(sum(value::int), 0)
          FROM jsonb_each_text(coalesce(vs.reactions, '{}'::jsonb))
          WHERE value ~ '^[0-9]+$'
        )), 0)
    )::numeric AS score
  FROM public.votes v
  JOIN public.vote_sources vs ON vs.vote_id = v.id
  WHERE v.municipality_id IS NOT NULL
    AND v.municipality_id <> 'כנסת ישראל'
  GROUP BY v.municipality_id
  ORDER BY 6 DESC;
$$;

-- Per-day click buckets for one link. Bots are reported, never hidden.
CREATE OR REPLACE FUNCTION public.pilot_link_click_stats(p_code TEXT)
RETURNS TABLE (
  day DATE,
  total_clicks BIGINT,
  human_clicks BIGINT,
  unique_visitors BIGINT
)
LANGUAGE sql STABLE AS $$
  SELECT
    (clicked_at AT TIME ZONE 'Asia/Jerusalem')::date AS day,
    count(*)::bigint AS total_clicks,
    count(*) FILTER (WHERE NOT is_bot)::bigint AS human_clicks,
    count(DISTINCT ip_hash) FILTER (WHERE NOT is_bot)::bigint AS unique_visitors
  FROM public.pilot_link_clicks
  WHERE link_code = p_code
  GROUP BY 1
  ORDER BY 1;
$$;

-- The honest funnel for one campaign. Registrations are attributed by ref_code
-- (cookie survives 30 days; cleared cookies and cross-device journeys
-- undercount, never overcount). Ballots count users attributed to this
-- campaign's link who cast a ballot on one of the municipality's pilot votes.
CREATE OR REPLACE FUNCTION public.pilot_campaign_funnel(p_campaign UUID)
RETURNS TABLE (
  clicks BIGINT,
  unique_visitors BIGINT,
  registrations BIGINT,
  participants BIGINT,
  ballots BIGINT
)
LANGUAGE sql STABLE AS $$
  WITH link AS (
    SELECT code, municipality_id
    FROM public.pilot_links
    WHERE campaign_id = p_campaign
  )
  SELECT
    (SELECT count(*) FROM public.pilot_link_clicks c JOIN link l ON c.link_code = l.code
      WHERE NOT c.is_bot)::bigint AS clicks,
    (SELECT count(DISTINCT c.ip_hash) FROM public.pilot_link_clicks c JOIN link l ON c.link_code = l.code
      WHERE NOT c.is_bot)::bigint AS unique_visitors,
    (SELECT count(*) FROM public.pilot_registrations r JOIN link l ON r.ref_code = l.code)::bigint
      AS registrations,
    (SELECT count(*) FROM public.pilot_registrations r JOIN link l ON r.ref_code = l.code
      WHERE r.role = 'participant')::bigint AS participants,
    (SELECT count(DISTINCT uv.user_id)
      FROM public.user_votes uv
      JOIN public.pilot_votes pv ON pv.vote_id = uv.vote_id
      JOIN link l ON pv.municipality_id = l.municipality_id
      JOIN public.pilot_registrations r ON r.user_id = uv.user_id AND r.ref_code = l.code
    )::bigint AS ballots;
$$;

-- One row per cohort municipality for the overview table.
CREATE OR REPLACE FUNCTION public.pilot_overview()
RETURNS TABLE (
  municipality_id TEXT,
  rank INT,
  status TEXT,
  campaigns BIGINT,
  posted_campaigns BIGINT,
  human_clicks BIGINT,
  registrations BIGINT,
  participants BIGINT,
  ballots BIGINT
)
LANGUAGE sql STABLE AS $$
  SELECT
    pm.municipality_id,
    pm.rank,
    pm.status,
    (SELECT count(*) FROM public.pilot_campaigns pc
      WHERE pc.municipality_id = pm.municipality_id
        AND pc.status <> 'archived')::bigint AS campaigns,
    (SELECT count(*) FROM public.pilot_campaigns pc
      WHERE pc.municipality_id = pm.municipality_id
        AND pc.status = 'posted')::bigint AS posted_campaigns,
    (SELECT count(*)
      FROM public.pilot_link_clicks c
      JOIN public.pilot_links l ON c.link_code = l.code
      WHERE l.municipality_id = pm.municipality_id AND NOT c.is_bot)::bigint AS human_clicks,
    (SELECT count(*) FROM public.pilot_registrations r
      WHERE r.resolved_municipality_id = pm.municipality_id)::bigint AS registrations,
    (SELECT count(*) FROM public.pilot_registrations r
      WHERE r.resolved_municipality_id = pm.municipality_id
        AND r.role = 'participant')::bigint AS participants,
    (SELECT count(DISTINCT uv.user_id)
      FROM public.user_votes uv
      JOIN public.pilot_votes pv ON pv.vote_id = uv.vote_id
      WHERE pv.municipality_id = pm.municipality_id)::bigint AS ballots
  FROM public.pilot_municipalities pm
  ORDER BY pm.rank NULLS LAST, pm.municipality_id;
$$;
