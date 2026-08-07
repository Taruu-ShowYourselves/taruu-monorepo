-- Identity score unification (Issue #71 prerequisite, PR-A)
--
-- Makes the database the SINGLE writer of users.identity_score and installs
-- the ratified final model (Issue #71 decisions D1-D8):
--
--   google 40 / approved identity document (OCR) 40 / GPS 20 / phone 10 /
--   facebook 10 / instagram 10 / x 10 (dormant, see PR-X note), capped at 140.
--
-- Replaces the 2024 formula (google 40 / facebook 30 / instagram 30, no GPS,
-- no phone, no document) from 20240101000002_functions.sql. All
-- application-side identity_score writes are removed in the same PR; from this
-- migration on, the score is derived state owned by these functions and
-- triggers only. The identity-document (+40) input activates only through
-- users.identity_verified_at, which after PR-A the OCR submission flow can no
-- longer set from client-asserted signals; it stays NULL until the PR-10
-- operator-approval flow writes it (decision F-1).
--
-- Idempotent: CREATE OR REPLACE + DROP/ADD CONSTRAINT + DROP TRIGGER IF
-- EXISTS + a no-op-safe backfill. Re-running it converges to the same state.
--
-- SCHEMA DEPENDENCY (O-3): calculate_identity_score(users) takes the users
-- ROW TYPE. While it exists, columns of users referenced anywhere cannot be
-- DROPPED (ALTER TABLE users DROP COLUMN ... fails with a dependency error);
-- ADD COLUMN is unaffected. To drop a users column, first drop or redefine
-- this function in the same migration.
--
-- PR-X ENUM DISCIPLINE (G-1): the CASE arm for provider 'x' below is dormant
-- (social_provider has no 'x' value yet) and is proven inert by the trigger
-- test suite. When PR-X lands it MUST use two separately applied migrations:
--   1. ALTER TYPE social_provider ADD VALUE 'x';
--   2. (separate migration/transaction) any INSERT/UPDATE using 'x'.
-- Using a new enum value in the transaction that adds it fails with
-- "unsafe use of new value" - do not merge the two.
--
-- APPLY DISCIPLINE (G-3): production's migration ledger has drift (several
-- repo migrations are intentionally unapplied). EVERY migration-bearing PR
-- must apply its file individually (Supabase MCP apply_migration with the
-- verbatim body) and verify the ledger before and after. Never run an
-- "apply all pending" command against production.
--
-- ROLLOUT ORDER (two-stage; the reverse is unsafe):
--   1. Deploy the application version that removes every app-side
--      identity_score writer and verify it is live everywhere. If this
--      migration ran first, a still-deployed old app would overwrite the
--      canonical score on the next social callback.
--   2. Apply exactly this migration (single-migration apply).
--   3. Verify: trigger definitions, score distribution vs the pre-apply
--      snapshot, and that only this version was added to the ledger.
--
-- SAFETY HARD STOP: before the backfill, the migration ABORTS if recomputing
-- would move any existing user from >= 40 (the voting minimum) to below 40.
-- GPS dropped 40 -> 20 in the final model; the production cohort affected by
-- that drop is empty today, and this guard keeps the migration safe to apply
-- only while that stays true.
--
-- ROLLBACK (DB-only; keep the new application deployed - reverting the app
-- would restore the multiple-writer defect). ORDER IS LOAD-BEARING and
-- proof-tested: the 0..100 constraint MUST be re-added only AFTER the
-- recompute, because rows above 100 exist under the 140 model and narrowing
-- first fails with "check constraint is violated by some row".
--
--   BEGIN;
--   -- 1. drop the 140 constraint
--   ALTER TABLE users DROP CONSTRAINT IF EXISTS users_identity_score_range;
--   -- 2. restore the old scoring objects (2024 bodies); replace the uuid
--   --    function BEFORE dropping the row-type function it references
--   DROP TRIGGER IF EXISTS trigger_identity_score_on_verification ON users;
--   DROP FUNCTION IF EXISTS sync_identity_score_on_users_change();
--   CREATE OR REPLACE FUNCTION calculate_identity_score(user_uuid UUID)
--   RETURNS INTEGER AS $rb$
--   DECLARE
--     score INTEGER := 0;
--     proof RECORD;
--   BEGIN
--     FOR proof IN
--       SELECT provider FROM social_proofs WHERE user_id = user_uuid
--     LOOP
--       CASE proof.provider
--         WHEN 'google' THEN score := score + 40;
--         WHEN 'facebook' THEN score := score + 30;
--         WHEN 'instagram' THEN score := score + 30;
--       END CASE;
--     END LOOP;
--     RETURN LEAST(score, 100);
--   END;
--   $rb$ LANGUAGE plpgsql SECURITY DEFINER;
--   DROP FUNCTION IF EXISTS calculate_identity_score(users);
--   CREATE OR REPLACE FUNCTION update_user_identity_score()
--   RETURNS TRIGGER AS $rb$
--   DECLARE
--     new_score INTEGER;
--     target_user_id UUID;
--   BEGIN
--     IF TG_OP = 'DELETE' THEN
--       target_user_id := OLD.user_id;
--     ELSE
--       target_user_id := NEW.user_id;
--     END IF;
--     new_score := calculate_identity_score(target_user_id);
--     UPDATE users SET identity_score = new_score WHERE id = target_user_id;
--     IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
--   END;
--   $rb$ LANGUAGE plpgsql SECURITY DEFINER;
--   DROP TRIGGER IF EXISTS trigger_update_identity_score ON social_proofs;
--   CREATE TRIGGER trigger_update_identity_score
--     AFTER INSERT OR DELETE ON social_proofs
--     FOR EACH ROW EXECUTE FUNCTION update_user_identity_score();
--   -- 3. restore the pre-migration default ACL (CREATE OR REPLACE keeps the
--   --    restricted ACL this migration installed; production's originals
--   --    granted EXECUTE to PUBLIC/anon/authenticated)
--   GRANT EXECUTE ON FUNCTION calculate_identity_score(UUID)
--     TO PUBLIC, anon, authenticated, service_role;
--   GRANT EXECUTE ON FUNCTION update_user_identity_score()
--     TO PUBLIC, anon, authenticated, service_role;
--   -- 4. recompute every user under the old formula
--   UPDATE users SET identity_score = calculate_identity_score(id);
--   -- 5. only now narrow the range back
--   ALTER TABLE users ADD CONSTRAINT users_identity_score_check
--     CHECK (identity_score >= 0 AND identity_score <= 100);
--   COMMIT;

-- ============================================
-- 1. WIDEN THE RANGE (0..100 -> 0..140)
-- ============================================

-- users_identity_score_check is the auto-name of the inline CHECK from
-- 20240101000000_initial_schema.sql. Dropped before any recompute so interim
-- writes above 100 cannot fail; the 0..140 constraint is added at the end.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_identity_score_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_identity_score_range;

-- ============================================
-- 2. CANONICAL FORMULA
-- ============================================

-- Row-type form: BEFORE-triggers on users pass NEW so the incoming values are
-- scored before the row version is stored. social_proofs has
-- UNIQUE(user_id, provider), so per-provider double counting is impossible.
CREATE OR REPLACE FUNCTION calculate_identity_score(u users)
RETURNS INTEGER AS $$
DECLARE
  social_points INTEGER;
BEGIN
  SELECT COALESCE(SUM(
    CASE sp.provider::text
      WHEN 'google' THEN 40
      WHEN 'facebook' THEN 10
      WHEN 'instagram' THEN 10
      WHEN 'x' THEN 10  -- dormant until PR-X adds the enum value (see header)
      ELSE 0
    END
  ), 0)
  INTO social_points
  FROM social_proofs sp
  WHERE sp.user_id = u.id;

  RETURN LEAST(
    social_points
    + CASE WHEN u.verification_status = 'verified' THEN 20 ELSE 0 END
    + CASE WHEN u.phone_verified IS TRUE THEN 10 ELSE 0 END
    + CASE WHEN u.identity_verified_at IS NOT NULL THEN 40 ELSE 0 END,
    140
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Historical uuid signature kept for callers and scripts: reads the stored row.
CREATE OR REPLACE FUNCTION calculate_identity_score(user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  result INTEGER;
BEGIN
  SELECT calculate_identity_score(u) INTO result FROM users u WHERE u.id = user_uuid;
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- ============================================
-- 3. TRIGGER: social_proofs changes
-- ============================================

-- Now also fires on UPDATE; recomputes both sides if user_id ever changes.
-- The UPDATE below touches identity_score only, so it does NOT fire the users
-- trigger in section 4 (that one is UPDATE OF three other columns).
CREATE OR REPLACE FUNCTION update_user_identity_score()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP IN ('DELETE', 'UPDATE') THEN
    UPDATE users u
    SET identity_score = calculate_identity_score(u)
    WHERE u.id = OLD.user_id;
  END IF;

  IF TG_OP = 'INSERT'
     OR (TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
    UPDATE users u
    SET identity_score = calculate_identity_score(u)
    WHERE u.id = NEW.user_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_update_identity_score ON social_proofs;
CREATE TRIGGER trigger_update_identity_score
  AFTER INSERT OR UPDATE OR DELETE ON social_proofs
  FOR EACH ROW EXECUTE FUNCTION update_user_identity_score();

-- ============================================
-- 4. TRIGGER: users evidence columns (GPS / phone / identity document)
-- ============================================

-- BEFORE INSERT OR UPDATE OF the three evidence columns, scoring NEW and
-- returning NEW (decision O-1): a row INSERTED with evidence already present
-- (admin insert, import, restore, future signup path) is scored correctly at
-- creation instead of keeping a stale default. The OF list applies to UPDATE
-- only; every INSERT fires, which also means an INSERT cannot smuggle in an
-- arbitrary identity_score value.
CREATE OR REPLACE FUNCTION sync_identity_score_on_users_change()
RETURNS TRIGGER AS $$
BEGIN
  NEW.identity_score := calculate_identity_score(NEW);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_identity_score_on_verification ON users;
CREATE TRIGGER trigger_identity_score_on_verification
  BEFORE INSERT OR UPDATE OF verification_status, phone_verified, identity_verified_at
  ON users
  FOR EACH ROW
  EXECUTE FUNCTION sync_identity_score_on_users_change();

-- ============================================
-- 5. FUNCTION PRIVILEGES (SECURITY DEFINER hygiene)
-- ============================================

-- All four functions above are SECURITY DEFINER with a pinned
-- search_path = public (repo convention ratified in 20260802000002). The
-- deployed 2024 functions carried the default ACL (EXECUTE for PUBLIC, anon,
-- authenticated); nothing client-facing calls them, so direct execution is
-- withdrawn from application roles. Triggers keep firing regardless: fire-time
-- execution does not check the DML issuer's EXECUTE privilege (proven in the
-- trigger test suite). service_role keeps EXECUTE on the calculators for
-- operational dry-run queries and scripts.
REVOKE EXECUTE ON FUNCTION calculate_identity_score(users) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION calculate_identity_score(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION update_user_identity_score() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION sync_identity_score_on_users_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION calculate_identity_score(users) TO service_role;
GRANT EXECUTE ON FUNCTION calculate_identity_score(UUID) TO service_role;

-- ============================================
-- 6. HARD STOP, BACKFILL, NEW RANGE
-- ============================================

-- Abort (rolling back everything above) rather than silently strip voting
-- eligibility from an existing user.
DO $$
DECLARE
  affected INTEGER;
BEGIN
  SELECT COUNT(*) INTO affected
  FROM users u
  WHERE u.identity_score >= 40
    AND calculate_identity_score(u) < 40;

  IF affected > 0 THEN
    RAISE EXCEPTION
      'identity_score unification would drop % user(s) below the 40-point voting minimum; migration aborted',
      affected;
  END IF;
END $$;

-- Recompute every user through the canonical formula (no-op rows untouched).
-- Touches identity_score only, so neither trigger above fires.
UPDATE users u
SET identity_score = calculate_identity_score(u)
WHERE u.identity_score IS DISTINCT FROM calculate_identity_score(u);

ALTER TABLE users ADD CONSTRAINT users_identity_score_range
  CHECK (identity_score >= 0 AND identity_score <= 140);
