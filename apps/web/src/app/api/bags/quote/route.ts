import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import { bagsService, BagsServiceError } from '@/services/bags';
import type { QuoteParams } from '@sync/shared';

/**
 * POST /api/bags/quote
 * Get a swap quote from Bags.fm
 *
 * Request body:
 * - inputMint: Input token mint address
 * - outputMint: Output token mint address
 * - amount: Amount to swap (as string)
 * - slippageBps: Slippage tolerance in basis points (optional, default 50 = 0.5%)
 *
 * Requires authentication.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if Bags.fm is configured
    if (!bagsService.isConfigured()) {
      return NextResponse.json(
        { error: 'Bags.fm integration is not configured' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { inputMint, outputMint, amount, slippageBps } = body;

    // Validate required fields
    if (!inputMint || !outputMint || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: inputMint, outputMint, amount' },
        { status: 400 }
      );
    }

    // Validate amount is a valid number string
    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount: must be a positive number' },
        { status: 400 }
      );
    }

    // Validate slippageBps if provided
    if (slippageBps !== undefined) {
      if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 5000) {
        return NextResponse.json(
          { error: 'Invalid slippageBps: must be an integer between 0 and 5000' },
          { status: 400 }
        );
      }
    }

    const quoteParams: QuoteParams = {
      inputMint,
      outputMint,
      amount: String(amount),
      slippageBps: slippageBps || 50,
    };

    const quote = await bagsService.getQuote(quoteParams);

    return NextResponse.json({
      quote: {
        inputMint,
        outputMint,
        inputAmount: quote.inputAmount,
        outputAmount: quote.outputAmount,
        priceImpact: quote.priceImpact,
        fee: quote.fee,
        route: quote.route,
        slippageBps: quoteParams.slippageBps,
      },
    });
  } catch (error) {
    console.error('Error getting quote:', error);

    if (error instanceof BagsServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to get swap quote' },
      { status: 500 }
    );
  }
}
