/**
 * POST /api/space-admin/{spaceId}/notifications/send — dispatch a costed campaign.
 *
 * Thin imperative shell: session → zod parse → use-case → respond. There is no
 * burst gate here on purpose: the monthly quota is a count of campaign rows
 * checked inside the use-case, and it bounds this endpoint far more tightly than
 * any per-minute window could. See `send-notification.ts`.
 */

import { after, type NextRequest } from 'next/server';
import { errAsync } from 'neverthrow';
import { SendNotificationRequestSchema } from '@sync/shared/contracts';
import { sendNotification } from '@/server/app/space-admin/send-notification';
import { unauthorized } from '@/server/http/errors';
import { parse, respond } from '@/server/http/respond';
import { getSessionFromRequest } from '@/services/auth/session';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) return respond(errAsync(unauthorized()));

  const { spaceId } = await params;

  // after() needs a live request scope (unavailable in unit tests) — fall back
  // to fire-and-forget so the push fan-out never blocks or breaks the response.
  // Copied verbatim from `app/api/votes/route.ts`.
  const defer = (task: () => Promise<void>) => {
    try {
      after(task);
    } catch {
      void task().catch(() => {});
    }
  };

  const body = await request.json().catch(() => null);
  const parsed = parse(SendNotificationRequestSchema, body);
  if (parsed.isErr()) return respond(errAsync(parsed.error));

  return respond(sendNotification({ defer }, session, spaceId, parsed.value));
}
