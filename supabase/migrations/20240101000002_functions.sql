-- Database Functions
-- Helper functions for atomic operations and business logic

-- ============================================
-- VOTE INCREMENT FUNCTION
-- ============================================

-- Atomic increment of vote count on an option
CREATE OR REPLACE FUNCTION increment_vote_option(option_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE vote_options
  SET votes = votes + 1
  WHERE id = option_id;

  -- Also increment participant count on the vote
  UPDATE votes
  SET participant_count = participant_count + 1
  WHERE id = (
    SELECT vote_id FROM vote_options WHERE id = option_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- CALCULATE IDENTITY SCORE FUNCTION
-- ============================================

-- Calculate identity score based on social proofs
CREATE OR REPLACE FUNCTION calculate_identity_score(user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
  proof RECORD;
BEGIN
  FOR proof IN
    SELECT provider FROM social_proofs WHERE user_id = user_uuid
  LOOP
    CASE proof.provider
      WHEN 'google' THEN score := score + 40;
      WHEN 'facebook' THEN score := score + 30;
      WHEN 'instagram' THEN score := score + 30;
    END CASE;
  END LOOP;

  RETURN LEAST(score, 100);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- UPDATE USER SCORE TRIGGER
-- ============================================

-- Automatically update user's identity score when social proofs change
CREATE OR REPLACE FUNCTION update_user_identity_score()
RETURNS TRIGGER AS $$
DECLARE
  new_score INTEGER;
  target_user_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_user_id := OLD.user_id;
  ELSE
    target_user_id := NEW.user_id;
  END IF;

  new_score := calculate_identity_score(target_user_id);

  UPDATE users
  SET identity_score = new_score
  WHERE id = target_user_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_identity_score
  AFTER INSERT OR DELETE ON social_proofs
  FOR EACH ROW EXECUTE FUNCTION update_user_identity_score();

-- ============================================
-- VERIFICATION COMPLETION CHECK
-- ============================================

-- Check if verification run should be marked as complete or failed
CREATE OR REPLACE FUNCTION check_verification_completion(run_uuid UUID)
RETURNS VOID AS $$
DECLARE
  run RECORD;
  success_rate NUMERIC;
BEGIN
  SELECT * INTO run FROM verification_runs WHERE id = run_uuid;

  IF run.total_check_ins = 0 THEN
    RETURN;
  END IF;

  -- Calculate success rate
  success_rate := run.completed_check_ins::NUMERIC / run.total_check_ins;

  -- If 21 days have passed
  IF run.started_at + INTERVAL '21 days' <= NOW() THEN
    IF success_rate >= 0.8 THEN
      -- 80%+ success = verified
      UPDATE verification_runs
      SET status = 'verified', completed_at = NOW()
      WHERE id = run_uuid;

      UPDATE users
      SET verification_status = 'verified'
      WHERE id = run.user_id;
    ELSE
      -- Less than 80% = failed
      UPDATE verification_runs
      SET status = 'failed', completed_at = NOW()
      WHERE id = run_uuid;

      UPDATE users
      SET verification_status = 'failed'
      WHERE id = run.user_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PAYMENT IDEMPOTENCY CHECK
-- ============================================

-- Returns existing payment if idempotency key exists, null otherwise
CREATE OR REPLACE FUNCTION get_or_create_payment(
  p_user_id UUID,
  p_type payment_type,
  p_amount INTEGER,
  p_idempotency_key TEXT,
  p_vote_id UUID DEFAULT NULL,
  p_option_id TEXT DEFAULT NULL
)
RETURNS payments AS $$
DECLARE
  existing_payment payments;
  new_payment payments;
BEGIN
  -- Check for existing payment with same idempotency key
  SELECT * INTO existing_payment
  FROM payments
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN existing_payment;
  END IF;

  -- Create new payment
  INSERT INTO payments (
    user_id, type, amount, idempotency_key, vote_id, option_id
  ) VALUES (
    p_user_id, p_type, p_amount, p_idempotency_key, p_vote_id, p_option_id
  )
  RETURNING * INTO new_payment;

  RETURN new_payment;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
