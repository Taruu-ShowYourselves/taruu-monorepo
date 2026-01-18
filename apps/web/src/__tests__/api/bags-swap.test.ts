/**
 * Bags.fm Swap API Route Tests
 *
 * Tests for the /api/bags/swap endpoint:
 * - POST /api/bags/swap - Execute token swap
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/bags/swap/route';

// Mock session service
vi.mock('@/services/auth/session', () => ({
  getSessionFromRequest: vi.fn(),
}));

// Mock database functions
vi.mock('@/lib/supabase/db', () => ({
  getUserById: vi.fn(),
}));

// Mock bags service
vi.mock('@/services/bags', () => ({
  bagsService: {
    isConfigured: vi.fn(),
    executeSwap: vi.fn(),
  },
  BagsServiceError: class BagsServiceError extends Error {
    code: string;
    status: number;
    constructor(message: string, code: string, status: number = 500) {
      super(message);
      this.code = code;
      this.status = status;
    }
  },
}));

// Import mocked modules
import { getSessionFromRequest } from '@/services/auth/session';
import { getUserById } from '@/lib/supabase/db';
import { bagsService, BagsServiceError } from '@/services/bags';

describe('Bags Swap API Routes', () => {
  const mockSession = {
    userId: 'user-123',
    googleId: 'google-123',
    email: 'test@example.com',
    did: 'did:sync:' + 'a'.repeat(43),
    expiresAt: Date.now() + 86400000,
  };

  const mockUser = {
    id: 'user-123',
    qubik_wallet_address: 'QubikWalletAddress123456789',
  };

  const mockQuote = {
    inputAmount: '1000000000',
    outputAmount: '950000000',
    fee: '10000000',
    priceImpact: 0.05,
    route: ['SOL', 'USDC'],
  };

  const mockSwapResult = {
    txSignature: 'SwapTxSignature123456789',
    inputAmount: '1000000000',
    outputAmount: '950000000',
    fee: '10000000',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (bagsService.isConfigured as Mock).mockReturnValue(true);
  });

  describe('POST /api/bags/swap', () => {
    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/bags/swap', {
        method: 'POST',
        body: JSON.stringify({ quote: mockQuote }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 503 when Bags.fm is not configured', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (bagsService.isConfigured as Mock).mockReturnValue(false);

      const request = new NextRequest('http://localhost:3000/api/bags/swap', {
        method: 'POST',
        body: JSON.stringify({ quote: mockQuote }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe('Bags.fm integration is not configured');
    });

    it('should return 400 when quote is missing', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/bags/swap', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required field: quote');
    });

    it('should return 400 when quote structure is invalid', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/bags/swap', {
        method: 'POST',
        body: JSON.stringify({ quote: { inputAmount: '1000' } }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid quote structure');
    });

    it('should return 400 when no wallet address available', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue({ id: 'user-123', qubik_wallet_address: null });

      const request = new NextRequest('http://localhost:3000/api/bags/swap', {
        method: 'POST',
        body: JSON.stringify({ quote: mockQuote }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No wallet address provided and user has no Qubik wallet');
    });

    it('should execute swap with user Qubik wallet', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (bagsService.executeSwap as Mock).mockResolvedValue(mockSwapResult);

      const request = new NextRequest('http://localhost:3000/api/bags/swap', {
        method: 'POST',
        body: JSON.stringify({ quote: mockQuote }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.swap.txSignature).toBe('SwapTxSignature123456789');
      expect(data.swap.walletAddress).toBe('QubikWalletAddress123456789');
      expect(bagsService.executeSwap).toHaveBeenCalledWith({
        quote: mockQuote,
        userWallet: 'QubikWalletAddress123456789',
      });
    });

    it('should execute swap with provided wallet address', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (bagsService.executeSwap as Mock).mockResolvedValue(mockSwapResult);

      const customWallet = 'CustomWalletAddress123456789';
      const request = new NextRequest('http://localhost:3000/api/bags/swap', {
        method: 'POST',
        body: JSON.stringify({ quote: mockQuote, walletAddress: customWallet }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.swap.walletAddress).toBe(customWallet);
      expect(bagsService.executeSwap).toHaveBeenCalledWith({
        quote: mockQuote,
        userWallet: customWallet,
      });
    });

    it('should handle BagsServiceError', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      const error = new BagsServiceError('Insufficient balance', 'INSUFFICIENT_BALANCE', 400);
      (bagsService.executeSwap as Mock).mockRejectedValue(error);

      const request = new NextRequest('http://localhost:3000/api/bags/swap', {
        method: 'POST',
        body: JSON.stringify({ quote: mockQuote }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Insufficient balance');
      expect(data.code).toBe('INSUFFICIENT_BALANCE');
    });

    it('should handle quote expiration error', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      const error = new BagsServiceError('Quote expired', 'QUOTE_EXPIRED', 400);
      (bagsService.executeSwap as Mock).mockRejectedValue(error);

      const request = new NextRequest('http://localhost:3000/api/bags/swap', {
        method: 'POST',
        body: JSON.stringify({ quote: mockQuote }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Quote expired');
      expect(data.code).toBe('QUOTE_EXPIRED');
    });

    it('should handle generic errors gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (bagsService.executeSwap as Mock).mockRejectedValue(new Error('Network error'));

      const request = new NextRequest('http://localhost:3000/api/bags/swap', {
        method: 'POST',
        body: JSON.stringify({ quote: mockQuote }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to execute swap');
    });
  });
});
