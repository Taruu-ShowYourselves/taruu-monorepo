-- Corrective RLS migration (SEC-01 / CONCERNS §3 / SECURITY-AUDIT #17).
-- These three per-user policies were written with Supabase's built-in auth helper.
-- This project uses a custom JWT that sets app.current_user_id and exposes
-- the project helper function (defined in 20240101000001_rls_policies.sql).
-- The built-in auth helper returns NULL under this scheme, so these policies have
-- never matched a real user's rows. Already-applied migrations are immutable;
-- this migration drops and recreates the affected policies with the correct helper.
--
-- NOTE (deliberate, not fixed here): treasury and issue_coins retain their
-- USING (true) public-read policies — balances and token info are intentionally
-- public. Tightening those is out of scope for SEC-01.

-- treasury_transactions: per-user SELECT
DROP POLICY IF EXISTS "Users can see their own treasury transactions" ON treasury_transactions;
CREATE POLICY "Users can see their own treasury transactions"
  ON treasury_transactions
  FOR SELECT
  USING (user_id = public.user_id());

-- issue_coin_holdings: per-user SELECT
DROP POLICY IF EXISTS "Users can see their own issue coin holdings" ON issue_coin_holdings;
CREATE POLICY "Users can see their own issue coin holdings"
  ON issue_coin_holdings
  FOR SELECT
  USING (user_id = public.user_id());

-- phone_verifications: per-user SELECT (only per-user policy; writes are service-role)
DROP POLICY IF EXISTS "Users can read own phone verification" ON phone_verifications;
CREATE POLICY "Users can read own phone verification"
  ON phone_verifications
  FOR SELECT
  TO authenticated
  USING (user_id = public.user_id());
