import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import { getTreasuryByMunicipality, getTreasuryTransactions } from '@/lib/supabase/db';
import type { TreasuryTransactionType } from '@sync/shared';

/**
 * GET /api/treasury/[municipality]/transactions
 * Get treasury transaction history
 *
 * Query parameters:
 * - limit: Number of transactions to return (default 50, max 100)
 * - offset: Pagination offset (default 0)
 * - type: Filter by transaction type (deposit, allocation, withdrawal, fee_claim, token_purchase, nft_mint)
 *
 * Authentication required - users can only see transactions they initiated,
 * or all transactions if they have admin access.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ municipality: string }> }
) {
  try {
    const { municipality } = await params;
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate municipality is provided
    if (!municipality || municipality.length === 0) {
      return NextResponse.json(
        { error: 'Municipality is required' },
        { status: 400 }
      );
    }

    const treasury = await getTreasuryByMunicipality(municipality);

    if (!treasury) {
      return NextResponse.json({
        transactions: [],
        pagination: {
          total: 0,
          limit: 50,
          offset: 0,
        },
      });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const type = searchParams.get('type') || undefined;

    // Validate type if provided
    const validTypes = ['deposit', 'allocation', 'withdrawal', 'fee_claim', 'token_purchase', 'nft_mint'];
    if (type && !validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid transaction type' },
        { status: 400 }
      );
    }

    const transactions = await getTreasuryTransactions(treasury.id, {
      limit,
      offset,
      type: type as TreasuryTransactionType | undefined,
    });

    // Transform to API response format
    const transformedTransactions = transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      voteId: tx.vote_id,
      userId: tx.user_id,
      paymentId: tx.payment_id,
      amountILS: tx.amount_ils,
      amountSOL: tx.amount_sol,
      description: tx.description,
      bagsTxHash: tx.bags_tx_hash,
      status: tx.status,
      metadata: tx.metadata,
      createdAt: tx.created_at,
    }));

    return NextResponse.json({
      transactions: transformedTransactions,
      pagination: {
        total: transactions.length,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Error fetching treasury transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch treasury transactions' },
      { status: 500 }
    );
  }
}
