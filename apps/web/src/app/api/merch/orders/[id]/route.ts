/**
 * GET /api/merch/orders/[id]
 *
 * Reads a persisted merch order for the thank-you page. Requires sign-in and
 * ownership — a buyer can only read their own order.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import { getMerchOrderById } from '@/lib/supabase/db';
import type { CartItem, MerchOrder, ShippingAddress } from '@sync/shared';
import type { MerchOrderRow } from '@/lib/supabase/types';

function toOrder(row: MerchOrderRow): MerchOrder {
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    items: row.items as unknown as CartItem[],
    subtotalILS: row.subtotal_ils,
    shippingILS: row.shipping_ils,
    totalILS: row.total_ils,
    currency: 'ILS',
    status: row.status,
    shipping: row.shipping as unknown as ShippingAddress,
    paymentId: row.payment_id ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const row = await getMerchOrderById(id);

  if (!row || row.user_id !== session.userId) {
    // Don't leak existence of orders that aren't the caller's.
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  return NextResponse.json({ order: toOrder(row) });
}
