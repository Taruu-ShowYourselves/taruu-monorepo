import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import { getUserTreasuryTransactions } from '@/lib/supabase/db';
import type { TreasuryTransactionType } from '@sync/shared';

const VALID_TYPES: TreasuryTransactionType[] = [
  'deposit',
  'allocation',
  'withdrawal',
  'fee_claim',
  'token_purchase',
  'nft_mint',
];

/**
 * GET /api/user/treasury-contributions
 *
 * The session user's OWN treasury transactions — the personal contribution
 * ledger shown on the dashboard's "הקרן" tab.
 *
 * Ownership is enforced in SQL (`user_id = session.userId`), not by the
 * caller, so:
 * - another user's rows can never be returned;
 * - rows with a NULL `user_id` (owned by nobody) can never be attributed here;
 * - there is no municipality parameter, so there is nothing to enumerate.
 *
 * The municipality-wide ledger lives at
 * GET /api/treasury/[municipality]/transactions and carries no user identifiers.
 *
 * Query parameters:
 * - limit: Number of transactions to return (default 50, max 100)
 * - offset: Pagination offset (default 0)
 * - type: Filter by transaction type
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(
      Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50),
      100
    );
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);
    const type = searchParams.get('type') || undefined;

    if (type && !VALID_TYPES.includes(type as TreasuryTransactionType)) {
      return NextResponse.json(
        { error: 'Invalid transaction type' },
        { status: 400 }
      );
    }

    const transactions = await getUserTreasuryTransactions(session.userId, {
      limit,
      offset,
      type: type as TreasuryTransactionType | undefined,
    });

    // Every row here already belongs to the caller, so echoing `userId` back
    // would add nothing but a copy of their own session id. `paymentId` is an
    // internal identifier the dashboard does not use.
    const transformedTransactions = transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      voteId: tx.vote_id,
      amountILS: tx.amount_ils,
      amountSOL: tx.amount_sol,
      description: tx.description,
      status: tx.status,
      createdAt: tx.created_at,
    }));

    return NextResponse.json({
      transactions: transformedTransactions,
      pagination: {
        total: transformedTransactions.length,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Error fetching user treasury contributions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch treasury contributions' },
      { status: 500 }
    );
  }
}
