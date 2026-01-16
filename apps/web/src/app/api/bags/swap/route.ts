import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import { bagsService, BagsServiceError } from '@/services/bags';
import { getUserById } from '@/lib/supabase/db';

/**
 * POST /api/bags/swap
 * Execute a token swap on Bags.fm
 *
 * Request body:
 * - quote: The quote object from /api/bags/quote
 * - walletAddress: User's Solana wallet address (optional, uses Qubik wallet if not provided)
 *
 * Requires authentication.
 *
 * IMPORTANT: This endpoint should only be called with a valid quote
 * that was obtained recently (quotes expire).
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
    const { quote, walletAddress } = body;

    // Validate required fields
    if (!quote) {
      return NextResponse.json(
        { error: 'Missing required field: quote' },
        { status: 400 }
      );
    }

    // Validate quote structure
    if (!quote.inputAmount || !quote.outputAmount || !quote.fee) {
      return NextResponse.json(
        { error: 'Invalid quote structure' },
        { status: 400 }
      );
    }

    // Get user's wallet address
    let userWallet = walletAddress;
    if (!userWallet) {
      const user = await getUserById(session.userId);
      if (user?.qubik_wallet_address) {
        userWallet = user.qubik_wallet_address;
      } else {
        return NextResponse.json(
          { error: 'No wallet address provided and user has no Qubik wallet' },
          { status: 400 }
        );
      }
    }

    const swapResult = await bagsService.executeSwap({
      quote,
      userWallet,
    });

    return NextResponse.json({
      success: true,
      swap: {
        txSignature: swapResult.txSignature,
        inputAmount: swapResult.inputAmount,
        outputAmount: swapResult.outputAmount,
        fee: swapResult.fee,
        walletAddress: userWallet,
      },
    });
  } catch (error) {
    console.error('Error executing swap:', error);

    if (error instanceof BagsServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to execute swap' },
      { status: 500 }
    );
  }
}
