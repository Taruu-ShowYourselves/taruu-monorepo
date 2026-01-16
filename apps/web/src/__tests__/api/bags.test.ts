/**
 * Bags.fm API Route Tests
 *
 * Tests for the /api/bags endpoints:
 * - POST /api/bags/quote - Get swap quote
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/bags/quote/route';

// Mock session service
vi.mock('@/services/auth/session', () => ({
  getSessionFromRequest: vi.fn(),
}));

// Mock bags service
vi.mock('@/services/bags', () => ({
  bagsService: {
    isConfigured: vi.fn(),
    getQuote: vi.fn(),
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
import { bagsService, BagsServiceError } from '@/services/bags';

describe('Bags API Routes', () => {
  const mockSession = {
    userId: 'user-123',
    googleId: 'google-123',
    email: 'test@example.com',
    did: 'did:sync:' + 'a'.repeat(43),
    expiresAt: Date.now() + 86400000,
  };

  const mockQuote = {
    inputAmount: '1000000000',
    outputAmount: '950000000',
    priceImpact: 0.05,
    fee: '10000000',
    route: ['SOL', 'USDC'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (bagsService.isConfigured as Mock).mockReturnValue(true);
  });

  describe('POST /api/bags/quote', () => {
    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/bags/quote', {
        method: 'POST',
        body: JSON.stringify({
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          amount: '1000000000',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 503 when Bags.fm is not configured', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (bagsService.isConfigured as Mock).mockReturnValue(false);

      const request = new NextRequest('http://localhost:3000/api/bags/quote', {
        method: 'POST',
        body: JSON.stringify({
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          amount: '1000000000',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe('Bags.fm integration is not configured');
    });

    it('should return 400 when inputMint is missing', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/bags/quote', {
        method: 'POST',
        body: JSON.stringify({
          outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          amount: '1000000000',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: inputMint, outputMint, amount');
    });

    it('should return 400 when outputMint is missing', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/bags/quote', {
        method: 'POST',
        body: JSON.stringify({
          inputMint: 'So11111111111111111111111111111111111111112',
          amount: '1000000000',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: inputMint, outputMint, amount');
    });

    it('should return 400 when amount is missing', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/bags/quote', {
        method: 'POST',
        body: JSON.stringify({
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: inputMint, outputMint, amount');
    });

    it('should return 400 when amount is invalid', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/bags/quote', {
        method: 'POST',
        body: JSON.stringify({
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          amount: 'invalid',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid amount: must be a positive number');
    });

    it('should return 400 when amount is negative', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/bags/quote', {
        method: 'POST',
        body: JSON.stringify({
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          amount: '-100',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid amount: must be a positive number');
    });

    it('should return 400 when slippageBps is invalid', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/bags/quote', {
        method: 'POST',
        body: JSON.stringify({
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          amount: '1000000000',
          slippageBps: 10000, // Too high (max 5000)
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid slippageBps: must be an integer between 0 and 5000');
    });

    it('should return 400 when slippageBps is negative', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/bags/quote', {
        method: 'POST',
        body: JSON.stringify({
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          amount: '1000000000',
          slippageBps: -50,
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid slippageBps: must be an integer between 0 and 5000');
    });

    it('should return quote successfully with default slippage', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (bagsService.getQuote as Mock).mockResolvedValue(mockQuote);

      const request = new NextRequest('http://localhost:3000/api/bags/quote', {
        method: 'POST',
        body: JSON.stringify({
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          amount: '1000000000',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.quote).toBeDefined();
      expect(data.quote.inputMint).toBe('So11111111111111111111111111111111111111112');
      expect(data.quote.outputMint).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
      expect(data.quote.inputAmount).toBe('1000000000');
      expect(data.quote.outputAmount).toBe('950000000');
      expect(data.quote.priceImpact).toBe(0.05);
      expect(data.quote.slippageBps).toBe(50); // Default
      expect(bagsService.getQuote).toHaveBeenCalledWith({
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amount: '1000000000',
        slippageBps: 50,
      });
    });

    it('should return quote successfully with custom slippage', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (bagsService.getQuote as Mock).mockResolvedValue(mockQuote);

      const request = new NextRequest('http://localhost:3000/api/bags/quote', {
        method: 'POST',
        body: JSON.stringify({
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          amount: '1000000000',
          slippageBps: 100,
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.quote.slippageBps).toBe(100);
      expect(bagsService.getQuote).toHaveBeenCalledWith(
        expect.objectContaining({
          slippageBps: 100,
        })
      );
    });

    it('should handle BagsServiceError', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      const error = new BagsServiceError('Insufficient liquidity', 'INSUFFICIENT_LIQUIDITY', 400);
      (bagsService.getQuote as Mock).mockRejectedValue(error);

      const request = new NextRequest('http://localhost:3000/api/bags/quote', {
        method: 'POST',
        body: JSON.stringify({
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          amount: '1000000000',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Insufficient liquidity');
      expect(data.code).toBe('INSUFFICIENT_LIQUIDITY');
    });

    it('should handle generic errors gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (bagsService.getQuote as Mock).mockRejectedValue(new Error('Network error'));

      const request = new NextRequest('http://localhost:3000/api/bags/quote', {
        method: 'POST',
        body: JSON.stringify({
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          amount: '1000000000',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get swap quote');
    });
  });
});
