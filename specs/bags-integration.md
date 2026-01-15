# Bags.fm SocialFi Integration Specification

**Status:** NOT STARTED (Priority 2 - Post-Pilot MVP)
**Priority:** 2 (Post-pilot)
**Last Updated:** January 15, 2025

---

## Overview

Bags.fm integration enables the SocialFi economics of the Taru platform. Each vote topic gets an "Issue Coin" that allows external supporters to financially back local civic issues, creating a Social Multiplier effect.

## The Taru Proxy Strategy

Users never touch crypto directly. The platform abstracts all blockchain complexity:

1. User pays ₪3 via Green Invoice (Israeli payment gateway)
2. Backend holds **master treasury wallet** on Bags.fm
3. Backend allocates "shares" to user's internal ID via Bags.fm API
4. Individual votes are internal transactions, batch-synced to chain
5. **This removes the $30 Bags.fm minimum completely**

---

## Current State

**Status: NOT STARTED** - Zero implementation exists in the codebase.

### What Exists
- Planning documentation in IMPLEMENTATION_PLAN.md
- References in PROMPT_plan.md and AGENTS.md

### What's Missing
- `apps/web/src/services/bags/index.ts` - Service doesn't exist
- `packages/api-client/src/bags.ts` - API client module doesn't exist
- `packages/shared/src/types/bags.ts` - Types don't exist
- `packages/shared/src/contracts/bags.ts` - Zod schemas don't exist
- Environment variables (BAGS_API_KEY, etc.)
- Treasury database tables

---

## Bags.fm API Reference

### Authentication
- **Base URL:** `https://public-api-v2.bags.fm/api/v1/`
- **Auth Header:** `x-api-key: {your_api_key}`
- **Rate Limit:** 1,000 requests/hour per API key
- **Get API Keys:** https://dev.bags.fm

### Key Endpoints

#### Token Launch
```
POST /token-launch/create-token-info
  - Creates token metadata for a new Issue Coin
  - Required fields: name, symbol, description, image

POST /token-launch/create-launch-transaction
  - Generates signed transaction to launch token
  - Uses Meteora DBC for liquidity

POST /token-launch/fee-share/create-config
  - REQUIRED for all launches since Jan 2025
  - Configures fee sharing (up to 100 fee earners)
```

#### Trading
```
GET /trade/quote
  - Get swap price quotes
  - Params: inputMint, outputMint, amount

POST /trade/swap
  - Execute token swap
  - Requires signed transaction
```

#### Fee Management
```
GET /token-launch/claimable-positions
  - Get positions with claimable fees

POST /token-launch/claim-txs/v2
  - Generate claim transactions

GET /token-launch/lifetime-fees
  - Analytics for total fees earned
```

#### Partner System
```
POST /partner/create-key
  - Create partner key to receive fees from multiple launches
```

### Important Notes

1. **BREAKING CHANGE (Jan 2025):** Token launches now REQUIRE fee sharing configuration
2. Fee claimers must use social providers: twitter, kick, github
3. No fee for token creation via API (only Solana tx cost ~0.01 SOL)
4. Up to 100 fee earners per token launch
5. Automatic dividend distribution every 24h if ≥10 SOL unclaimed
6. **No native NFT minting** - Use Qubik service instead

---

## Required Implementation

### 1. Types (`packages/shared/src/types/bags.ts`)

```typescript
// Token metadata for Issue Coin creation
export interface TokenMetadata {
  name: string;           // Vote title
  symbol: string;         // Auto-generated (e.g., "TARU-001")
  description: string;    // Vote description
  image: string;          // Vote thumbnail URL
  municipality: string;   // Municipality name
  voteId: string;         // Internal vote ID
}

export interface TokenInfo {
  mint: string;           // Solana mint address
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  createdAt: Date;
}

// Trading types
export interface QuoteParams {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
}

export interface Quote {
  inputAmount: string;
  outputAmount: string;
  priceImpact: number;
  fee: string;
  route: string[];
}

export interface SwapParams {
  quote: Quote;
  userWallet: string;
}

// Fee sharing
export interface FeeShareConfig {
  tokenMint: string;
  feeEarners: FeeEarner[];
}

export interface FeeEarner {
  provider: 'twitter' | 'kick' | 'github';
  providerId: string;
  sharePercentage: number;  // 0-100
}

export interface ClaimablePosition {
  tokenMint: string;
  tokenName: string;
  unclaimedFees: string;    // SOL amount
  lastClaimed?: Date;
}

// Treasury types
export interface TreasuryBalance {
  municipalityId: string;
  totalILS: number;         // Israeli Shekel balance
  totalSOL: number;         // Bags.fm SOL balance
  allocatedToVotes: number;
  availableForWithdrawal: number;
  lastUpdated: Date;
}

export interface TreasuryTransaction {
  id: string;
  treasuryId: string;
  type: 'deposit' | 'allocation' | 'withdrawal' | 'fee_claim';
  voteId?: string;
  amountILS: number;
  amountSOL?: number;
  description: string;
  bagsTxHash?: string;
  createdAt: Date;
}
```

