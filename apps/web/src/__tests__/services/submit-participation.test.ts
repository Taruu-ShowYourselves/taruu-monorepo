/**
 * submitParticipation - the pure, fetch-injectable client for
 * `POST /api/votes/[id]/participate`.
 *
 * This repo's vitest runs `environment: 'node'` with a `.ts`-only include
 * glob (see vitest.config.ts) - no jsdom, no @testing-library/react, and
 * `.tsx` files are not even collected. That is exactly why this network
 * logic lives in its own `.ts` module instead of inside ParticipationFlow:
 * it is the only way to get executable proof of the request/response
 * contract at all. `fetch` is injected as a `vi.fn()` - global fetch is
 * never touched.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  submitParticipation,
  PARTICIPATION_MESSAGES,
  type ParticipationSubmission,
} from '@/app/[locale]/votes/[id]/flow/submitParticipation';

const VOTE_ID = 'vote-123';
const OPTION_ID = 'option-abc';

function jsonResponse(status: number, body: unknown, ok = status >= 200 && status < 300): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('submitParticipation - recorded outcomes', () => {
  it('returns a recorded, freshly-cast ballot on a 200 with alreadyRecorded: false', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        success: true,
        alreadyRecorded: false,
        participation: {
          id: 'ballot-1',
          voteId: VOTE_ID,
          userId: 'user-1',
          optionId: OPTION_ID,
          createdAt: '2026-08-02T10:00:00.000Z',
        },
      })
    );

    const result = await submitParticipation({ voteId: VOTE_ID, optionId: OPTION_ID }, fetchImpl);

    expect(result).toEqual<ParticipationSubmission>({
      status: 'recorded',
      alreadyRecorded: false,
      ballot: {
        id: 'ballot-1',
        optionId: OPTION_ID,
        createdAt: '2026-08-02T10:00:00.000Z',
      },
    });
  });

  it('returns the existing ballot on a 200 with alreadyRecorded: true', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        success: true,
        alreadyRecorded: true,
        participation: {
          id: 'ballot-existing',
          voteId: VOTE_ID,
          userId: 'user-1',
          optionId: OPTION_ID,
          createdAt: '2026-08-01T09:00:00.000Z',
        },
      })
    );

    const result = await submitParticipation({ voteId: VOTE_ID, optionId: OPTION_ID }, fetchImpl);

    expect(result.status).toBe('recorded');
    if (result.status === 'recorded') {
      expect(result.alreadyRecorded).toBe(true);
      expect(result.ballot.id).toBe('ballot-existing');
    }
  });

  it('rejects a 200 whose JSON is missing participation.id - never trusts a malformed success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        success: true,
        alreadyRecorded: false,
        participation: { voteId: VOTE_ID, userId: 'user-1', optionId: OPTION_ID, createdAt: 'now' },
      })
    );

    const result = await submitParticipation({ voteId: VOTE_ID, optionId: OPTION_ID }, fetchImpl);

    expect(result.status).toBe('rejected');
  });
});

describe('submitParticipation - rejected outcomes', () => {
  it('maps 401 to UNAUTHENTICATED with the Hebrew sign-in message', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { error: 'Unauthorized' }));
    const result = await submitParticipation({ voteId: VOTE_ID, optionId: OPTION_ID }, fetchImpl);
    expect(result).toEqual({
      status: 'rejected',
      code: 'UNAUTHENTICATED',
      message: PARTICIPATION_MESSAGES.UNAUTHENTICATED,
    });
  });

  it('maps a 403 with code RESIDENCY_NOT_VERIFIED to the residency message', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(403, { error: 'not eligible', code: 'RESIDENCY_NOT_VERIFIED' })
    );
    const result = await submitParticipation({ voteId: VOTE_ID, optionId: OPTION_ID }, fetchImpl);
    expect(result).toEqual({
      status: 'rejected',
      code: 'RESIDENCY_NOT_VERIFIED',
      message: PARTICIPATION_MESSAGES.RESIDENCY_NOT_VERIFIED,
    });
  });

  it('maps a 403 with code IDENTITY_NOT_VERIFIED to the identity message', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(403, { error: 'not eligible', code: 'IDENTITY_NOT_VERIFIED' })
    );
    const result = await submitParticipation({ voteId: VOTE_ID, optionId: OPTION_ID }, fetchImpl);
    expect(result).toEqual({
      status: 'rejected',
      code: 'IDENTITY_NOT_VERIFIED',
      message: PARTICIPATION_MESSAGES.IDENTITY_NOT_VERIFIED,
    });
  });

  it('defaults an unrecognised 403 code to RESIDENCY_NOT_VERIFIED', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(403, { error: 'nope', code: 'SOMETHING_ELSE' }));
    const result = await submitParticipation({ voteId: VOTE_ID, optionId: OPTION_ID }, fetchImpl);
    expect(result).toEqual({
      status: 'rejected',
      code: 'RESIDENCY_NOT_VERIFIED',
      message: PARTICIPATION_MESSAGES.RESIDENCY_NOT_VERIFIED,
    });
  });

  it('maps 429 to the rate-limit message', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(429, { error: 'too many' }));
    const result = await submitParticipation({ voteId: VOTE_ID, optionId: OPTION_ID }, fetchImpl);
    expect(result).toEqual({
      status: 'rejected',
      code: 'RATE_LIMITED',
      message: PARTICIPATION_MESSAGES.RATE_LIMITED,
    });
  });

  it('maps 400 to the "refresh and try again" message', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(400, { error: 'Invalid option' }));
    const result = await submitParticipation({ voteId: VOTE_ID, optionId: OPTION_ID }, fetchImpl);
    expect(result).toEqual({
      status: 'rejected',
      code: 'INVALID',
      message: PARTICIPATION_MESSAGES.INVALID,
    });
  });

  it('maps 404 to "vote not found"', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(404, { error: 'Vote not found' }));
    const result = await submitParticipation({ voteId: VOTE_ID, optionId: OPTION_ID }, fetchImpl);
    expect(result).toEqual({
      status: 'rejected',
      code: 'NOT_FOUND',
      message: PARTICIPATION_MESSAGES.NOT_FOUND,
    });
  });

  it('maps 500 to the generic server-error message', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(500, { error: 'boom' }));
    const result = await submitParticipation({ voteId: VOTE_ID, optionId: OPTION_ID }, fetchImpl);
    expect(result).toEqual({
      status: 'rejected',
      code: 'SERVER_ERROR',
      message: PARTICIPATION_MESSAGES.SERVER_ERROR,
    });
  });

  it('maps any other unexpected status to the generic server-error message', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(418, { error: "I'm a teapot" }));
    const result = await submitParticipation({ voteId: VOTE_ID, optionId: OPTION_ID }, fetchImpl);
    expect(result).toEqual({
      status: 'rejected',
      code: 'SERVER_ERROR',
      message: PARTICIPATION_MESSAGES.SERVER_ERROR,
    });
  });

  it('maps a thrown fetch (offline) to the network-error message', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const result = await submitParticipation({ voteId: VOTE_ID, optionId: OPTION_ID }, fetchImpl);
    expect(result).toEqual({
      status: 'rejected',
      code: 'NETWORK_ERROR',
      message: PARTICIPATION_MESSAGES.NETWORK_ERROR,
    });
  });

  it('never surfaces a raw server error string to the caller', async () => {
    const rawServerMessage = 'raw internal database constraint violation detail';
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(500, { error: rawServerMessage }));
    const result = await submitParticipation({ voteId: VOTE_ID, optionId: OPTION_ID }, fetchImpl);
    expect(JSON.stringify(result)).not.toContain(rawServerMessage);
  });
});

describe('submitParticipation - request shape', () => {
  it('POSTs to /api/votes/{voteId}/participate with exactly { optionId } as the body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        success: true,
        alreadyRecorded: false,
        participation: { id: 'b1', voteId: VOTE_ID, userId: 'u1', optionId: OPTION_ID, createdAt: 'now' },
      })
    );

    await submitParticipation({ voteId: VOTE_ID, optionId: OPTION_ID }, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`/api/votes/${VOTE_ID}/participate`);
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ optionId: OPTION_ID }));
    expect(init.body).not.toContain('paymentTxId');
    expect(init.body).not.toContain('gpsCoordinates');
  });
});
