-- Manual evidence probe: Issue #71 MFA schema - score trigger matrix,
-- append-only security_events, and the atomic consume/replay primitives.
--
-- HOW TO RUN
--   supabase db reset                      # or apply migrations to a scratch DB
--   psql "$SCRATCH_DATABASE_URL" -f supabase/tests/security_mfa.sql
--
-- THIS IS NOT PART OF `pnpm test`. apps/web/vitest.config.ts runs with
-- environment: 'node' and Supabase fully mocked, so there is no live-database
-- harness in CI (same status as audit_append_only.sql and PR-A's
-- identity_score_triggers.sql). The transcript is captured by hand as
-- migration evidence. Do not claim CI coverage for it anywhere.
--
-- Every case prints exactly one PASS or FAIL line. A clean run prints
-- twenty-two PASS lines and no FAIL lines. Run against a throwaway database
-- and only once per reset: the probe leaves its rows behind on purpose - the
-- security_events row it appends cannot be deleted, which is the point.

\set ON_ERROR_STOP off
\timing off

BEGIN;

-- ---------------------------------------------------------------------------
-- Fixtures. Deterministic UUIDs so the assertions below can reference them.
-- ---------------------------------------------------------------------------
INSERT INTO public.users (id, email)
VALUES ('00000000-0000-4000-8000-00000000d001', 'mfa-probe-user@example.test')
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ===========================================================================
-- A. Score trigger matrix (canonical §10.2 - both conditions, nothing else)
-- ===========================================================================

-- Case A1: a pending factor scores 0.
DO $$
DECLARE score INT;
BEGIN
  INSERT INTO public.user_mfa_factors (id, user_id, factor_type, status, secret_enc)
  VALUES ('00000000-0000-4000-8000-00000000f001',
          '00000000-0000-4000-8000-00000000d001', 'totp', 'pending', '\x00'::bytea);
  SELECT security_score INTO score FROM public.users
   WHERE id = '00000000-0000-4000-8000-00000000d001';
  IF score = 0 THEN
    RAISE NOTICE 'PASS: pending factor scores 0';
  ELSE
    RAISE NOTICE 'FAIL: pending factor scored % (want 0)', score;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL: pending insert errored (% / %)', SQLSTATE, SQLERRM;
END $$;

-- Case A2 (the §10.2 rollout consequence): an ACTIVE factor under
-- enforcement-OFF still scores 0. Posture is claimed only when enforced.
DO $$
DECLARE score INT; ok BOOLEAN;
BEGIN
  SELECT public.mfa_activate_factor(
    '00000000-0000-4000-8000-00000000f001',
    '00000000-0000-4000-8000-00000000d001',
    1000, '00000000-0000-4000-8000-00000000b001',
    ARRAY['hash-one','hash-two','hash-three']) INTO ok;
  SELECT security_score INTO score FROM public.users
   WHERE id = '00000000-0000-4000-8000-00000000d001';
  IF ok AND score = 0 THEN
    RAISE NOTICE 'PASS: active factor + enforcement OFF scores 0';
  ELSE
    RAISE NOTICE 'FAIL: activate=%, score=% (want true, 0)', ok, score;
  END IF;
END $$;

-- Case A3: the M8 flip transaction awards +20 AND bumps session_version for
-- enrolled users, so outstanding sf sessions die on their next request
-- rather than surviving the 1h TTL unchallenged.
DO $$
DECLARE score INT; sv_before INT; sv_after INT;
BEGIN
  SELECT session_version INTO sv_before FROM public.users
   WHERE id = '00000000-0000-4000-8000-00000000d001';
  UPDATE public.security_settings SET mfa_enforcement_enabled = TRUE, updated_at = now();
  UPDATE public.users u SET security_score = public.calculate_security_score(u.id)
   WHERE EXISTS (SELECT 1 FROM public.user_mfa_factors f
                  WHERE f.user_id = u.id AND f.status = 'active');
  UPDATE public.users u SET session_version = session_version + 1
   WHERE EXISTS (SELECT 1 FROM public.user_mfa_factors f
                  WHERE f.user_id = u.id AND f.status = 'active');
  SELECT security_score, session_version INTO score, sv_after FROM public.users
   WHERE id = '00000000-0000-4000-8000-00000000d001';
  IF score = 20 AND sv_after = sv_before + 1 THEN
    RAISE NOTICE 'PASS: enforcement flip awards 20 and bumps session_version';
  ELSE
    RAISE NOTICE 'FAIL: post-flip score % (want 20), sv %->% (want +1)', score, sv_before, sv_after;
  END IF;
