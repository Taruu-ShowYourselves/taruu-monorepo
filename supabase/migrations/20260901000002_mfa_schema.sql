-- =============================================================================
-- Issue #71 M2: MFA persistence - factors, recovery codes, pending challenges,
-- reauth tickets, security events, and the enforcement singleton.
-- Canonical: specs/mfa-architecture.md §5, specs/mfa-engineering-model.md §2-§5.
--
-- INERT ON ARRIVAL. Every table starts empty, `security_settings` is seeded
-- with mfa_enforcement_enabled = false, and no application code path reaches
-- these tables until the M3+ routes ship behind their own default-OFF flags.
-- Applying this migration changes no production behavior.
--
-- Design rules this file implements (do not relax piecemeal):
--   * MFA state lives in its own tables, never in columns on `users` - the
--     live "Users can update own profile" RLS policy is column-unrestricted,
--     so any security state on `users` would become self-writable the day
--     db.ts migrates onto the user-scoped client (engineering model §2.3).
--   * All tables: RLS enabled with NO policies + REVOKE from anon and
--     authenticated - the service-role-only house pattern. The exception is
--     a single owner-read policy on security_events, so users can see their
--     own security history.
--   * security_events is append-only via BEFORE-trigger + REVOKE, including
--     from service_role - RLS is never the append-only mechanism because the
--     service role bypasses RLS (mold: space_audit_log, 20260802000010).
--     No FK on user columns: the log must outlive its subject
--     (mold: role_grant_events, 20260802000002).
--   * Every operation whose atomicity carries a security invariant (single-use
--     consume, monotonic TOTP step, attempt counting, the multi-statement
--     disable) is a SECURITY DEFINER function here, not application code:
--     PostgREST cannot express `col = col + 1` or a multi-statement
--     transaction, and a conditional UPDATE ... RETURNING under row locking
--     is precisely the "exactly one concurrent winner" primitive the
--     engineering model requires (§5.5).
--   * CHECK constraints, not enum types (house rule; enum extension needs
--     two separately-applied migrations).
--
-- ROLLBACK (verbatim, order matters - functions first, then tables):
--   DROP FUNCTION IF EXISTS public.mfa_consume_pending_token(uuid, uuid);
--   DROP FUNCTION IF EXISTS public.mfa_record_pending_attempt(uuid, uuid);
--   DROP FUNCTION IF EXISTS public.mfa_accept_totp_step(uuid, uuid, bigint);
--   DROP FUNCTION IF EXISTS public.mfa_increment_confirm_attempts(uuid, uuid);
--   DROP FUNCTION IF EXISTS public.mfa_activate_factor(uuid, uuid, bigint, uuid, text[]);
--   DROP FUNCTION IF EXISTS public.mfa_consume_recovery_code(uuid, text);
--   DROP FUNCTION IF EXISTS public.mfa_regenerate_recovery_codes(uuid, uuid, text[]);
--   DROP FUNCTION IF EXISTS public.mfa_disable_factor(uuid, text);
--   DROP FUNCTION IF EXISTS public.users_bump_session_version(uuid);
--   DROP FUNCTION IF EXISTS public.reauth_consume_ticket(uuid, uuid, text, text[]);
--   DROP FUNCTION IF EXISTS public.security_events_append_only();
--   DROP TABLE IF EXISTS public.security_settings;
--   DROP TABLE IF EXISTS public.security_events;
--   DROP TABLE IF EXISTS public.reauth_tickets;
--   DROP TABLE IF EXISTS public.mfa_pending_tokens;
--   DROP TABLE IF EXISTS public.user_recovery_codes;
--   DROP TABLE IF EXISTS public.user_mfa_factors;
--
-- Apply discipline: single verbatim apply_migration, never apply-all
-- (version registry: specs/mfa-engineering-model.md §12.1).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. user_mfa_factors - one TOTP factor per user, secret encrypted at rest.
-- -----------------------------------------------------------------------------
CREATE TABLE public.user_mfa_factors (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  factor_type        TEXT NOT NULL CHECK (factor_type = 'totp'),
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'active', 'disabled')),
  -- AES-256-GCM: iv(12) || ciphertext || tag(16); AAD = user_id || id.
  -- The plaintext secret exists only in server memory during enroll/verify.
  secret_enc         BYTEA NOT NULL,
  enc_key_version    SMALLINT NOT NULL DEFAULT 1,
  -- Monotonic high-water mark of accepted TOTP time-steps (floor(unix/30)).
  -- The replay guard: a code for a step <= this value is dead forever.
  last_accepted_step BIGINT,
  confirm_attempts   SMALLINT NOT NULL DEFAULT 0,
  disabled_reason    TEXT CHECK (disabled_reason IN ('user', 'operator_reset')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at       TIMESTAMPTZ,
  disabled_at        TIMESTAMPTZ,
  last_used_at       TIMESTAMPTZ
);

