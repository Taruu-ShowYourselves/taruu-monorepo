/**
 * Casting a ballot, as a pure async function.
 *
 * Extracted from ParticipationFlow so the network contract has executable
 * proof: this repo's vitest runs `environment: 'node'` with a `.ts`-only
 * include glob, so logic living inside the `.tsx` component cannot be tested
 * at all. `fetch` is injected for the same reason.
 *
 * Server messages are never surfaced verbatim - the caller gets a Hebrew,
 * user-facing string chosen from the status and the machine code.
 */

export interface RecordedBallot {
  readonly id: string;
  readonly optionId: string;
  /** ISO-8601, straight from the server row. Never a client clock. */
  readonly createdAt: string;
}

export type ParticipationRejectionCode =
  | 'UNAUTHENTICATED'
  | 'RESIDENCY_NOT_VERIFIED'
  | 'IDENTITY_NOT_VERIFIED'
  | 'RATE_LIMITED'
  | 'VOTE_ENDED'
  | 'VOTE_NOT_OPEN'
  | 'INVALID'
  | 'NOT_FOUND'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR';

/**
 * Rejections that retrying cannot fix. The UI must stop inviting another
 * attempt on these - a vote that has ended will not un-end because the
 * resident pressed the button again.
 */
export const TERMINAL_REJECTION_CODES = [
  'VOTE_ENDED',
  'VOTE_NOT_OPEN',
  'NOT_FOUND',
] as const satisfies readonly ParticipationRejectionCode[];

export function isTerminalRejection(code: ParticipationRejectionCode): boolean {
  return (TERMINAL_REJECTION_CODES as readonly string[]).includes(code);
}

export type ParticipationSubmission =
  | { readonly status: 'recorded'; readonly ballot: RecordedBallot; readonly alreadyRecorded: boolean }
  | { readonly status: 'rejected'; readonly code: ParticipationRejectionCode; readonly message: string };

/** The same Hebrew strings the UI shows - kept here so tests assert the copy once. */
export const PARTICIPATION_MESSAGES: Record<ParticipationRejectionCode, string> = {
  UNAUTHENTICATED: 'צריך להתחבר כדי להצביע.',
  RESIDENCY_NOT_VERIFIED: 'צריך לאמת תושבוּת לפני ההצבעה.',
  IDENTITY_NOT_VERIFIED: 'צריך לאמת זהות לפני ההצבעה.',
  RATE_LIMITED: 'יותר מדי בקשות. נסו שוב בעוד דקה.',
  VOTE_ENDED: 'ההצבעה נסגרה והקול לא נרשם. אפשר לצפות בתוצאות.',
  VOTE_NOT_OPEN: 'ההצבעה עדיין לא נפתחה.',
  INVALID: 'לא ניתן לרשום את הקול הזה. רעננו את הדף ונסו שוב.',
  NOT_FOUND: 'ההצבעה לא נמצאה.',
  SERVER_ERROR: 'הקול לא נרשם. נסו שוב בעוד רגע.',
  NETWORK_ERROR: 'הקול לא נרשם. בדקו את החיבור ונסו שוב.',
};

interface ParticipationPayload {
  readonly participation?: {
    readonly id?: unknown;
    readonly optionId?: unknown;
    readonly createdAt?: unknown;
  };
  readonly alreadyRecorded?: unknown;
  readonly code?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isParticipationPayload(value: unknown): value is ParticipationPayload {
  return isRecord(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function rejected(code: ParticipationRejectionCode): ParticipationSubmission {
  return { status: 'rejected', code, message: PARTICIPATION_MESSAGES[code] };
}

export async function submitParticipation(
  input: { readonly voteId: string; readonly optionId: string },
  fetchImpl: typeof fetch = fetch
): Promise<ParticipationSubmission> {
  let response: Response;
  try {
    response = await fetchImpl(`/api/votes/${input.voteId}/participate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ optionId: input.optionId }),
    });
  } catch {
    return rejected('NETWORK_ERROR');
  }

  const payload: unknown = await response.json().catch(() => null);

  if (response.ok) {
    if (
      isParticipationPayload(payload) &&
      isNonEmptyString(payload.participation?.id) &&
      isNonEmptyString(payload.participation?.optionId) &&
      isNonEmptyString(payload.participation?.createdAt)
    ) {
      return {
        status: 'recorded',
        alreadyRecorded: payload.alreadyRecorded === true,
        ballot: {
          id: payload.participation.id,
          optionId: payload.participation.optionId,
          createdAt: payload.participation.createdAt,
        },
      };
    }
    // Never trust a malformed 200 - a missing ballot id is not a recorded vote.
    return rejected('SERVER_ERROR');
  }

  const errorCode = isParticipationPayload(payload) && typeof payload.code === 'string'
    ? payload.code
    : undefined;

  switch (response.status) {
    case 401:
      return rejected('UNAUTHENTICATED');
    case 403:
      return rejected(errorCode === 'IDENTITY_NOT_VERIFIED' ? 'IDENTITY_NOT_VERIFIED' : 'RESIDENCY_NOT_VERIFIED');
    case 429:
      return rejected('RATE_LIMITED');
    case 400:
      // 400 covers five distinct server conditions. Only the ones the resident
      // can act on differently are split out; the rest stay generic.
      if (errorCode === 'VOTE_ENDED') return rejected('VOTE_ENDED');
      if (errorCode === 'VOTE_NOT_OPEN') return rejected('VOTE_NOT_OPEN');
      return rejected('INVALID');
    case 404:
      return rejected('NOT_FOUND');
    default:
      return rejected('SERVER_ERROR');
  }
}
