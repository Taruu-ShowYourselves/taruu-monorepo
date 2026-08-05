-- Phase 5 (GitHub issue #79a): role grants, community-manager applications,
-- and an append-only review audit log.
--
-- Four deliberate deviations from what the older migrations in this directory do:
--
--   1. TEXT + CHECK, not native ENUM. `identity_documents` (2026-07-27) already
--      moved to this convention. Issue #76 will add an authority-representative
--      role; `ALTER TYPE ... ADD VALUE` is transaction-hostile, a CHECK edit is not.
--
--   2. "Space" is `municipalities.code`, not a new table. It is already the FK
--      target for users/votes/treasury and already carries the seeded national
--      pseudo-space 'כנסת ישראל' (kind = 'national').
--
--   3. REAL RLS policies, not deny-all. 20260802000001_rls_transport.sql made
--      `public.user_id()` resolve from the verified PostgREST JWT, and
--      apps/web/src/lib/supabase/user-client.ts mints that JWT. So per-user
--      policies finally match rows instead of silently matching nothing.
--      Anon still reads zero rows: every policy is `TO authenticated`.
--
--   4. Admin scope is resolved inside SECURITY DEFINER helpers. A policy ON
--      role_grants that SELECTs FROM role_grants re-enters the same policy and
--      Postgres raises 42P17 "infinite recursion detected in policy". The
--      helpers below run as their owner and therefore bypass RLS on the lookup,
--      which is the standard break in that cycle.
--
-- Writes are NOT policy-covered on purpose. Every mutation in this phase goes
-- through the service-role client from apps/web/src/server/infra/supabase/role.repo.ts,
-- authorized by apps/web/src/server/app/authz/require-role.ts. Adding INSERT or
-- UPDATE policies would create a second, weaker write path.

-- === Role grants =========================================================

CREATE TABLE role_grants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  role TEXT NOT NULL
    CHECK (role IN ('super_admin', 'space_admin', 'community_manager')),

  -- NULL = platform-wide (super_admin only). Otherwise a municipalities.code.
  space_id TEXT REFERENCES municipalities(code),

  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'revoked')),

  -- Provenance. 'application' + source_id = approved via the review console;
  -- 'manual' = granted directly by a platform operator (how the first
  -- super_admin comes into existence). Issue #76 adds 'authority_claim' here.
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'application')),
  source_id UUID,

  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- super_admin is platform-wide; every other role is space-scoped.
  CONSTRAINT role_grants_scope_ck CHECK (
    (role = 'super_admin' AND space_id IS NULL)
    OR (role <> 'super_admin' AND space_id IS NOT NULL)
  )
);

COMMENT ON TABLE role_grants IS
  'Role grants with an explicit lifecycle (RBAC-01). Never a boolean on users.';

-- One LIVE grant per (user, role, space). Partial so a revoked grant can be
-- re-issued later; a plain UNIQUE would block re-granting forever.
-- COALESCE (not NULLS NOT DISTINCT) so platform-wide grants dedupe on every
-- Postgres version.
CREATE UNIQUE INDEX uq_role_grants_live
  ON role_grants (user_id, role, COALESCE(space_id, '*'))
  WHERE status IN ('active', 'suspended');

CREATE INDEX idx_role_grants_user_live
  ON role_grants (user_id) WHERE status = 'active';
CREATE INDEX idx_role_grants_space_role
  ON role_grants (space_id, role) WHERE status = 'active';

CREATE TRIGGER update_role_grants_updated_at
  BEFORE UPDATE ON role_grants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- === Community-manager applications =====================================

CREATE TABLE community_manager_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  space_id TEXT NOT NULL REFERENCES municipalities(code),

  -- The applicant's case, in Hebrew.
  motivation TEXT NOT NULL CHECK (char_length(motivation) BETWEEN 40 AND 2000),
  contact_phone TEXT,
  -- Reviewer-checkable links. Array of URL strings. Issue #76 reuses this
  -- column for authority-claim evidence.
  evidence_urls JSONB NOT NULL DEFAULT '[]'::jsonb,

  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'approved', 'rejected', 'withdrawn')),

  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE community_manager_applications IS
  'Submitted claims awaiting admin review (RBAC-03). Approval alone grants nothing.';

-- At most one OPEN application per (user, space); a rejected one may be resubmitted.
CREATE UNIQUE INDEX uq_cm_applications_open
  ON community_manager_applications (user_id, space_id)
  WHERE status = 'submitted';

CREATE INDEX idx_cm_applications_queue
  ON community_manager_applications (space_id, created_at)
  WHERE status = 'submitted';

CREATE TRIGGER update_cm_applications_updated_at
  BEFORE UPDATE ON community_manager_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- === Append-only review audit ===========================================
