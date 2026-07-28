import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import { getTreasuryByMunicipality, getTreasuryTransactions } from '@/lib/supabase/db';
import type { TreasuryTransactionType } from '@sync/shared';

/**
 * Keys of `treasury_transactions.metadata` that are safe to publish on the
 * municipality-wide ledger.
 *
 * `metadata` is an open `Record<string, unknown>` at the write side
 * (`recordTreasuryTransaction` in lib/supabase/db.ts), so nothing stops a
 * future writer from putting a wallet address, e-mail or internal id in there.
 * Publishing it wholesale would silently turn that into a data leak, so this
 * endpoint is fail-closed: anything not named here is dropped.
 *
 * Current writers only ever set `tokenMint` (a public Solana mint address) and
 * `ilsPerSol` (an FX rate) — see services/treasury/bagSeeding.ts. The deposit
 * path (SQL `record_treasury_deposit`) never sets metadata at all.
 *
 * Before adding a key here, confirm it identifies a TOKEN or a RATE, never a
 * PERSON, a payment, or an internal record.
 */
const PUBLIC_METADATA_KEYS = ['tokenMint', 'ilsPerSol'] as const;

/**
 * Project `metadata` down to the published whitelist. Returns null when there
 * is nothing publishable, so the field shape stays as it was.
 *
 * The whitelist is enforced at BOTH levels:
 * - key level: only `PUBLIC_METADATA_KEYS` are copied;
 * - value level: only primitives are copied, so a nested object or array
 *   smuggled in under a whitelisted key (`{ tokenMint: { mint, ownerEmail } }`)
 *   cannot carry extra fields out with it.
 *
 * `hasOwnProperty` is called off `Object.prototype` because the JSONB value is
 * attacker-shaped data, and inherited keys must not satisfy the check.
 */
function redactMetadata(metadata: unknown): Record<string, unknown> | null {
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const source = metadata as Record<string, unknown>;
  const safe: Record<string, unknown> = {};

  for (const key of PUBLIC_METADATA_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;

    const value = source[key];
    const isPrimitive =
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean';

    if (isPrimitive) {
      safe[key] = value;
    }
  }

  return Object.keys(safe).length > 0 ? safe : null;
}

/**
 * GET /api/treasury/[municipality]/transactions
 * Municipality-level treasury ledger. Powers the transparency board at
 * /treasury, which lets a reader inspect any town's fund.
 *
 * Query parameters:
 * - limit: Number of transactions to return (default 50, max 100)
 * - offset: Pagination offset (default 0)
 * - type: Filter by transaction type (deposit, allocation, withdrawal, fee_claim, token_purchase, nft_mint)
 *
 * SCOPE: municipality-wide by design — a transparency ledger is meant to show
 * what a town's fund collected and spent. It therefore MUST NOT carry per-user
 * identifiers. `userId` and `paymentId` are deliberately omitted: they used to
 * be returned in full, which let any authenticated caller enumerate who paid
 * what, in any municipality.
 *
 * For a reader's OWN contributions use GET /api/user/treasury-contributions,
 * which scopes rows to the session user in SQL.
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

    // Transform to API response format.
    // `user_id` / `payment_id` are intentionally NOT mapped — see the scope
    // note above. Do not reintroduce them here.
    const transformedTransactions = transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      voteId: tx.vote_id,
      amountILS: tx.amount_ils,
      amountSOL: tx.amount_sol,
      description: tx.description,
      bagsTxHash: tx.bags_tx_hash,
      status: tx.status,
      metadata: redactMetadata(tx.metadata),
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