COMMENT ON TABLE public.user_mfa_factors IS
  'TOTP factor per user (Issue #71, specs/mfa-architecture.md §5.1). Lifecycle '
  'pending -> active -> disabled; disabled rows are retained as audit history. '
  'The partial unique indexes make “two live factors” and “two in-flight '
  'enrollments” unrepresentable rather than merely forbidden.';

-- One live factor and one in-flight enrollment per user, structurally.
CREATE UNIQUE INDEX user_mfa_factors_one_active
  ON public.user_mfa_factors (user_id) WHERE status = 'active';
CREATE UNIQUE INDEX user_mfa_factors_one_pending
  ON public.user_mfa_factors (user_id) WHERE status = 'pending';
CREATE INDEX idx_user_mfa_factors_user_id ON public.user_mfa_factors (user_id);

ALTER TABLE public.user_mfa_factors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_mfa_factors FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. user_recovery_codes - SHA-256 hashes only; spend is a conditional UPDATE.
-- -----------------------------------------------------------------------------
CREATE TABLE public.user_recovery_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  batch_id   UUID NOT NULL,
  code_hash  TEXT NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, code_hash)
);

COMMENT ON TABLE public.user_recovery_codes IS
  'Recovery-code hashes (Issue #71, §5.2). Plaintext codes are shown exactly '
  'once at generation and never stored. Consumption is the conditional UPDATE '
  'in mfa_consume_recovery_code - double-spend is structurally impossible.';

CREATE INDEX idx_recovery_codes_user_live
  ON public.user_recovery_codes (user_id) WHERE used_at IS NULL;

