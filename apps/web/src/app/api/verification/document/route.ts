/**
 * /api/verification/document — identity-document verification (issue #32).
 *
 * POST   submit on-device-extracted fields (never images) for verification
 * GET    current document status for the signed-in user
 * DELETE user-initiated erasure of identity fields (PPL §14 deletion right)
 *
 * Thin imperative shell: session → rate limit → zod parse → use-case → respond.
 */

import { NextRequest, NextResponse } from 'next/server';
import { errAsync } from 'neverthrow';
import { SubmitIdentityDocumentRequestSchema } from '@sync/shared/contracts';
import { getSessionFromRequest } from '@/services/auth/session';
import { identityDocumentLimiter, createRateLimitResponse } from '@/lib/rate-limit';
import { parse, respond } from '@/server/http/respond';
import { unauthorized } from '@/server/http/errors';
import { submitIdentityDocument } from '@/server/app/identity/submit-document';
import { maskIdNumber } from '@/server/domain/identity/decision';
import {
  deleteDocumentByUserId,
  findDocumentByUserId,
  insertDocumentEvent,
  setUserIdentityVerifiedAt,
} from '@/server/infra/supabase/identity.repo';

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return respond(errAsync(unauthorized()));

  const limit = await identityDocumentLimiter.check(session.userId);
  if (limit.limited) {
    return createRateLimitResponse(limit) as NextResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = parse(SubmitIdentityDocumentRequestSchema, body);
  if (parsed.isErr()) return respond(errAsync(parsed.error));

  return respond(submitIdentityDocument({}, session.userId, parsed.value));
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return respond(errAsync(unauthorized()));

  return respond(
    findDocumentByUserId(session.userId).map((doc) => ({
      document: doc
        ? {
            status: doc.status,
            documentType: doc.document_type,
            idNumberMasked: maskIdNumber(`0000000${doc.id_number_last2}`),
            verifiedAt: doc.verified_at,
          }
        : null,
    }))
  );
}

export async function DELETE(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return respond(errAsync(unauthorized()));

  return respond(
    deleteDocumentByUserId(session.userId)
      .andThen(() => setUserIdentityVerifiedAt(session.userId, null))
      .andThen(() =>
        insertDocumentEvent({ user_id: session.userId, event: 'deleted', detail: null })
      )
      .map(() => ({ deleted: true }))
  );
}