### 2. Service (`apps/web/src/services/bags/index.ts`)

```typescript
import { Bags } from '@bags.fm/sdk';  // or manual fetch implementation

const BAGS_API_KEY = process.env.BAGS_API_KEY;
const BAGS_BASE_URL = 'https://public-api-v2.bags.fm/api/v1';

export const bagsService = {
  // Token Launch
  async createTokenInfo(metadata: TokenMetadata): Promise<TokenInfo> {
    const response = await fetch(`${BAGS_BASE_URL}/token-launch/create-token-info`, {
      method: 'POST',
      headers: {
        'x-api-key': BAGS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: metadata.name,
        symbol: metadata.symbol,
        description: metadata.description,
        image: metadata.image,
        externalUrl: `https://taru.co.il/votes/${metadata.voteId}`,
      }),
    });
    return response.json();
  },

  async configureFeeShare(config: FeeShareConfig): Promise<void> {
    // REQUIRED before launching token
    await fetch(`${BAGS_BASE_URL}/token-launch/fee-share/create-config`, {
      method: 'POST',
      headers: { 'x-api-key': BAGS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
  },

  async createLaunchTransaction(tokenInfo: TokenInfo, walletAddress: string): Promise<string> {
    const response = await fetch(`${BAGS_BASE_URL}/token-launch/create-launch-transaction`, {
      method: 'POST',
      headers: { 'x-api-key': BAGS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokenMint: tokenInfo.mint,
        creatorWallet: walletAddress,
      }),
    });
    const { signedTransaction } = await response.json();
    return signedTransaction;
  },

  // Trading
  async getQuote(params: QuoteParams): Promise<Quote> {
    const searchParams = new URLSearchParams({
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: params.amount,
      slippageBps: String(params.slippageBps || 50),
    });
    const response = await fetch(`${BAGS_BASE_URL}/trade/quote?${searchParams}`, {
      headers: { 'x-api-key': BAGS_API_KEY },
    });
    return response.json();
  },

  async createSwap(params: SwapParams): Promise<string> {
    const response = await fetch(`${BAGS_BASE_URL}/trade/swap`, {
      method: 'POST',
      headers: { 'x-api-key': BAGS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const { signedTransaction } = await response.json();
    return signedTransaction;
  },

  // Fee Management
  async getClaimablePositions(wallet: string): Promise<ClaimablePosition[]> {
    const response = await fetch(
      `${BAGS_BASE_URL}/token-launch/claimable-positions?wallet=${wallet}`,
      { headers: { 'x-api-key': BAGS_API_KEY } }
    );
    return response.json();
  },

  async createClaimTransaction(positions: ClaimablePosition[]): Promise<string> {
    const response = await fetch(`${BAGS_BASE_URL}/token-launch/claim-txs/v2`, {
      method: 'POST',
      headers: { 'x-api-key': BAGS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ positions: positions.map(p => p.tokenMint) }),
    });
    const { signedTransaction } = await response.json();
    return signedTransaction;
  },

  // Analytics
  async getLifetimeFees(tokenMint: string): Promise<{ totalFees: string; claimedFees: string }> {
    const response = await fetch(
      `${BAGS_BASE_URL}/token-launch/lifetime-fees?tokenMint=${tokenMint}`,
      { headers: { 'x-api-key': BAGS_API_KEY } }
    );
    return response.json();
  },
};
```

### 3. Database Tables

```sql
-- Treasury per municipality
CREATE TABLE treasury (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id TEXT NOT NULL UNIQUE,
  balance_ils INTEGER DEFAULT 0,          -- Israeli Shekels (agorot)
  balance_sol NUMERIC(20, 9) DEFAULT 0,   -- SOL with high precision
  total_allocated INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,
  bags_wallet_address TEXT,
  bags_wallet_public_key TEXT,
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Treasury transactions
CREATE TABLE treasury_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treasury_id UUID NOT NULL REFERENCES treasury(id),
  type TEXT NOT NULL CHECK (type IN ('deposit', 'allocation', 'withdrawal', 'fee_claim', 'trade')),
  vote_id UUID REFERENCES votes(id),
  amount_ils INTEGER,
  amount_sol NUMERIC(20, 9),
  description TEXT,
  bags_tx_hash TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Issue coins linked to votes
CREATE TABLE issue_coins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_id UUID NOT NULL REFERENCES votes(id) UNIQUE,
  token_mint TEXT NOT NULL UNIQUE,
  token_name TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  total_supply TEXT,
  is_frozen BOOLEAN DEFAULT false,
  frozen_at TIMESTAMPTZ,
  launch_tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- External supporter holdings (for NFT minting)
CREATE TABLE issue_coin_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_coin_id UUID NOT NULL REFERENCES issue_coins(id),
  wallet_address TEXT NOT NULL,
  balance TEXT NOT NULL,
  is_resident BOOLEAN DEFAULT false,
  user_id UUID REFERENCES users(id),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(issue_coin_id, wallet_address)
);

-- Indexes
CREATE INDEX idx_treasury_municipality ON treasury(municipality_id);
CREATE INDEX idx_treasury_tx_type ON treasury_transactions(type);
CREATE INDEX idx_treasury_tx_vote ON treasury_transactions(vote_id);
CREATE INDEX idx_issue_coins_vote ON issue_coins(vote_id);
CREATE INDEX idx_issue_coins_mint ON issue_coins(token_mint);
CREATE INDEX idx_holdings_coin ON issue_coin_holdings(issue_coin_id);
```

### 4. Environment Variables

```env
# Bags.fm Configuration
BAGS_API_KEY=your_api_key_from_dev_bags_fm
BAGS_MASTER_WALLET_PRIVATE_KEY=base64_encoded_private_key
BAGS_MASTER_WALLET_ADDRESS=solana_wallet_address
BAGS_WEBHOOK_SECRET=webhook_signature_secret
```

---

## Integration Flow

### Vote Creation Flow (with Issue Coin)

1. User creates vote (₪200 payment via Green Invoice)
2. After payment success:
   - Create vote in database
   - Generate Issue Coin metadata
   - Configure fee sharing (platform gets 10%, creator gets 10%)
   - Launch Issue Coin on Bags.fm
   - Store token mint in `issue_coins` table
   - Link to vote

### External Supporter Flow

1. External user visits vote page
2. Clicks "Support This Issue"
3. Connects Solana wallet (Phantom, etc.)
4. Purchases Issue Coin on Bags.fm
5. Backend tracks holding in `issue_coin_holdings`

### Vote Resolution Flow

1. Vote period ends
2. Calculate results
3. Freeze Issue Coin (stop trading)
4. Calculate total fund raised
5. Claim accumulated fees
6. Mint NFTs for all holders:
   - "Verified Voter" for residents
   - "Civic Patron" for external supporters
7. Off-ramp funds to bank for expert hiring

---

## Fee Structure

### Platform Fee Split
- **Platform treasury:** 10%
- **Vote creator:** 10%
- **Municipality treasury:** 80%

### Trading Fees
- Bags.fm collects 1% on all trades
- Fee distribution happens automatically every 24h if ≥10 SOL

---

## NFT Minting (via Qubik, not Bags.fm)

Since Bags.fm doesn't support native NFT minting, use the existing Qubik service:

```typescript
// After vote closes
async function mintVoterNFTs(voteId: string) {
  const vote = await getVote(voteId);
  const issueCoin = await getIssueCoin(voteId);
  const holdings = await getIssueCoinHoldings(issueCoin.id);

  for (const holder of holdings) {
    const nftType = holder.is_resident ? 'verified_voter' : 'civic_patron';
    const metadata = {
      name: `${vote.title} - ${nftType === 'verified_voter' ? 'מצביע מאומת' : 'תומך אזרחי'}`,
      description: vote.description,
      attributes: [
        { trait_type: 'Issue', value: vote.title },
        { trait_type: 'Municipality', value: vote.municipality },
        { trait_type: 'Result', value: vote.results.winningOption },
        { trait_type: 'Vote Date', value: vote.endDate.toISOString() },
        { trait_type: 'Holder Type', value: nftType },
        { trait_type: 'Fund Raised', value: `${totalFundRaised} ILS` },
        { trait_type: 'Token Mint', value: issueCoin.token_mint },
      ],
    };

    await qubikService.mintNFT(holder.wallet_address, metadata);
  }
}
```

---

## Resources

- **Bags.fm Docs:** https://docs.bags.fm
- **Bags.fm SDK:** https://github.com/bagsfm/bags-sdk
- **API Keys:** https://dev.bags.fm
- **Meteora DBC:** https://meteora.ag (liquidity protocol used by Bags.fm)

---

## Dependencies

- `@bags.fm/sdk` (optional - can use fetch directly)
- `@solana/web3.js` (for transaction signing)

---

## Related Files

| File | Status | Purpose |
|------|--------|---------|
| `apps/web/src/services/bags/index.ts` | NOT STARTED | Bags.fm service |
| `packages/api-client/src/bags.ts` | NOT STARTED | API client module |
| `packages/shared/src/types/bags.ts` | NOT STARTED | Type definitions |
| `supabase/migrations/XXX_treasury.sql` | NOT STARTED | Treasury tables |
| `supabase/migrations/XXX_issue_coins.sql` | NOT STARTED | Issue coin tables |
| `apps/web/src/services/qubik/index.ts` | COMPLETE | NFT minting (use this) |
