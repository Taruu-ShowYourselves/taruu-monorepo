/**
 * Qubik Blockchain Service
 *
 * Handles all interactions with the Qubik blockchain for:
 * - Recording votes
 * - Minting Sync tokens
 * - Verifying transactions
 * - Querying vote history
 */

interface QubikConfig {
  apiKey: string;
  network: 'mainnet' | 'testnet';
  baseUrl: string;
}

interface VoteRecord {
  id: string;
  voteId: string;
  oderId: string;
  optionId: string;
  timestamp: Date;
  locationHash: string;
  paymentHash: string;
  txHash: string;
}

interface TokenMint {
  walletAddress: string;
  amount: number;
  txHash: string;
  timestamp: Date;
}

interface Transaction {
  hash: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  timestamp?: Date;
}

class QubikService {
  private config: QubikConfig;

  constructor() {
    this.config = {
      apiKey: process.env.QUBIK_API_KEY || '',
      network: (process.env.QUBIK_NETWORK as 'mainnet' | 'testnet') || 'testnet',
      baseUrl:
        process.env.QUBIK_NETWORK === 'mainnet'
          ? 'https://api.qubik.io/v1'
          : 'https://testnet-api.qubik.io/v1',
    };
  }

  /**
   * Record a vote on the blockchain
   */
  async recordVote(params: {
    voteId: string;
    oderId: string;
    optionId: string;
    locationHash: string;
    paymentHash: string;
  }): Promise<VoteRecord> {
    const response = await fetch(`${this.config.baseUrl}/votes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        voteId: params.voteId,
        oderId: params.oderId,
        optionId: params.optionId,
        locationHash: params.locationHash,
        paymentHash: params.paymentHash,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to record vote: ${error.message}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      voteId: params.voteId,
      oderId: params.oderId,
      optionId: params.optionId,
      timestamp: new Date(data.timestamp),
      locationHash: params.locationHash,
      paymentHash: params.paymentHash,
      txHash: data.txHash,
    };
  }

  /**
   * Mint Sync tokens for a user
   */
  async mintTokens(params: {
    walletAddress: string;
    amount: number;
    reason: 'vote' | 'create_vote';
  }): Promise<TokenMint> {
    const response = await fetch(`${this.config.baseUrl}/tokens/mint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        walletAddress: params.walletAddress,
        amount: params.amount,
        reason: params.reason,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to mint tokens: ${error.message}`);
    }

    const data = await response.json();
    return {
      walletAddress: params.walletAddress,
      amount: params.amount,
      txHash: data.txHash,
      timestamp: new Date(data.timestamp),
    };
  }

  /**
   * Get transaction status
   */
  async getTransaction(txHash: string): Promise<Transaction> {
    const response = await fetch(`${this.config.baseUrl}/transactions/${txHash}`, {
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error('Transaction not found');
    }

    const data = await response.json();
    return {
      hash: data.hash,
      status: data.status,
      blockNumber: data.blockNumber,
      timestamp: data.timestamp ? new Date(data.timestamp) : undefined,
    };
  }

  /**
   * Get user's token balance
   */
  async getTokenBalance(walletAddress: string): Promise<number> {
    const response = await fetch(
      `${this.config.baseUrl}/tokens/balance/${walletAddress}`,
      {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      }
    );

    if (!response.ok) {
      return 0;
    }

    const data = await response.json();
    return data.balance;
  }

  /**
   * Create a new wallet for a user
   */
  async createWallet(oderId: string): Promise<string> {
    const response = await fetch(`${this.config.baseUrl}/wallets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        oderId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create wallet: ${error.message}`);
    }

    const data = await response.json();
    return data.walletAddress;
  }

  /**
   * Verify a vote record on the blockchain
   */
  async verifyVote(txHash: string): Promise<boolean> {
    const transaction = await this.getTransaction(txHash);
    return transaction.status === 'confirmed';
  }

  /**
   * Get vote history for a specific vote
   */
  async getVoteHistory(voteId: string): Promise<VoteRecord[]> {
    const response = await fetch(`${this.config.baseUrl}/votes/${voteId}/history`, {
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.records.map((record: any) => ({
      id: record.id,
      voteId: record.voteId,
      oderId: record.oderId,
      optionId: record.optionId,
      timestamp: new Date(record.timestamp),
      locationHash: record.locationHash,
      paymentHash: record.paymentHash,
      txHash: record.txHash,
    }));
  }
}

export const qubikService = new QubikService();
export type { VoteRecord, TokenMint, Transaction };
