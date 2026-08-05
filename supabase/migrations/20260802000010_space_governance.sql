-- Space governance substrate: typed spaces, explicit per-action capability
-- grants, member suspensions, an append-only audit log, and platform
-- escalations.
--
-- Additive by design, mirroring 20260728000001_municipalities.sql: the existing
-- municipality_id columns on users/votes/treasury are untouched, and a space
-- joins back to them through the nullable spaces.municipality_code FK.
--
-- RLS is enabled on every new table with NO policies. That is defence against a
-- leaked anon key only -- it is NOT the authorization control, because every
-- application write uses the service role, which has BYPASSRLS. The control is
-- the SpaceScope-typed application layer.

-- ============================================
-- SPACES
-- ============================================

CREATE TABLE public.spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'municipality'
    CHECK (type IN ('municipality','national','organization','urban_area','nationwide_civic')),
  slug TEXT NOT NULL UNIQUE,
  name_he TEXT NOT NULL,
  municipality_code TEXT REFERENCES public.municipalities(code) ON DELETE RESTRICT,
  geography JSONB,
  owner_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  verification_state TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_state IN ('unverified','pending','verified')),
  notification_monthly_quota INT NOT NULL DEFAULT 8
    CHECK (notification_monthly_quota >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Load-bearing: the authorization scope predicate resolves one
-- municipality_code per space, and two spaces sharing a code would silently
-- widen every scoped query.
CREATE UNIQUE INDEX uq_spaces_municipality
  ON public.spaces (municipality_code) WHERE municipality_code IS NOT NULL;

CREATE TRIGGER update_spaces_updated_at
  BEFORE UPDATE ON public.spaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON COLUMN public.spaces.municipality_code IS
  'Nullable join back to the untouched municipality_id columns on users/votes/treasury. NULL for issue #74 space types.';
COMMENT ON COLUMN public.spaces.geography IS
  'Nullable {"centroid":{"lat":..,"lng":..},"radiusMeters":..}. No PostGIS in this database.';
COMMENT ON COLUMN public.spaces.notification_monthly_quota IS
  'Campaigns sendable per calendar month. Counted from space_notification_campaigns, never from an in-process rate limiter.';

-- One space per municipality, reusing the existing public identifier so the
-- public council page and the administered space are the same object.
INSERT INTO public.spaces (id, type, slug, name_he, municipality_code, verification_state)
SELECT m.council_id,
       CASE WHEN m.kind = 'national' THEN 'national' ELSE 'municipality' END,
       m.slug_he,
       m.name_he,
       m.code,
       'verified'
FROM public.municipalities m
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SUPER-ADMIN BOOTSTRAP MARKER
-- ============================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.is_platform_admin IS
  'Bootstrap marker used ONLY to authorize cross-space grant management and grant suspension. Confers no space capability and no data access. Never read it as a general admin flag.';

-- Reconcile with the adjacent council role model. This comment documents that
-- council_role_assignments is public-profile metadata; nothing in the
-- authorization path reads it.
COMMENT ON TABLE public.council_role_assignments IS
  'Public council-profile metadata only. Confers NO administrative capability. Authorization reads space_capability_grants exclusively; see spaces / space_capability_grants.';

-- ============================================
-- CAPABILITY GRANTS
-- ============================================

CREATE TABLE public.space_capability_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE RESTRICT,
  user_id  UUID NOT NULL REFERENCES public.users(id)  ON DELETE RESTRICT,
  capability TEXT NOT NULL CHECK (capability IN (
    'proposal.read','proposal.approve','proposal.reject',
    'member.read','member.suspend',
    'grant.create','grant.revoke',
    'content.moderate','metrics.read','notification.send','audit.read'
  )),
  granted_via_role TEXT,
  granted_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  suspended_at TIMESTAMPTZ,
  suspended_by UUID REFERENCES public.users(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX uq_active_grant
  ON public.space_capability_grants (space_id, user_id, capability)
  WHERE suspended_at IS NULL;

CREATE INDEX idx_grant_resolver
  ON public.space_capability_grants (user_id, space_id, capability)
  WHERE suspended_at IS NULL;

COMMENT ON COLUMN public.space_capability_grants.granted_via_role IS
  'Provenance for the UI preset picker ONLY. Never consulted at authorization time -- a role must not confer power on its own.';

-- ============================================
-- MEMBER SUSPENSIONS
-- ============================================

-- Membership itself stays derived from users.municipality_id = spaces.municipality_code.
-- This table records the suspension event so a member with zero grants can
-- still be suspended.
CREATE TABLE public.space_member_suspensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE RESTRICT,
  user_id  UUID NOT NULL REFERENCES public.users(id)  ON DELETE RESTRICT,
  suspended_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  suspended_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  lifted_at TIMESTAMPTZ,
  lifted_by UUID REFERENCES public.users(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(btrim(reason)) BETWEEN 10 AND 2000)
);

CREATE UNIQUE INDEX uq_active_member_suspension
  ON public.space_member_suspensions (space_id, user_id) WHERE lifted_at IS NULL;

-- ============================================
-- APPEND-ONLY AUDIT LOG
-- ============================================

CREATE TABLE public.space_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id      UUID NOT NULL REFERENCES public.spaces(id) ON DELETE RESTRICT,
  actor_user_id UUID NOT NULL REFERENCES public.users(id)  ON DELETE RESTRICT,
  action        TEXT NOT NULL,
  object_type   TEXT NOT NULL CHECK (object_type IN
                  ('vote','grant','space','member','notification_campaign','content','escalation')),
  object_id     UUID,
  prior_state   JSONB,
  new_state     JSONB,
  reason        TEXT NOT NULL CHECK (length(btrim(reason)) BETWEEN 10 AND 2000),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_space_audit_space_time ON public.space_audit_log (space_id, created_at DESC, id DESC);
CREATE INDEX idx_space_audit_object     ON public.space_audit_log (object_type, object_id);
CREATE INDEX idx_space_audit_actor      ON public.space_audit_log (space_id, actor_user_id);

CREATE UNIQUE INDEX uq_space_proposal_single_approval
  ON public.space_audit_log (object_id)
  WHERE object_type = 'vote' AND action = 'proposal.approved';

CREATE OR REPLACE FUNCTION public.space_audit_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'space_audit_log is append-only (attempted %)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END $$;

CREATE TRIGGER space_audit_log_no_mutate
  BEFORE UPDATE OR DELETE ON public.space_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.space_audit_append_only();

CREATE TRIGGER space_audit_log_no_truncate
  BEFORE TRUNCATE ON public.space_audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.space_audit_append_only();

REVOKE UPDATE, DELETE, TRUNCATE ON public.space_audit_log FROM anon, authenticated, service_role;

COMMENT ON TABLE public.space_audit_log IS
  'Append-only. Enforced by a BEFORE UPDATE/DELETE/TRUNCATE trigger plus REVOKE -- not by RLS, because the service role bypasses RLS. ON DELETE RESTRICT on both FKs is what makes "suspension never erases history" structurally true. A superuser can still tamper; this is tamper-resistant, not WORM.';

-- ============================================
-- PLATFORM ESCALATIONS
-- ============================================

CREATE TABLE public.platform_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULLABLE on purpose, and paired with raw_space_id. Plan 05-06's escalation
  -- endpoint returns an identical opaque acknowledgement whether or not the
  -- target space exists and whether or not the caller is a member, so it cannot
  -- be used as an existence oracle. A NOT NULL FK here would break that: an
  -- unresolvable target would fail the insert and the caller would see a
  -- different response. An unresolvable target lands as NULL with the caller's
  -- exact input preserved in raw_space_id for a platform admin to triage.
  space_id  UUID REFERENCES public.spaces(id) ON DELETE RESTRICT,
  raw_space_id TEXT NOT NULL,
  raised_by UUID NOT NULL REFERENCES public.users(id)  ON DELETE RESTRICT,
  body TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 10 AND 2000),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_platform_escalations_open ON public.platform_escalations (status, created_at DESC);

COMMENT ON TABLE public.platform_escalations IS
  'Escalations are recorded ONLY here. They never write a row into the target space''s space_audit_log -- that log is append-only, so letting any authenticated user append to an arbitrary space''s log would be permanent, uncleanable pollution.';

-- ============================================
-- RLS: ANON-KEY DEFENCE ONLY
-- ============================================

ALTER TABLE public.spaces                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_capability_grants   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_member_suspensions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_audit_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_escalations      ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.space_capability_grants  FROM anon, authenticated;
REVOKE ALL ON public.space_member_suspensions FROM anon, authenticated;
REVOKE ALL ON public.platform_escalations     FROM anon, authenticated;
REVOKE ALL ON public.space_audit_log          FROM anon, authenticated;