ALTER TABLE public.user_recovery_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_recovery_codes FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. mfa_pending_tokens - THE authoritative login-challenge state. The
--    mfa_pending.v1 JWT is only a signed locator for a row here (§6.4a).
-- -----------------------------------------------------------------------------
CREATE TABLE public.mfa_pending_tokens (
  -- Equals the JWT jti; minted by the application, not defaulted here.
  id            UUID PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expires_at    TIMESTAMPTZ NOT NULL,
  consumed_at   TIMESTAMPTZ,
  attempt_count SMALLINT NOT NULL DEFAULT 0,
  ip_hash       TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mfa_pending_tokens IS
  'Authoritative MFA login-challenge state (Issue #71, §5.3/§6.4a). A '
  'cryptographically valid pending JWT is insufficient: the challenge is '
  'refused unless this row exists, is unexpired, unconsumed, and under the '
  'attempt ceiling. Rows past expires_at + 24h are deleted opportunistically '
  'at the next mint (kept briefly for abuse forensics).';

CREATE INDEX idx_mfa_pending_user ON public.mfa_pending_tokens (user_id, created_at);
-- The opportunistic expiry sweep (deleteExpiredPendingTokens, run at every
-- challenge mint) filters on expires_at alone - without this index it is a
-- sequential scan inside the login critical path.
CREATE INDEX idx_mfa_pending_expires ON public.mfa_pending_tokens (expires_at);

ALTER TABLE public.mfa_pending_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mfa_pending_tokens FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. reauth_tickets - single-use, purpose-bound step-up tickets (§5.4).
-- -----------------------------------------------------------------------------
CREATE TABLE public.reauth_tickets (
  id          UUID PRIMARY KEY,  -- equals the reauth.v1 JWT jti
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  purpose     TEXT NOT NULL CHECK (purpose IN
                ('mfa_disable', 'recovery_regenerate', 'operator_reset', 'security_settings')),
  method      TEXT NOT NULL CHECK (method IN ('totp', 'recovery', 'google')),
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.reauth_tickets IS
  'Step-up reauthentication tickets (Issue #71, §5.4/§7). The DB row is the '
  'authority over the JWT; consume is atomic and purpose-bound - a '
  'mfa_disable ticket can never authorize recovery_regenerate.';

CREATE INDEX idx_reauth_user ON public.reauth_tickets (user_id, created_at);

ALTER TABLE public.reauth_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reauth_tickets FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. security_events - append-only security audit. No FKs: the log outlives
--    its subject (a factor-deletion event must survive the user's deletion).
-- -----------------------------------------------------------------------------
CREATE TABLE public.security_events (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       UUID,          -- whom the event concerns; no FK by design
  actor_user_id UUID,          -- operator for admin actions; NULL = self/system
  event_type    TEXT NOT NULL CHECK (event_type IN (
                  'mfa_enrollment_started',
                  'mfa_enrollment_confirmed',
                  'mfa_enrollment_failed',
                  'totp_verification_success',
                  'totp_verification_failure',
                  'recovery_code_used',
                  'recovery_code_failed',
                  'recovery_codes_regenerated',
                  'mfa_disabled',
                  'mfa_reset_by_operator',
                  'reauth_success',
                  'reauth_failure',
                  'mfa_challenge_expired',
                  'mfa_challenge_replayed',
                  'session_version_revoked'
                )),
  ip_hash       TEXT,          -- SHA-256(ip + SECURITY_EVENT_PEPPER); raw IPs never stored
  user_agent    TEXT,          -- truncated to 256 chars by the writer
  reason        TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Operator resets carry mandatory evidence (mold: space_audit_log.reason).
  CONSTRAINT security_events_operator_reason CHECK (
    event_type <> 'mfa_reset_by_operator'
    OR (reason IS NOT NULL AND length(btrim(reason)) BETWEEN 10 AND 2000)
  )
);

COMMENT ON TABLE public.security_events IS
  'Append-only security audit for Issue #71 (§5.5/§8). Enforced by BEFORE '
  'UPDATE/DELETE/TRUNCATE triggers plus REVOKE - including from service_role, '
  'because the service role bypasses RLS. Tamper-resistant, not WORM: a '
  'superuser can still tamper. Retention: indefinite (decided §8.4); doubles '
  'as the durable rate-limit counter via the (user_id, event_type, created_at) '
  'index. Never stored here: TOTP secrets or codes, recovery codes (even '
  'hashed), raw tokens, raw IPs.';

-- Doubles as the rate-limit window index (§9).
CREATE INDEX idx_security_events_user_type_time
  ON public.security_events (user_id, event_type, created_at DESC);
CREATE INDEX idx_security_events_actor
  ON public.security_events (actor_user_id, created_at DESC)
  WHERE actor_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.security_events_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'security_events is append-only (attempted %)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END $$;

CREATE TRIGGER security_events_no_mutate
  BEFORE UPDATE OR DELETE ON public.security_events
  FOR EACH ROW EXECUTE FUNCTION public.security_events_append_only();

CREATE TRIGGER security_events_no_truncate
  BEFORE TRUNCATE ON public.security_events
  FOR EACH STATEMENT EXECUTE FUNCTION public.security_events_append_only();

REVOKE UPDATE, DELETE, TRUNCATE ON public.security_events FROM anon, authenticated, service_role;

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
REVOKE INSERT ON public.security_events FROM anon, authenticated;

-- Users may read their own security history (surfaces in settings/security).
-- Column-scoped: the subject sees event type/time/metadata - matching the
-- /api/security/status projection - but NOT the operator's identity
-- (actor_user_id), the free-text reason, or the forensic ip_hash/user_agent.
-- (/api/security/status itself reads via service_role, unaffected.)
REVOKE SELECT ON public.security_events FROM anon, authenticated;
GRANT SELECT (id, user_id, event_type, metadata, created_at)
  ON public.security_events TO authenticated;
CREATE POLICY "Users can read own security events"
  ON public.security_events FOR SELECT
  TO authenticated
  USING (user_id = (SELECT public.user_id()));

-- -----------------------------------------------------------------------------
-- 6. security_settings - the ONE global enforcement authority. No env var for
--    enforcement exists anywhere (canonical §5.6): the score trigger must read
--    this value, and the M8 flip must be transactional with the recompute.
-- -----------------------------------------------------------------------------
CREATE TABLE public.security_settings (
  id                      BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  mfa_enforcement_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.security_settings IS
  'One-row global security settings (Issue #71, §5.6). '
  'mfa_enforcement_enabled is the single source of truth for global MFA '
  'enforcement - no environment variable mirrors it. Flipping it is runbook '
  'DML, one transaction together with the security_score recompute '
  '(specs/mfa-engineering-model.md §5.7). Service-role writable only.';

INSERT INTO public.security_settings (id, mfa_enforcement_enabled) VALUES (TRUE, FALSE);

ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.security_settings FROM anon, authenticated;

-- =============================================================================
-- Atomic operations. Each SECURITY DEFINER + SET search_path = public (house
-- rule: a caller must not be able to shadow these relations), EXECUTE revoked
-- from PUBLIC/anon/authenticated and granted to service_role only.
-- =============================================================================

-- §6.4a: the challenge commit point. Exactly one concurrent caller receives
-- the row; only that winner may mint a session. Everyone else gets FALSE.
CREATE OR REPLACE FUNCTION public.mfa_consume_pending_token(p_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE mfa_pending_tokens
     SET consumed_at = now()
   WHERE id = p_id AND user_id = p_user_id
     AND consumed_at IS NULL
     AND expires_at > now()
     -- Mirrors MAX_ROW_ATTEMPTS = 5 in the application
     -- (apps/web/src/app/api/auth/mfa/verify/route.ts). Change BOTH together;
     -- supabase/tests/security_mfa.sql asserts the DB ceiling sits at 5.
     AND attempt_count < 5
  RETURNING TRUE;
$$;

-- Durable per-token failure counter (§9). Returns the new count, or NULL when
-- the row is missing/consumed (callers treat NULL as "challenge dead").
CREATE OR REPLACE FUNCTION public.mfa_record_pending_attempt(p_id UUID, p_user_id UUID)
RETURNS SMALLINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE mfa_pending_tokens
     SET attempt_count = attempt_count + 1
   WHERE id = p_id AND user_id = p_user_id
     AND consumed_at IS NULL
  RETURNING attempt_count;
$$;

-- §6.4b: the monotonic TOTP step guard. FALSE when a concurrent request
-- already accepted an equal-or-newer step - the same code can never be
-- accepted twice, including two simultaneous submissions.
CREATE OR REPLACE FUNCTION public.mfa_accept_totp_step(
  p_factor_id UUID, p_user_id UUID, p_step BIGINT
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE user_mfa_factors
     SET last_accepted_step = p_step, last_used_at = now()
   WHERE id = p_factor_id AND user_id = p_user_id
     AND status = 'active'
     AND (last_accepted_step IS NULL OR last_accepted_step < p_step)
  RETURNING TRUE;
$$;

-- Durable enrollment-confirm failure counter (§9). NULL when no pending row.
CREATE OR REPLACE FUNCTION public.mfa_increment_confirm_attempts(p_factor_id UUID, p_user_id UUID)
RETURNS SMALLINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE user_mfa_factors
     SET confirm_attempts = confirm_attempts + 1
   WHERE id = p_factor_id AND user_id = p_user_id
     AND status = 'pending'
  RETURNING confirm_attempts;
$$;

-- §6.1 confirm, as one transaction: pending -> active (confirmed_at set
-- exactly once), the accepted step recorded, and the first recovery-code
-- batch inserted. FALSE when the pending row is gone or was already
-- activated - the caller restarts enrollment.
CREATE OR REPLACE FUNCTION public.mfa_activate_factor(
  p_factor_id UUID, p_user_id UUID, p_step BIGINT, p_batch_id UUID, p_code_hashes TEXT[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  activated UUID;
BEGIN
  UPDATE user_mfa_factors
     SET status = 'active',
         confirmed_at = now(),
         last_accepted_step = p_step,
         last_used_at = now()
   WHERE id = p_factor_id AND user_id = p_user_id
     AND status = 'pending'
     AND (last_accepted_step IS NULL OR last_accepted_step < p_step)
  RETURNING id INTO activated;

  IF activated IS NULL THEN
    RETURN FALSE;
  END IF;

  INSERT INTO user_recovery_codes (user_id, batch_id, code_hash)
  SELECT p_user_id, p_batch_id, unnest(p_code_hashes);

  RETURN TRUE;
END $$;

-- §5.2: atomic recovery-code spend. Exactly one concurrent consumer can win.
CREATE OR REPLACE FUNCTION public.mfa_consume_recovery_code(p_user_id UUID, p_code_hash TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE user_recovery_codes
     SET used_at = now()
   WHERE user_id = p_user_id AND code_hash = p_code_hash
     AND used_at IS NULL
  RETURNING TRUE;
$$;

-- §6.2 regeneration, one transaction: delete the prior batch entirely
-- (history lives in security_events), insert the new one. Returns how many
-- unused codes the old batch still had (event metadata).
CREATE OR REPLACE FUNCTION public.mfa_regenerate_recovery_codes(
  p_user_id UUID, p_batch_id UUID, p_code_hashes TEXT[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  previous_unused INTEGER;
BEGIN
  SELECT count(*) INTO previous_unused
    FROM user_recovery_codes
   WHERE user_id = p_user_id AND used_at IS NULL;

  DELETE FROM user_recovery_codes WHERE user_id = p_user_id;

  INSERT INTO user_recovery_codes (user_id, batch_id, code_hash)
  SELECT p_user_id, p_batch_id, unnest(p_code_hashes);

  RETURN previous_unused;
END $$;

-- Model B revocation: bump and return the new version. Every session/refresh/
-- legacy token stamped with an older sv dies at the next request.
CREATE OR REPLACE FUNCTION public.users_bump_session_version(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE users
     SET session_version = session_version + 1
   WHERE id = p_user_id
  RETURNING session_version;
$$;

-- §6.3 / §7.3, one transaction: disable the active factor (row retained,
-- reason recorded), delete every unused recovery code, and bump
-- session_version. The security_score recompute fires via the factor-status
-- trigger installed by 20260901000003. FALSE when no active factor exists.
CREATE OR REPLACE FUNCTION public.mfa_disable_factor(p_user_id UUID, p_reason TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  disabled UUID;
BEGIN
  IF p_reason NOT IN ('user', 'operator_reset') THEN
    RAISE EXCEPTION 'invalid disable reason %', p_reason;
  END IF;

  UPDATE user_mfa_factors
     SET status = 'disabled',
         disabled_at = now(),
         disabled_reason = p_reason
   WHERE user_id = p_user_id AND status = 'active'
  RETURNING id INTO disabled;

  IF disabled IS NULL THEN
    RETURN FALSE;
  END IF;

  DELETE FROM user_recovery_codes WHERE user_id = p_user_id AND used_at IS NULL;

  PERFORM users_bump_session_version(p_user_id);

  RETURN TRUE;
END $$;

-- §5.4/§7.2: atomic, purpose-bound AND method-bound ticket consume. Binding
-- `method` at consume - not only at mint - makes "operator_reset is TOTP
-- only" defence in depth: the caller passes the methods its policy permits
-- for the action, and a ticket recorded with any other method never consumes
-- even if one were somehow minted. p_allowed_methods NULL means "any method"
-- (the user-facing purposes, where the matrix already constrained mint).
CREATE OR REPLACE FUNCTION public.reauth_consume_ticket(
  p_id UUID, p_user_id UUID, p_purpose TEXT, p_allowed_methods TEXT[] DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE reauth_tickets
     SET consumed_at = now()
   WHERE id = p_id AND user_id = p_user_id
     AND purpose = p_purpose
     AND (p_allowed_methods IS NULL OR method = ANY(p_allowed_methods))
     AND consumed_at IS NULL
     AND expires_at > now()
  RETURNING TRUE;
$$;

-- Function ACL hygiene (PR-A's exact pattern): the PUBLIC default EXECUTE is
-- withdrawn, and only the service role may call these.
REVOKE EXECUTE ON FUNCTION public.mfa_consume_pending_token(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mfa_record_pending_attempt(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mfa_accept_totp_step(UUID, UUID, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mfa_increment_confirm_attempts(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mfa_activate_factor(UUID, UUID, BIGINT, UUID, TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mfa_consume_recovery_code(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mfa_regenerate_recovery_codes(UUID, UUID, TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.users_bump_session_version(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mfa_disable_factor(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reauth_consume_ticket(UUID, UUID, TEXT, TEXT[]) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mfa_consume_pending_token(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.mfa_record_pending_attempt(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.mfa_accept_totp_step(UUID, UUID, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.mfa_increment_confirm_attempts(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.mfa_activate_factor(UUID, UUID, BIGINT, UUID, TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.mfa_consume_recovery_code(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.mfa_regenerate_recovery_codes(UUID, UUID, TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.users_bump_session_version(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.mfa_disable_factor(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reauth_consume_ticket(UUID, UUID, TEXT, TEXT[]) TO service_role;