END $$;

-- Case A4: the reverse flip recomputes to 0 with the factor still active.
DO $$
DECLARE score INT;
BEGIN
  UPDATE public.security_settings SET mfa_enforcement_enabled = FALSE, updated_at = now();
  UPDATE public.users u SET security_score = public.calculate_security_score(u.id)
   WHERE EXISTS (SELECT 1 FROM public.user_mfa_factors f
                  WHERE f.user_id = u.id AND f.status = 'active');
  SELECT security_score INTO score FROM public.users
   WHERE id = '00000000-0000-4000-8000-00000000d001';
  IF score = 0 THEN
    RAISE NOTICE 'PASS: reverse flip recomputes to 0';
  ELSE
    RAISE NOTICE 'FAIL: post-reverse score % (want 0)', score;
  END IF;
  -- Leave enforcement ON for the disable case below.
  UPDATE public.security_settings SET mfa_enforcement_enabled = TRUE, updated_at = now();
  UPDATE public.users u SET security_score = public.calculate_security_score(u.id)
   WHERE EXISTS (SELECT 1 FROM public.user_mfa_factors f
                  WHERE f.user_id = u.id AND f.status = 'active');
END $$;

-- ===========================================================================
-- B. The TOTP monotonic step guard (§6.4b)
-- ===========================================================================

-- Case B1: a strictly newer step is accepted.
DO $$
DECLARE ok BOOLEAN;
BEGIN
  SELECT public.mfa_accept_totp_step(
    '00000000-0000-4000-8000-00000000f001',
    '00000000-0000-4000-8000-00000000d001', 1001) INTO ok;
  IF ok THEN
    RAISE NOTICE 'PASS: newer TOTP step accepted';
  ELSE
    RAISE NOTICE 'FAIL: newer TOTP step refused';
  END IF;
END $$;

-- Case B2: replaying the same step is refused - the same code can never be
-- accepted twice.
DO $$
DECLARE ok BOOLEAN;
BEGIN
  SELECT public.mfa_accept_totp_step(
    '00000000-0000-4000-8000-00000000f001',
    '00000000-0000-4000-8000-00000000d001', 1001) INTO ok;
  IF ok IS NULL OR NOT ok THEN
    RAISE NOTICE 'PASS: same-step replay refused';
  ELSE
    RAISE NOTICE 'FAIL: same-step replay accepted';
  END IF;
END $$;

-- Case B3: an older step inside the skew window is refused.
DO $$
DECLARE ok BOOLEAN;
BEGIN
  SELECT public.mfa_accept_totp_step(
    '00000000-0000-4000-8000-00000000f001',
    '00000000-0000-4000-8000-00000000d001', 1000) INTO ok;
  IF ok IS NULL OR NOT ok THEN
    RAISE NOTICE 'PASS: older-step replay refused';
  ELSE
    RAISE NOTICE 'FAIL: older-step replay accepted';
  END IF;
END $$;

-- ===========================================================================
-- C. Recovery-code single use (§5.2)
-- ===========================================================================

-- Case C1: first spend wins; Case C2: second spend of the same code loses.
DO $$
DECLARE first BOOLEAN; second BOOLEAN;
BEGIN
  SELECT public.mfa_consume_recovery_code(
    '00000000-0000-4000-8000-00000000d001', 'hash-one') INTO first;
  SELECT public.mfa_consume_recovery_code(
    '00000000-0000-4000-8000-00000000d001', 'hash-one') INTO second;
  IF first AND (second IS NULL OR NOT second) THEN
    RAISE NOTICE 'PASS: recovery code spent exactly once';
  ELSE
    RAISE NOTICE 'FAIL: first=%, second=% (want true, false/null)', first, second;
  END IF;
END $$;

-- ===========================================================================
-- D. Pending-challenge authority (§6.4a)
-- ===========================================================================

