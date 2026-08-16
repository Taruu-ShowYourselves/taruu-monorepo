-- =============================================================================
-- Issue #71 M2: users.security_score - DB-owned security posture score.
-- Canonical: specs/mfa-architecture.md §10.2 (FORMULA LOCKED),
-- specs/mfa-engineering-model.md §6.
--
-- THE FORMULA (both conditions, nothing else):
--   security_score(u) = 20 iff EXISTS (user_mfa_factors WHERE user_id = u
--                                        AND status = 'active')
--                          AND (SELECT mfa_enforcement_enabled
--                                 FROM security_settings)
--                      else 0
--
-- INERT ON ARRIVAL: no factors exist and enforcement is seeded false, so
-- every user's score is (and stays) 0 until the M8 enforcement flip.
--
-- SINGLE WRITER: the database. Application code never writes this column
-- (the repo-wide guard test greps for it), and voting/eligibility code never
-- reads it (canonical §10.4 - MFA must never increase voting eligibility;
-- the ballot gate is identity_score >= 40 AND explicit residency, and no
-- function or view in this database may combine the two scores).
--
-- ENFORCEMENT FLIP RUNBOOK (M8 step 4 - runbook DML, never a migration; the
-- trigger below cannot see settings changes, so the recompute is explicit
-- and transactional with the flip). The session_version bump is REQUIRED,
-- not optional: the session path (getSessionFromRequest) does not consult
-- required assurance - only the refresh route does - so without the bump an
-- already-enrolled user's outstanding sf session keeps full access for up to
-- the 1h TTL after enforcement goes live, unchallenged. The bump forces every
-- enrolled user through the challenge on their next request. It costs one
-- indexed UPDATE.
--   BEGIN;
--     UPDATE public.security_settings SET mfa_enforcement_enabled = TRUE, updated_at = now();
--     UPDATE public.users u SET security_score = public.calculate_security_score(u.id)
--      WHERE EXISTS (SELECT 1 FROM public.user_mfa_factors f
--                     WHERE f.user_id = u.id AND f.status = 'active');
--     UPDATE public.users u SET session_version = session_version + 1
--      WHERE EXISTS (SELECT 1 FROM public.user_mfa_factors f
--                     WHERE f.user_id = u.id AND f.status = 'active');
--   COMMIT;
-- Rollback flip: same transaction with FALSE and the recompute (which writes
-- 0); no bump on rollback - relaxing enforcement need not revoke sessions.
--
-- ROLLBACK (verbatim):
--   DROP TRIGGER IF EXISTS trigger_security_score_on_factor_change ON public.user_mfa_factors;
--   DROP FUNCTION IF EXISTS public.sync_security_score_on_factor_change();
--   DROP FUNCTION IF EXISTS public.calculate_security_score(UUID);
--   ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_security_score_range;
--   ALTER TABLE public.users DROP COLUMN IF EXISTS security_score;
--
-- Apply discipline: single verbatim apply_migration after 20260901000002,
-- never apply-all.
-- =============================================================================

ALTER TABLE public.users
  ADD COLUMN security_score INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.users
  ADD CONSTRAINT users_security_score_range
  CHECK (security_score >= 0 AND security_score <= 20);

COMMENT ON COLUMN public.users.security_score IS
  'Security posture score (Issue #71, canonical §10.2 - formula locked). '
  '20 iff an active MFA factor exists AND security_settings.mfa_enforcement_enabled; '
  'else 0. DB-owned: written only by the factor trigger and the M8 flip '
  'runbook. Display only - never an input to voting eligibility.';

-- STABLE + SECURITY DEFINER + pinned search_path: the same discipline as
-- calculate_identity_score (20260807000001). uuid-keyed rather than
-- row-typed because the factor trigger fires on user_mfa_factors, not users.
CREATE OR REPLACE FUNCTION public.calculate_security_score(target_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM user_mfa_factors f
                  WHERE f.user_id = target_user_id AND f.status = 'active')
     AND (SELECT mfa_enforcement_enabled FROM security_settings)
    THEN 20
    ELSE 0
  END;
$$;

-- Recompute the affected user whenever factor state changes. Enforcement
-- flips do NOT fire this trigger - that is why the M8 runbook recomputes
-- explicitly in the same transaction as the flip (header above).
CREATE OR REPLACE FUNCTION public.sync_security_score_on_factor_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected UUID;
BEGIN
  -- On DELETE, PL/pgSQL leaves NEW unassigned - reading NEW.user_id raises
  -- (SQLSTATE 55000), so branch on TG_OP like update_user_identity_score
  -- (20240101000002_functions.sql), this trigger's mold.
  IF TG_OP = 'DELETE' THEN
    affected := OLD.user_id;
  ELSE
    affected := NEW.user_id;
  END IF;
  UPDATE users
     SET security_score = calculate_security_score(affected)
   WHERE id = affected;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trigger_security_score_on_factor_change
  AFTER INSERT OR UPDATE OF status OR DELETE ON public.user_mfa_factors
  FOR EACH ROW EXECUTE FUNCTION public.sync_security_score_on_factor_change();

-- ACL hygiene (PR-A pattern): trigger firing does not check the DML issuer's
-- EXECUTE privilege, so revoking is safe and closes the direct-call surface.
REVOKE EXECUTE ON FUNCTION public.calculate_security_score(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_security_score_on_factor_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_security_score(UUID) TO service_role;
