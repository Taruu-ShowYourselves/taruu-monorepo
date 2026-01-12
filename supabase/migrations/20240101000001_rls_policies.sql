-- Row Level Security Policies
-- Ensures users can only access their own data

-- ============================================
-- HELPER FUNCTION FOR CUSTOM AUTH
-- ============================================

-- Function to get current user ID from request context
-- Used when our custom JWT auth sets the user context
CREATE OR REPLACE FUNCTION auth.user_id()
RETURNS UUID AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.jwt.claims', true)::json->>'sub',
    current_setting('app.current_user_id', true)
  )::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set current user context (called from API routes)
CREATE OR REPLACE FUNCTION set_claim(claim TEXT, value TEXT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.' || claim, value, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_votes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- USERS TABLE POLICIES
-- ============================================

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (id = auth.user_id());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (id = auth.user_id())
  WITH CHECK (id = auth.user_id());

-- Service role can insert new users (during signup)
-- No INSERT policy for regular users - handled by service role

-- ============================================
-- SOCIAL PROOFS TABLE POLICIES
-- ============================================

-- Users can read their own social proofs
CREATE POLICY "Users can view own social proofs"
  ON social_proofs FOR SELECT
  USING (user_id = auth.user_id());

-- Users can delete their own social proofs
CREATE POLICY "Users can delete own social proofs"
  ON social_proofs FOR DELETE
  USING (user_id = auth.user_id());

-- ============================================
-- VERIFICATION RUNS TABLE POLICIES
-- ============================================

-- Users can read their own verification runs
CREATE POLICY "Users can view own verification runs"
  ON verification_runs FOR SELECT
  USING (user_id = auth.user_id());

-- ============================================
-- VERIFICATION SCHEDULE TABLE POLICIES
-- ============================================

-- Users can read their own schedule (via run join)
CREATE POLICY "Users can view own verification schedule"
  ON verification_schedule FOR SELECT
  USING (
    run_id IN (
      SELECT id FROM verification_runs WHERE user_id = auth.user_id()
    )
  );

-- ============================================
-- VERIFICATION ATTEMPTS TABLE POLICIES
-- ============================================

-- Users can read their own attempts
CREATE POLICY "Users can view own verification attempts"
  ON verification_attempts FOR SELECT
  USING (user_id = auth.user_id());

-- ============================================
-- PAYMENTS TABLE POLICIES
-- ============================================

-- Users can read their own payments
CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  USING (user_id = auth.user_id());

-- ============================================
-- ENTITLEMENTS TABLE POLICIES
-- ============================================

-- Users can read their own entitlements
CREATE POLICY "Users can view own entitlements"
  ON entitlements FOR SELECT
  USING (user_id = auth.user_id());

-- ============================================
-- VOTES TABLE POLICIES
-- ============================================

-- Anyone can read active votes (public)
CREATE POLICY "Anyone can view active votes"
  ON votes FOR SELECT
  USING (status = 'active');

-- Creators can view their own votes regardless of status
CREATE POLICY "Creators can view own votes"
  ON votes FOR SELECT
  USING (creator_id = auth.user_id());

-- ============================================
-- VOTE OPTIONS TABLE POLICIES
-- ============================================

-- Anyone can read options for active votes
CREATE POLICY "Anyone can view vote options"
  ON vote_options FOR SELECT
  USING (
    vote_id IN (
      SELECT id FROM votes WHERE status = 'active'
      UNION
      SELECT id FROM votes WHERE creator_id = auth.user_id()
    )
  );

-- ============================================
-- USER VOTES TABLE POLICIES
-- ============================================

-- Users can read their own vote records
CREATE POLICY "Users can view own vote records"
  ON user_votes FOR SELECT
  USING (user_id = auth.user_id());

-- ============================================
-- SERVICE ROLE BYPASS
-- ============================================
-- Note: Service role automatically bypasses RLS
-- No explicit policies needed for service role operations
