-- Push notification tokens table and wallet address column
-- Migration: Add push_tokens table and qubik_wallet_address to users

-- ============================================
-- ADD WALLET ADDRESS TO USERS
-- ============================================

-- Required for token minting via Qubik blockchain service
ALTER TABLE users ADD COLUMN IF NOT EXISTS qubik_wallet_address TEXT;

CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(qubik_wallet_address) WHERE qubik_wallet_address IS NOT NULL;

-- ============================================
-- PUSH TOKENS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  device_type TEXT CHECK (device_type IN ('ios', 'android')),
  device_name TEXT,
  is_active BOOLEAN DEFAULT true,
  last_used TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_tokens(user_id) WHERE is_active = true;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can view their own push tokens
CREATE POLICY "Users can view own push tokens" ON push_tokens
  FOR SELECT USING (user_id = public.user_id());

-- Users can insert their own push tokens
CREATE POLICY "Users can insert own push tokens" ON push_tokens
  FOR INSERT WITH CHECK (user_id = public.user_id());

-- Users can update their own push tokens
CREATE POLICY "Users can update own push tokens" ON push_tokens
  FOR UPDATE USING (user_id = public.user_id());

-- Users can delete their own push tokens
CREATE POLICY "Users can delete own push tokens" ON push_tokens
  FOR DELETE USING (user_id = public.user_id());

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

CREATE TRIGGER update_push_tokens_updated_at
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
