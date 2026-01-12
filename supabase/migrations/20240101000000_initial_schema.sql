-- Sync Platform Database Schema
-- Initial migration: Core tables for users, social proofs, verification, and payments

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- ENUM TYPES
-- ============================================

CREATE TYPE verification_status AS ENUM ('none', 'pending', 'verified', 'failed');
CREATE TYPE verification_run_status AS ENUM ('active', 'verified', 'failed', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE payment_type AS ENUM ('vote_participation', 'vote_creation');
CREATE TYPE social_provider AS ENUM ('google', 'facebook', 'instagram');
CREATE TYPE vote_status AS ENUM ('pending', 'active', 'ended');
CREATE TYPE entitlement_type AS ENUM ('vote', 'create_vote', 'tokens');

-- ============================================
-- USERS TABLE
-- ============================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  municipality_id TEXT,

  -- DID (Decentralized Identifier) fields
  did TEXT UNIQUE,
  did_public_key TEXT,
  did_encrypted_private_key TEXT,

  -- OAuth identifiers
  google_id TEXT UNIQUE,

  -- Profile
  avatar_url TEXT,
  identity_score INTEGER DEFAULT 0 CHECK (identity_score >= 0 AND identity_score <= 100),
  verification_status verification_status DEFAULT 'none',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for OAuth lookups
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_did ON users(did);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_municipality ON users(municipality_id);

-- ============================================
-- SOCIAL PROOFS TABLE
-- ============================================

CREATE TABLE social_proofs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider social_provider NOT NULL,
  provider_id TEXT NOT NULL,
  provider_email TEXT,
  provider_name TEXT,
  provider_avatar TEXT,
  access_token_encrypted TEXT,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each user can only have one proof per provider
  UNIQUE(user_id, provider)
);

CREATE INDEX idx_social_proofs_user ON social_proofs(user_id);
CREATE INDEX idx_social_proofs_provider ON social_proofs(provider, provider_id);

-- ============================================
-- VERIFICATION RUNS TABLE
-- ============================================

CREATE TABLE verification_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  municipality_id TEXT NOT NULL,
  status verification_run_status DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  total_check_ins INTEGER DEFAULT 0,
  completed_check_ins INTEGER DEFAULT 0,
  failed_check_ins INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_verification_runs_user ON verification_runs(user_id);
CREATE INDEX idx_verification_runs_status ON verification_runs(status);
CREATE INDEX idx_verification_runs_active ON verification_runs(user_id) WHERE status = 'active';

-- ============================================
-- VERIFICATION SCHEDULE TABLE
-- ============================================

CREATE TABLE verification_schedule (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES verification_runs(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  reminder_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure window_end > window_start
  CHECK (window_end > window_start)
);

CREATE INDEX idx_verification_schedule_run ON verification_schedule(run_id);
CREATE INDEX idx_verification_schedule_pending ON verification_schedule(run_id, completed)
  WHERE completed = FALSE;
CREATE INDEX idx_verification_schedule_upcoming ON verification_schedule(window_start)
  WHERE completed = FALSE AND reminder_sent = FALSE;

-- ============================================
-- VERIFICATION ATTEMPTS TABLE
-- ============================================

CREATE TABLE verification_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES verification_schedule(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION NOT NULL,
  passed BOOLEAN DEFAULT FALSE,
  fail_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_verification_attempts_schedule ON verification_attempts(schedule_id);
CREATE INDEX idx_verification_attempts_user ON verification_attempts(user_id);

-- ============================================
-- PAYMENTS TABLE
-- ============================================

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type payment_type NOT NULL,
  amount INTEGER NOT NULL, -- Amount in agorot (cents)
  currency TEXT DEFAULT 'ILS',
  status payment_status DEFAULT 'pending',
  provider TEXT DEFAULT 'green_invoice',
  provider_id TEXT,
  idempotency_key TEXT UNIQUE NOT NULL,
  vote_id UUID,
  option_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_provider ON payments(provider_id);
CREATE INDEX idx_payments_idempotency ON payments(idempotency_key);

-- ============================================
-- ENTITLEMENTS TABLE
-- ============================================

CREATE TABLE entitlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type entitlement_type NOT NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  vote_id UUID,
  amount INTEGER, -- For token entitlements
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_entitlements_user ON entitlements(user_id);
CREATE INDEX idx_entitlements_type ON entitlements(type);
CREATE INDEX idx_entitlements_payment ON entitlements(payment_id);

-- ============================================
-- VOTES TABLE
-- ============================================

CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  municipality_id TEXT NOT NULL,
  status vote_status DEFAULT 'pending',
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ NOT NULL,
  participant_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_votes_creator ON votes(creator_id);
CREATE INDEX idx_votes_municipality ON votes(municipality_id);
CREATE INDEX idx_votes_status ON votes(status);
CREATE INDEX idx_votes_active ON votes(municipality_id, status) WHERE status = 'active';

-- ============================================
-- VOTE OPTIONS TABLE
-- ============================================

CREATE TABLE vote_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vote_id UUID NOT NULL REFERENCES votes(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  votes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vote_options_vote ON vote_options(vote_id);

-- ============================================
-- USER VOTES TABLE (Records who voted for what)
-- ============================================

CREATE TABLE user_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_id UUID NOT NULL REFERENCES votes(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES vote_options(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each user can only vote once per vote
  UNIQUE(user_id, vote_id)
);

CREATE INDEX idx_user_votes_user ON user_votes(user_id);
CREATE INDEX idx_user_votes_vote ON user_votes(vote_id);

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_social_proofs_updated_at
  BEFORE UPDATE ON social_proofs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_verification_runs_updated_at
  BEFORE UPDATE ON verification_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_votes_updated_at
  BEFORE UPDATE ON votes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