-- Case D1: consume wins once, replay loses.
DO $$
DECLARE first BOOLEAN; second BOOLEAN;
BEGIN
  INSERT INTO public.mfa_pending_tokens (id, user_id, expires_at)
  VALUES ('00000000-0000-4000-8000-00000000e001',
          '00000000-0000-4000-8000-00000000d001', now() + interval '5 minutes');
  SELECT public.mfa_consume_pending_token(
    '00000000-0000-4000-8000-00000000e001',
    '00000000-0000-4000-8000-00000000d001') INTO first;
  SELECT public.mfa_consume_pending_token(
    '00000000-0000-4000-8000-00000000e001',
    '00000000-0000-4000-8000-00000000d001') INTO second;
  IF first AND (second IS NULL OR NOT second) THEN
    RAISE NOTICE 'PASS: pending token consumed exactly once';
  ELSE
    RAISE NOTICE 'FAIL: first=%, second=% (want true, false/null)', first, second;
  END IF;
END $$;

-- Case D2: an expired pending token cannot be consumed.
DO $$
DECLARE ok BOOLEAN;
BEGIN
  INSERT INTO public.mfa_pending_tokens (id, user_id, expires_at)
  VALUES ('00000000-0000-4000-8000-00000000e002',
          '00000000-0000-4000-8000-00000000d001', now() - interval '1 minute');
  SELECT public.mfa_consume_pending_token(
    '00000000-0000-4000-8000-00000000e002',
    '00000000-0000-4000-8000-00000000d001') INTO ok;
  IF ok IS NULL OR NOT ok THEN
    RAISE NOTICE 'PASS: expired pending token refused';
  ELSE
    RAISE NOTICE 'FAIL: expired pending token consumed';
  END IF;
END $$;

-- Case D3: an attempt-exhausted token can never be consumed, and the durable
-- counter reports the exhaustion.
DO $$
DECLARE ok BOOLEAN; n SMALLINT;
BEGIN
  INSERT INTO public.mfa_pending_tokens (id, user_id, expires_at)
  VALUES ('00000000-0000-4000-8000-00000000e003',
          '00000000-0000-4000-8000-00000000d001', now() + interval '5 minutes');
  FOR i IN 1..5 LOOP
    SELECT public.mfa_record_pending_attempt(
      '00000000-0000-4000-8000-00000000e003',
      '00000000-0000-4000-8000-00000000d001') INTO n;
  END LOOP;
  SELECT public.mfa_consume_pending_token(
    '00000000-0000-4000-8000-00000000e003',
    '00000000-0000-4000-8000-00000000d001') INTO ok;
  IF n = 5 AND (ok IS NULL OR NOT ok) THEN
    RAISE NOTICE 'PASS: exhausted pending token refused after 5 attempts';
  ELSE
    RAISE NOTICE 'FAIL: attempts=%, consume=% (want 5, false/null)', n, ok;
  END IF;
END $$;

-- ===========================================================================
-- E. Reauth tickets (§5.4)
-- ===========================================================================

-- Case E1: a ticket consumed under the wrong purpose is refused, then the
-- right purpose wins exactly once.
DO $$
DECLARE wrong_purpose BOOLEAN; correct BOOLEAN; replay BOOLEAN;
BEGIN
  INSERT INTO public.reauth_tickets (id, user_id, purpose, method, expires_at)
  VALUES ('00000000-0000-4000-8000-00000000a001',
          '00000000-0000-4000-8000-00000000d001', 'mfa_disable', 'totp',
          now() + interval '5 minutes');
  SELECT public.reauth_consume_ticket(
    '00000000-0000-4000-8000-00000000a001',
    '00000000-0000-4000-8000-00000000d001', 'recovery_regenerate') INTO wrong_purpose;
  SELECT public.reauth_consume_ticket(
    '00000000-0000-4000-8000-00000000a001',
    '00000000-0000-4000-8000-00000000d001', 'mfa_disable') INTO correct;
  SELECT public.reauth_consume_ticket(
    '00000000-0000-4000-8000-00000000a001',
    '00000000-0000-4000-8000-00000000d001', 'mfa_disable') INTO replay;
  IF (wrong_purpose IS NULL OR NOT wrong_purpose) AND correct
     AND (replay IS NULL OR NOT replay) THEN
    RAISE NOTICE 'PASS: ticket purpose-bound and single-use';
  ELSE
    RAISE NOTICE 'FAIL: wrong_purpose=%, correct=%, replay=%', wrong_purpose, correct, replay;
  END IF;