--
-- No foreign keys, by design. This log must outlive the row it describes and
-- survive staff changes (issue #76: "histories remain auditable after staff
-- changes"). subject_type generalizes past role grants so issue #76 can record
-- authority-claim decisions in the same table.

CREATE TABLE role_grant_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  subject_type TEXT NOT NULL
    CHECK (subject_type IN ('role_grant', 'community_manager_application')),
  subject_id UUID NOT NULL,

  event TEXT NOT NULL CHECK (
    event IN ('submitted', 'approved', 'rejected', 'granted',
              'suspended', 'reinstated', 'revoked')
  ),

  subject_user_id UUID,   -- whom the decision concerns
  actor_user_id UUID,     -- who decided; NULL = system
  role TEXT,
  space_id TEXT,
  reason TEXT,
  detail JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE role_grant_events IS
  'Append-only review audit (RBAC-04). No FKs and no UPDATE/DELETE: the log outlives its subject.';

CREATE INDEX idx_role_grant_events_subject
  ON role_grant_events (subject_type, subject_id, created_at);
CREATE INDEX idx_role_grant_events_subject_user
  ON role_grant_events (subject_user_id, created_at);

-- Append-only, enforced in the database. RLS would not do this: the service
-- role bypasses RLS, and the service role is what the app writes with.
CREATE OR REPLACE FUNCTION public.reject_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'role_grant_events is append-only (attempted %)', TG_OP;
END;
$$;

CREATE TRIGGER role_grant_events_append_only
  BEFORE UPDATE OR DELETE ON role_grant_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_audit_mutation();

-- === Admin-scope helpers (SECURITY DEFINER — the anti-recursion break) ===
--
-- These MUST stay SECURITY DEFINER. A policy on role_grants that inlined
-- `EXISTS (SELECT 1 FROM role_grants ...)` would re-enter that same policy and
-- Postgres raises 42P17 "infinite recursion detected in policy for relation
-- role_grants". Running as the owner bypasses RLS on the lookup and breaks the
-- cycle. `SET search_path = public` is mandatory on any SECURITY DEFINER
-- function so a caller cannot shadow `role_grants` with their own relation.

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.role_grants g
    WHERE g.user_id = public.user_id()
      AND g.role = 'super_admin'
      AND g.status = 'active'
  );
$$;

COMMENT ON FUNCTION public.is_platform_admin() IS
  'True when the JWT subject holds an active platform-wide super_admin grant. '
  'SECURITY DEFINER so RLS policies on role_grants can call it without recursing.';

CREATE OR REPLACE FUNCTION public.can_admin_space(p_space TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_admin()
    OR (
      p_space IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.role_grants g
        WHERE g.user_id = public.user_id()
          AND g.role = 'space_admin'
          AND g.space_id = p_space
          AND g.status = 'active'
      )
    );
$$;

COMMENT ON FUNCTION public.can_admin_space(TEXT) IS
  'True for a platform admin, or for an active space_admin of p_space. '
  'p_space NULL (a platform-wide grant row) is platform-admin-only by design. '
  'SECURITY DEFINER for the same anti-recursion reason as is_platform_admin().';

-- === RLS ==================================================================
--
-- Anon reads nothing: every policy is `TO authenticated`, and the anon role
-- never presents a JWT with a `sub`, so `public.user_id()` is NULL for it.
-- The service role bypasses RLS entirely and remains this phase's write path.

ALTER TABLE role_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_manager_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_grant_events ENABLE ROW LEVEL SECURITY;

-- role_grants: own grants, plus every grant an admin is scoped to.
CREATE POLICY "role_grants_select_own"
  ON role_grants FOR SELECT TO authenticated
  USING (user_id = (SELECT public.user_id()));

CREATE POLICY "role_grants_select_admin"
  ON role_grants FOR SELECT TO authenticated
  USING ((SELECT public.can_admin_space(space_id)));

-- community_manager_applications: own application, plus the reviewer's queue.
CREATE POLICY "cm_applications_select_own"
  ON community_manager_applications FOR SELECT TO authenticated
  USING (user_id = (SELECT public.user_id()));

CREATE POLICY "cm_applications_select_admin"
  ON community_manager_applications FOR SELECT TO authenticated
  USING ((SELECT public.can_admin_space(space_id)));

-- role_grant_events: the subject may read their own history; admins read the
-- history for their scope. Platform-wide rows (space_id NULL) are
-- platform-admin-only, per can_admin_space().
CREATE POLICY "role_grant_events_select_own"
  ON role_grant_events FOR SELECT TO authenticated
  USING (subject_user_id = (SELECT public.user_id()));

CREATE POLICY "role_grant_events_select_admin"
  ON role_grant_events FOR SELECT TO authenticated
  USING ((SELECT public.can_admin_space(space_id)));
