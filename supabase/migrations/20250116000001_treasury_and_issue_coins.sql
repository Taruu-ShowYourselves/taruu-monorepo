-- Treasury and Issue Coins Tables
--
-- Purpose: Support Bags.fm SocialFi integration for the Taru platform.
-- This enables the "Taru Proxy Strategy" where users pay in ILS,
-- and the backend manages Solana tokens internally.
--
-- Tables:
-- - treasury: Per-municipality fund tracking
-- - treasury_transactions: Audit log for all treasury operations
-- - issue_coins: Vote-to-Solana token mapping
-- - issue_coin_holdings: Holder tracking for NFT minting
--
-- Why this matters:
-- - Removes the $30 Bags.fm minimum barrier for users
-- - Enables external supporters to back local civic issues
-- - Creates "Social Multiplier" effect for vote funding
-- - Supports post-resolution NFT minting for all holders

-- =============================================================================
-- TREASURY TABLE
-- =============================================================================
-- Tracks funds for each municipality. Each municipality has one treasury
-- that accumulates payments from vote participation and creation.

CREATE TABLE IF NOT EXISTS treasury (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id TEXT NOT NULL UNIQUE,     -- Municipality identifier (e.g., 'tel-aviv')
  wallet_address TEXT,                       -- Master Solana wallet address for this municipality
  wallet_public_key TEXT,                    -- Public key for verification
  balance_ils INTEGER DEFAULT 0,             -- Current ILS balance (in agorot)
  balance_sol NUMERIC(20, 9) DEFAULT 0,      -- Current SOL balance (high precision)
  total_collected_ils INTEGER DEFAULT 0,     -- Total ILS collected all time
  total_withdrawn_ils INTEGER DEFAULT 0,     -- Total ILS withdrawn all time
  total_fees_claimed_sol NUMERIC(20, 9) DEFAULT 0, -- Total fees claimed from Bags.fm
  active_votes_count INTEGER DEFAULT 0,      -- Number of active votes with funds allocated
  last_sync_at TIMESTAMPTZ,                  -- Last sync with Bags.fm
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for treasury
CREATE INDEX IF NOT EXISTS idx_treasury_municipality ON treasury(municipality_id);
CREATE INDEX IF NOT EXISTS idx_treasury_active_votes ON treasury(active_votes_count) WHERE active_votes_count > 0;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_treasury_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_treasury_updated_at
  BEFORE UPDATE ON treasury
  FOR EACH ROW
  EXECUTE FUNCTION update_treasury_updated_at();

-- =============================================================================
-- TREASURY TRANSACTIONS TABLE
-- =============================================================================
-- Audit log for all treasury operations. Immutable record of fund movements.

CREATE TABLE IF NOT EXISTS treasury_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treasury_id UUID NOT NULL REFERENCES treasury(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN (
    'deposit',          -- ILS payment received from user
    'allocation',       -- Funds allocated to a vote
    'withdrawal',       -- Funds withdrawn to bank
    'fee_claim',        -- Fees claimed from Bags.fm
    'token_purchase',   -- External supporter token purchase
    'nft_mint'          -- NFT minting cost
  )),
  vote_id UUID REFERENCES votes(id) ON DELETE SET NULL,  -- Associated vote (if applicable)
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,  -- User who initiated (if applicable)
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL, -- Green Invoice payment (if applicable)
  amount_ils INTEGER,                        -- ILS amount (in agorot)
  amount_sol NUMERIC(20, 9),                 -- SOL amount (if applicable)
  description TEXT NOT NULL,                 -- Human-readable description
  bags_tx_hash TEXT,                         -- Bags.fm transaction hash (if applicable)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  metadata JSONB,                            -- Additional transaction-specific data
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for treasury_transactions
CREATE INDEX IF NOT EXISTS idx_treasury_tx_treasury ON treasury_transactions(treasury_id);
CREATE INDEX IF NOT EXISTS idx_treasury_tx_type ON treasury_transactions(type);
CREATE INDEX IF NOT EXISTS idx_treasury_tx_vote ON treasury_transactions(vote_id) WHERE vote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_treasury_tx_user ON treasury_transactions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_treasury_tx_status ON treasury_transactions(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_treasury_tx_created ON treasury_transactions(created_at);

-- =============================================================================
-- ISSUE COINS TABLE
-- =============================================================================
-- Maps votes to their Bags.fm Issue Coins. Each active vote can have one
-- Issue Coin that external supporters can purchase.

CREATE TABLE IF NOT EXISTS issue_coins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_id UUID NOT NULL REFERENCES votes(id) ON DELETE RESTRICT UNIQUE,
  token_mint TEXT NOT NULL UNIQUE,           -- Solana mint address
  token_name TEXT NOT NULL,                  -- Token name (vote title)
  token_symbol TEXT NOT NULL,                -- Token symbol (e.g., TARU-XXXX)
  token_decimals INTEGER DEFAULT 9,          -- Token decimals (typically 9 for Solana)
  total_supply TEXT,                         -- Total supply as string (large numbers)
  total_purchased TEXT DEFAULT '0',          -- Total tokens purchased by all holders
  total_value_ils INTEGER DEFAULT 0,         -- Total ILS value invested
  trading_enabled BOOLEAN DEFAULT true,      -- Whether trading is currently enabled
  is_frozen BOOLEAN DEFAULT false,           -- Whether token is frozen (vote ended)
  frozen_at TIMESTAMPTZ,                     -- When token was frozen
  launch_tx_hash TEXT,                       -- Token launch transaction hash
  fee_share_configured BOOLEAN DEFAULT false, -- Whether fee sharing is configured
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for issue_coins
CREATE INDEX IF NOT EXISTS idx_issue_coins_vote ON issue_coins(vote_id);
CREATE INDEX IF NOT EXISTS idx_issue_coins_mint ON issue_coins(token_mint);
CREATE INDEX IF NOT EXISTS idx_issue_coins_trading ON issue_coins(trading_enabled) WHERE trading_enabled = true;
CREATE INDEX IF NOT EXISTS idx_issue_coins_frozen ON issue_coins(is_frozen) WHERE is_frozen = true;

-- Trigger to update updated_at timestamp
CREATE TRIGGER tr_issue_coins_updated_at
  BEFORE UPDATE ON issue_coins
  FOR EACH ROW
  EXECUTE FUNCTION update_treasury_updated_at();

-- =============================================================================
-- ISSUE COIN HOLDINGS TABLE
-- =============================================================================
-- Tracks who holds each Issue Coin. Used for NFT minting after vote resolution.
-- Supports both internal users (user_id) and external wallets (wallet_address).

CREATE TABLE IF NOT EXISTS issue_coin_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_coin_id UUID NOT NULL REFERENCES issue_coins(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,      -- Internal user (if applicable)
  wallet_address TEXT,                       -- External Solana wallet (if applicable)
  token_amount TEXT NOT NULL DEFAULT '0',    -- Amount of tokens held
  invested_ils INTEGER DEFAULT 0,            -- Total ILS invested
  is_local_resident BOOLEAN DEFAULT false,   -- Whether holder is a verified local resident
  nft_minted BOOLEAN DEFAULT false,          -- Whether NFT has been minted for this holder
  nft_mint_address TEXT,                     -- Minted NFT address (if applicable)
  first_purchase_at TIMESTAMPTZ,             -- When holder first purchased
  last_purchase_at TIMESTAMPTZ,              -- When holder last purchased
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Either user_id or wallet_address must be set (not both null)
  CONSTRAINT chk_holder_identity CHECK (user_id IS NOT NULL OR wallet_address IS NOT NULL),
  -- Unique constraint: one holding record per user/wallet per issue coin
  CONSTRAINT uq_issue_coin_holding UNIQUE (issue_coin_id, user_id, wallet_address)
);

-- Indexes for issue_coin_holdings
CREATE INDEX IF NOT EXISTS idx_holdings_issue_coin ON issue_coin_holdings(issue_coin_id);
CREATE INDEX IF NOT EXISTS idx_holdings_user ON issue_coin_holdings(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_holdings_wallet ON issue_coin_holdings(wallet_address) WHERE wallet_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_holdings_resident ON issue_coin_holdings(is_local_resident) WHERE is_local_resident = true;
CREATE INDEX IF NOT EXISTS idx_holdings_nft_pending ON issue_coin_holdings(nft_minted) WHERE nft_minted = false;

-- Trigger to update updated_at timestamp
CREATE TRIGGER tr_issue_coin_holdings_updated_at
  BEFORE UPDATE ON issue_coin_holdings
  FOR EACH ROW
  EXECUTE FUNCTION update_treasury_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE treasury ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_coins ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_coin_holdings ENABLE ROW LEVEL SECURITY;

-- Treasury: Read-only for authenticated users (balances are public info)
CREATE POLICY "Treasury balances are publicly readable"
  ON treasury
  FOR SELECT
  USING (true);

-- Treasury Transactions: Users can see transactions they initiated
CREATE POLICY "Users can see their own treasury transactions"
  ON treasury_transactions
  FOR SELECT
  USING (user_id = auth.uid());

-- Issue Coins: Publicly readable (token info is public)
CREATE POLICY "Issue coins are publicly readable"
  ON issue_coins
  FOR SELECT
  USING (true);

-- Issue Coin Holdings: Users can see their own holdings
CREATE POLICY "Users can see their own issue coin holdings"
  ON issue_coin_holdings
  FOR SELECT
  USING (user_id = auth.uid());

-- Service role has full access for backend operations
CREATE POLICY "Service role full access to treasury"
  ON treasury FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to treasury_transactions"
  ON treasury_transactions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to issue_coins"
  ON issue_coins FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to issue_coin_holdings"
  ON issue_coin_holdings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to get or create treasury for a municipality
CREATE OR REPLACE FUNCTION get_or_create_treasury(p_municipality_id TEXT)
RETURNS UUID AS $$
DECLARE
  v_treasury_id UUID;
BEGIN
  -- Try to get existing treasury
  SELECT id INTO v_treasury_id
  FROM treasury
  WHERE municipality_id = p_municipality_id;

  -- Create if not exists
  IF v_treasury_id IS NULL THEN
    INSERT INTO treasury (municipality_id)
    VALUES (p_municipality_id)
    RETURNING id INTO v_treasury_id;
  END IF;

  RETURN v_treasury_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record a treasury deposit
CREATE OR REPLACE FUNCTION record_treasury_deposit(
  p_municipality_id TEXT,
  p_amount_ils INTEGER,
  p_payment_id UUID,
  p_user_id UUID,
  p_vote_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT 'Payment deposit'
)
RETURNS UUID AS $$
DECLARE
  v_treasury_id UUID;
  v_tx_id UUID;
BEGIN
  -- Get or create treasury
  v_treasury_id := get_or_create_treasury(p_municipality_id);

  -- Update treasury balance
  UPDATE treasury
  SET
    balance_ils = balance_ils + p_amount_ils,
    total_collected_ils = total_collected_ils + p_amount_ils
  WHERE id = v_treasury_id;

  -- Record transaction
  INSERT INTO treasury_transactions (
    treasury_id, type, vote_id, user_id, payment_id,
    amount_ils, description, status
  )
  VALUES (
    v_treasury_id, 'deposit', p_vote_id, p_user_id, p_payment_id,
    p_amount_ils, p_description, 'confirmed'
  )
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_or_create_treasury(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION record_treasury_deposit(TEXT, INTEGER, UUID, UUID, UUID, TEXT) TO service_role;

-- =============================================================================
-- DOCUMENTATION COMMENTS
-- =============================================================================

COMMENT ON TABLE treasury IS 'Per-municipality fund tracking for Bags.fm integration. Stores ILS and SOL balances.';
COMMENT ON TABLE treasury_transactions IS 'Immutable audit log of all treasury operations including deposits, allocations, and withdrawals.';
COMMENT ON TABLE issue_coins IS 'Maps votes to their Bags.fm Issue Coins (Solana tokens).';
COMMENT ON TABLE issue_coin_holdings IS 'Tracks holders of Issue Coins for NFT minting after vote resolution.';

COMMENT ON COLUMN treasury.balance_ils IS 'Current ILS balance in agorot (100 agorot = 1 ILS)';
COMMENT ON COLUMN treasury.balance_sol IS 'Current SOL balance with high precision for Solana operations';
COMMENT ON COLUMN issue_coins.token_mint IS 'Solana token mint address (32-64 character base58 string)';
COMMENT ON COLUMN issue_coins.is_frozen IS 'When true, trading is disabled (set when vote ends)';
COMMENT ON COLUMN issue_coin_holdings.is_local_resident IS 'True if holder is a verified resident; determines NFT type (Verified Voter vs Civic Patron)';