END $$;

-- Case E2 (§7.2 defence in depth): a recovery-minted ticket cannot be
-- consumed under a TOTP-only allowlist even with the right purpose.
DO $$
DECLARE wrong_method BOOLEAN; right_method BOOLEAN;
BEGIN
  INSERT INTO public.reauth_tickets (id, user_id, purpose, method, expires_at)
  VALUES ('00000000-0000-4000-8000-00000000a002',
          '00000000-0000-4000-8000-00000000d001', 'operator_reset', 'recovery',
          now() + interval '5 minutes');
  SELECT public.reauth_consume_ticket(
    '00000000-0000-4000-8000-00000000a002',
    '00000000-0000-4000-8000-00000000d001', 'operator_reset', ARRAY['totp']) INTO wrong_method;
  INSERT INTO public.reauth_tickets (id, user_id, purpose, method, expires_at)
  VALUES ('00000000-0000-4000-8000-00000000a003',
          '00000000-0000-4000-8000-00000000d001', 'operator_reset', 'totp',
          now() + interval '5 minutes');
  SELECT public.reauth_consume_ticket(
    '00000000-0000-4000-8000-00000000a003',
    '00000000-0000-4000-8000-00000000d001', 'operator_reset', ARRAY['totp']) INTO right_method;
  IF (wrong_method IS NULL OR NOT wrong_method) AND right_method THEN
    RAISE NOTICE 'PASS: ticket method-bound (recovery refused under TOTP-only allowlist)';
  ELSE
    RAISE NOTICE 'FAIL: wrong_method=%, right_method=%', wrong_method, right_method;
  END IF;
END $$;

-- ===========================================================================
-- F. Disable transaction (§6.3) + Model B bump
-- ===========================================================================

DO $$
DECLARE ok BOOLEAN; sv_before INT; sv_after INT; live_codes INT; score INT; fstatus TEXT;
BEGIN
  SELECT session_version INTO sv_before FROM public.users
   WHERE id = '00000000-0000-4000-8000-00000000d001';
  SELECT public.mfa_disable_factor(
    '00000000-0000-4000-8000-00000000d001', 'user') INTO ok;
  SELECT session_version, security_score INTO sv_after, score FROM public.users
   WHERE id = '00000000-0000-4000-8000-00000000d001';
  SELECT count(*) INTO live_codes FROM public.user_recovery_codes
   WHERE user_id = '00000000-0000-4000-8000-00000000d001' AND used_at IS NULL;
  SELECT status INTO fstatus FROM public.user_mfa_factors
   WHERE id = '00000000-0000-4000-8000-00000000f001';
  IF ok AND fstatus = 'disabled' AND live_codes = 0
     AND sv_after = sv_before + 1 AND score = 0 THEN
    RAISE NOTICE 'PASS: disable = factor disabled + codes gone + sv bumped + score 0';
  ELSE
    RAISE NOTICE 'FAIL: ok=%, status=%, live_codes=%, sv %->%, score=%',
      ok, fstatus, live_codes, sv_before, sv_after, score;
  END IF;
  -- Restore enforcement OFF (the seeded state) for anything run after us.
  UPDATE public.security_settings SET mfa_enforcement_enabled = FALSE, updated_at = now();
END $$;

-- Case F2: disabling again (no active factor) reports FALSE, not an error.
DO $$
DECLARE ok BOOLEAN;
BEGIN
  SELECT public.mfa_disable_factor(
    '00000000-0000-4000-8000-00000000d001', 'user') INTO ok;
  IF ok IS NULL OR NOT ok THEN
    RAISE NOTICE 'PASS: double disable is a no-op FALSE';
  ELSE
    RAISE NOTICE 'FAIL: double disable claimed success';
  END IF;
END $$;

-- ===========================================================================
-- G. security_events append-only (§8) - the space_audit_log mold, including
--    the service_role REVOKE.
-- ===========================================================================

-- Case G1: a valid append lands.
DO $$
DECLARE appended BIGINT;
BEGIN
  INSERT INTO public.security_events (user_id, event_type, metadata)
  VALUES ('00000000-0000-4000-8000-00000000d001', 'mfa_disabled',
          '{"trigger":"mfa_disable"}'::jsonb)
  RETURNING id INTO appended;
  IF appended IS NOT NULL THEN
    RAISE NOTICE 'PASS: security event appended (%)', appended;
  ELSE
    RAISE NOTICE 'FAIL: valid append returned no id';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL: valid append rejected (% / %)', SQLSTATE, SQLERRM;
END $$;

-- Case G2: UPDATE refused (42501).
DO $$
BEGIN
  UPDATE public.security_events SET reason = 'tampered'
   WHERE user_id = '00000000-0000-4000-8000-00000000d001';
  RAISE NOTICE 'FAIL: UPDATE on security_events succeeded';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: UPDATE refused with SQLSTATE %', SQLSTATE;
  WHEN OTHERS THEN
    RAISE NOTICE 'FAIL: UPDATE refused with unexpected SQLSTATE % (%)', SQLSTATE, SQLERRM;
END $$;

-- Case G3: DELETE refused (42501).
DO $$
BEGIN
  DELETE FROM public.security_events
   WHERE user_id = '00000000-0000-4000-8000-00000000d001';
  RAISE NOTICE 'FAIL: DELETE on security_events succeeded';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: DELETE refused with SQLSTATE %', SQLSTATE;
  WHEN OTHERS THEN
    RAISE NOTICE 'FAIL: DELETE refused with unexpected SQLSTATE % (%)', SQLSTATE, SQLERRM;
END $$;

-- Case G4: TRUNCATE refused (42501) - the statement trigger fires even though
-- TRUNCATE bypasses row triggers.
DO $$
BEGIN
  TRUNCATE public.security_events;
  RAISE NOTICE 'FAIL: TRUNCATE on security_events succeeded';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: TRUNCATE refused with SQLSTATE %', SQLSTATE;
  WHEN OTHERS THEN
    RAISE NOTICE 'FAIL: TRUNCATE refused with unexpected SQLSTATE % (%)', SQLSTATE, SQLERRM;
END $$;

-- Case G5: mutation refused even AS the service role - REVOKE covers what the
-- trigger already blocks, and BYPASSRLS is irrelevant to either.
DO $$
BEGIN
  SET LOCAL ROLE service_role;
  UPDATE public.security_events SET reason = 'service tamper'
   WHERE user_id = '00000000-0000-4000-8000-00000000d001';
  RESET ROLE;
  RAISE NOTICE 'FAIL: service_role UPDATE succeeded';
EXCEPTION
  WHEN insufficient_privilege THEN
    RESET ROLE;
    RAISE NOTICE 'PASS: service_role UPDATE refused with SQLSTATE %', SQLSTATE;
  WHEN OTHERS THEN
    RESET ROLE;
    RAISE NOTICE 'FAIL: service_role UPDATE refused with unexpected SQLSTATE % (%)', SQLSTATE, SQLERRM;
END $$;

-- Case G6: an operator reset event without a substantive reason is refused
-- by CHECK (23514).
DO $$
BEGIN
  INSERT INTO public.security_events (user_id, actor_user_id, event_type, reason)
  VALUES ('00000000-0000-4000-8000-00000000d001',
          '00000000-0000-4000-8000-00000000d001', 'mfa_reset_by_operator', 'short');
  RAISE NOTICE 'FAIL: operator reset without substantive reason accepted';
EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE 'PASS: operator reset reason CHECK enforced (SQLSTATE %)', SQLSTATE;
  WHEN OTHERS THEN
    RAISE NOTICE 'FAIL: unexpected SQLSTATE % (%)', SQLSTATE, SQLERRM;
END $$;

-- ===========================================================================
-- H. security_settings is a true singleton
-- ===========================================================================

DO $$
BEGIN
  INSERT INTO public.security_settings (id, mfa_enforcement_enabled) VALUES (FALSE, TRUE);
  RAISE NOTICE 'FAIL: second security_settings row accepted';
EXCEPTION
  WHEN check_violation OR unique_violation THEN
    RAISE NOTICE 'PASS: second settings row refused (SQLSTATE %)', SQLSTATE;
  WHEN OTHERS THEN
    RAISE NOTICE 'FAIL: unexpected SQLSTATE % (%)', SQLSTATE, SQLERRM;
END $$;
