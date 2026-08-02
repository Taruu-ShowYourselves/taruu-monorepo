/**
 * Vote Participation API Route Tests
 *
 * Tests for vote-related endpoints:
 * - POST /api/votes/[id]/participate - Cast a vote
 * - POST /api/votes/[id]/verify-location - Verify GPS location
 * - GET /api/votes/[id]/participated - Check if user participated
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as participate } from '@/app/api/votes/[id]/participate/route';
import { POST as verifyLocation } from '@/app/api/votes/[id]/verify-location/route';
import { GET as checkParticipated } from '@/app/api/votes/[id]/participated/route';

// Mock session service
vi.mock('@/services/auth/session', () => ({
  getSessionFromRequest: vi.fn(),
}));

// Mock database functions
vi.mock('@/lib/supabase/db', () => ({
  getVoteWithOptions: vi.fn(),
  getVoteById: vi.fn(),
  hasUserParticipated: vi.fn(),
  getUserByGoogleId: vi.fn(),
  getUserById: vi.fn(),
  recordUserVote: vi.fn(),
  recordUserVoteOnce: vi.fn(),
  incrementVoteOption: vi.fn(),
  updateUser: vi.fn(),
  getActiveVerificationRun: vi.fn(),
}));

// Mock server-side voter eligibility (the residency/identity gate)
vi.mock('@/services/verification/eligibility', () => ({
  checkVoterEligibility: vi.fn(),
}));

// Mock Supabase admin
vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    })),
  },
}));

// Mock Qubik service
vi.mock('@/services/qubik', () => ({
  qubikService: {
    recordVote: vi.fn(),
    mintTokens: vi.fn(),
  },
}));

// Mock email service
vi.mock('@/services/email', () => ({
  emailService: {
    sendPaymentReceiptEmail: vi.fn(),
  },
}));

// Mock rate limiter (async check method)
vi.mock('@/lib/rate-limit', () => ({
  voteParticipationLimiter: {
    check: vi.fn(() => Promise.resolve({ limited: false })),
  },
  createRateLimitResponse: vi.fn(),
}));

// Mock municipality service
vi.mock('@/services/verification/municipality', () => ({
  verifyLocationInMunicipality: vi.fn(),
  findMunicipalityByCoordinates: vi.fn(),
  verifyCheckIn: vi.fn(),
}));

// Import mocked modules for type-safe access
import { getSessionFromRequest } from '@/services/auth/session';
import {
  getVoteWithOptions,
  getVoteById,
  hasUserParticipated,
  getUserByGoogleId,
  getUserById,
  recordUserVoteOnce,
  incrementVoteOption,
} from '@/lib/supabase/db';
import { checkVoterEligibility } from '@/services/verification/eligibility';
import { supabaseAdmin } from '@/lib/supabase/server';
import { qubikService } from '@/services/qubik';
import { emailService } from '@/services/email';
import { voteParticipationLimiter, createRateLimitResponse } from '@/lib/rate-limit';
import {
  verifyLocationInMunicipality,
  findMunicipalityByCoordinates,
  verifyCheckIn,
} from '@/services/verification/municipality';

describe('Vote Participation API Routes', () => {
  const mockSession = {
    userId: 'user-123',
    googleId: 'google-123',
    email: 'test@example.com',
    did: 'did:sync:' + 'a'.repeat(43),
    expiresAt: Date.now() + 86400000,
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    identity_score: 60,
    verification_status: 'verified',
    municipality_id: 'tel-aviv',
    qubik_wallet_address: 'wallet-123',
  };

  // Use future dates to avoid "vote has ended" errors
  const futureEndDate = new Date(Date.now() + 86400000 * 365).toISOString(); // 1 year from now
  const pastStartDate = new Date(Date.now() - 86400000).toISOString(); // 1 day ago

  const mockVote = {
    id: 'vote-123',
    title: 'Test Vote',
    description: 'A test vote',
    municipality_id: 'tel-aviv',
    creator_id: 'user-456',
    status: 'active',
    start_date: pastStartDate,
    end_date: futureEndDate,
    participant_count: 10,
    options: [
      { id: '00000000-0000-4000-8000-000000000001', text: 'Option A', votes: 5 },
      { id: '00000000-0000-4000-8000-000000000002', text: 'Option B', votes: 5 },
    ],
    created_at: pastStartDate,
    updated_at: pastStartDate,
  };

  const createParams = (id: string) => Promise.resolve({ id });

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: GPS passes server-side municipality verification.
    (verifyCheckIn as Mock).mockReturnValue({
      verified: true,
      inMunicipality: true,
      accuracyAcceptable: true,
    });
  });

  describe('POST /api/votes/[id]/participate', () => {
    const OPTION_1 = '00000000-0000-4000-8000-000000000001';
    const OPTION_2 = '00000000-0000-4000-8000-000000000002';

    const validParticipateData = { optionId: OPTION_1 };

    /** Happy-path mocks shared by the recording/tally/idempotency tests. */
    const setUpHappyPath = () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (voteParticipationLimiter.check as Mock).mockResolvedValue({ limited: false });
      (getVoteWithOptions as Mock).mockResolvedValue(mockVote);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);
      (checkVoterEligibility as Mock).mockResolvedValue({ eligible: true });
    };

    it('returns 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/participate', {
        method: 'POST',
        body: JSON.stringify(validParticipateData),
      });
      const response = await participate(request, { params: createParams('vote-123') });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 429 when rate limited', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (voteParticipationLimiter.check as Mock).mockResolvedValue({ limited: true, remaining: 0 });
      (createRateLimitResponse as Mock).mockReturnValue(
        new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 })
      );

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/participate', {
        method: 'POST',
        body: JSON.stringify(validParticipateData),
      });
      const response = await participate(request, { params: createParams('vote-123') });

      expect(response.status).toBe(429);
      expect(voteParticipationLimiter.check).toHaveBeenCalledWith(mockSession.userId);
    });

    it('returns 400 when optionId is missing', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (voteParticipationLimiter.check as Mock).mockResolvedValue({ limited: false });

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/participate', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await participate(request, { params: createParams('vote-123') });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).not.toContain('paymentTxId');
      expect(data.error).not.toContain('gpsCoordinates');
    });

    it('accepts a body with no paymentTxId and never returns 402', async () => {
      setUpHappyPath();
      (recordUserVoteOnce as Mock).mockResolvedValue({
        created: true,
        vote: {
          id: 'user-vote-123',
          user_id: mockSession.userId,
          vote_id: 'vote-123',
          option_id: OPTION_1,
          created_at: '2026-08-02T12:00:00.000Z',
        },
      });

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/participate', {
        method: 'POST',
        body: JSON.stringify(validParticipateData),
      });
      const response = await participate(request, { params: createParams('vote-123') });

      expect(response.status).toBe(200);
      expect(response.status).not.toBe(402);
    });

    it('returns 404 when vote not found', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (voteParticipationLimiter.check as Mock).mockResolvedValue({ limited: false });
      (getVoteWithOptions as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/votes/nonexistent/participate', {
        method: 'POST',
        body: JSON.stringify(validParticipateData),
      });
      const response = await participate(request, { params: createParams('nonexistent') });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Vote not found');
    });

    it('returns 400 when vote is not active', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (voteParticipationLimiter.check as Mock).mockResolvedValue({ limited: false });
      (getVoteWithOptions as Mock).mockResolvedValue({ ...mockVote, status: 'pending' });

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/participate', {
        method: 'POST',
        body: JSON.stringify(validParticipateData),
      });
      const response = await participate(request, { params: createParams('vote-123') });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Vote is not active');
    });

    it('returns 400 when vote has ended', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (voteParticipationLimiter.check as Mock).mockResolvedValue({ limited: false });
      const pastEndDate = new Date(Date.now() - 86400000).toISOString(); // 1 day ago
      (getVoteWithOptions as Mock).mockResolvedValue({
        ...mockVote,
        end_date: pastEndDate,
      });

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/participate', {
        method: 'POST',
        body: JSON.stringify(validParticipateData),
      });
      const response = await participate(request, { params: createParams('vote-123') });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Vote has ended');
    });

    it('returns 400 when option is invalid', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (voteParticipationLimiter.check as Mock).mockResolvedValue({ limited: false });
      (getVoteWithOptions as Mock).mockResolvedValue(mockVote);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/participate', {
        method: 'POST',
        body: JSON.stringify({ optionId: '00000000-0000-4000-8000-00000000dead' }),
      });
      const response = await participate(request, { params: createParams('vote-123') });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid option');
    });

    it('returns 400 when user profile not found', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (voteParticipationLimiter.check as Mock).mockResolvedValue({ limited: false });
      (getVoteWithOptions as Mock).mockResolvedValue(mockVote);
      (getUserByGoogleId as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/participate', {
        method: 'POST',
        body: JSON.stringify(validParticipateData),
      });
      const response = await participate(request, { params: createParams('vote-123') });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('User profile not found');
    });

    it('returns 403 with RESIDENCY_NOT_VERIFIED when residency is unverified', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (voteParticipationLimiter.check as Mock).mockResolvedValue({ limited: false });
      (getVoteWithOptions as Mock).mockResolvedValue(mockVote);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);
      (checkVoterEligibility as Mock).mockResolvedValue({
        eligible: false,
        code: 'RESIDENCY_NOT_VERIFIED',
        message: 'נדרש אימות תושבוּת לפני ההצבעה.',
      });

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/participate', {
        method: 'POST',
        body: JSON.stringify(validParticipateData),
      });
      const response = await participate(request, { params: createParams('vote-123') });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe('RESIDENCY_NOT_VERIFIED');
      expect(recordUserVoteOnce).not.toHaveBeenCalled();
    });

    it('returns 403 with IDENTITY_NOT_VERIFIED when identity is unverified', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (voteParticipationLimiter.check as Mock).mockResolvedValue({ limited: false });
      (getVoteWithOptions as Mock).mockResolvedValue(mockVote);
      (getUserByGoogleId as Mock).mockResolvedValue({ ...mockUser, identity_score: 0 });
      (checkVoterEligibility as Mock).mockResolvedValue({
        eligible: false,
        code: 'IDENTITY_NOT_VERIFIED',
        message: 'נדרש אימות זהות לפני ההצבעה.',
      });

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/participate', {
        method: 'POST',
        body: JSON.stringify(validParticipateData),
      });
      const response = await participate(request, { params: createParams('vote-123') });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe('IDENTITY_NOT_VERIFIED');
      expect(recordUserVoteOnce).not.toHaveBeenCalled();
    });

    it('records the ballot, bumps the tally and the participant count', async () => {
      setUpHappyPath();
      (recordUserVoteOnce as Mock).mockResolvedValue({
        created: true,
        vote: {
          id: 'user-vote-123',
          user_id: mockSession.userId,
          vote_id: 'vote-123',
          option_id: OPTION_1,
          created_at: '2026-08-02T12:00:00.000Z',
        },
      });
      (incrementVoteOption as Mock).mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/participate', {
        method: 'POST',
        body: JSON.stringify(validParticipateData),
      });
      const response = await participate(request, { params: createParams('vote-123') });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.alreadyRecorded).toBe(false);
      expect(data.participation.id).toBe('user-vote-123');
      expect(data.participation.createdAt).toBe('2026-08-02T12:00:00.000Z');
      expect(incrementVoteOption).toHaveBeenCalledTimes(1);
      expect(incrementVoteOption).toHaveBeenCalledWith(OPTION_1);
      expect(supabaseAdmin.from).toHaveBeenCalledWith('votes');
    });

    it('passes no payment_id when recording a free ballot', async () => {
      setUpHappyPath();
      (recordUserVoteOnce as Mock).mockResolvedValue({
        created: true,
        vote: {
          id: 'user-vote-123',
          user_id: mockSession.userId,
          vote_id: 'vote-123',
          option_id: OPTION_1,
          created_at: '2026-08-02T12:00:00.000Z',
        },
      });

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/participate', {
        method: 'POST',
        body: JSON.stringify(validParticipateData),
      });
      await participate(request, { params: createParams('vote-123') });

      const insertArg = (recordUserVoteOnce as Mock).mock.calls[0][0];
      expect(insertArg.payment_id).toBeUndefined();
    });

    it('returns the existing ballot on a duplicate submit without moving the tally', async () => {
      setUpHappyPath();
      (recordUserVoteOnce as Mock).mockResolvedValue({
        created: false,
        vote: {
          id: 'existing-vote-999',
          user_id: mockSession.userId,
          vote_id: 'vote-123',
          option_id: OPTION_1,
          created_at: '2026-08-01T09:00:00.000Z',
        },
      });

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/participate', {
        method: 'POST',
        body: JSON.stringify(validParticipateData),
      });
      const response = await participate(request, { params: createParams('vote-123') });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.alreadyRecorded).toBe(true);
      expect(data.participation.id).toBe('existing-vote-999');
      expect(incrementVoteOption).not.toHaveBeenCalled();
      expect(supabaseAdmin.from).not.toHaveBeenCalledWith('votes');
    });

    it('mints no tokens and sends no payment receipt for a free vote', async () => {
      setUpHappyPath();
      (recordUserVoteOnce as Mock).mockResolvedValue({
        created: true,
        vote: {
          id: 'user-vote-123',
          user_id: mockSession.userId,
          vote_id: 'vote-123',
          option_id: OPTION_1,
          created_at: '2026-08-02T12:00:00.000Z',
        },
      });

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/participate', {
        method: 'POST',
        body: JSON.stringify(validParticipateData),
      });
      await participate(request, { params: createParams('vote-123') });

      expect(qubikService.mintTokens).not.toHaveBeenCalled();
      expect(emailService.sendPaymentReceiptEmail).not.toHaveBeenCalled();
    });

    it('records the vote even when the chain service is unavailable', async () => {
      setUpHappyPath();
      (qubikService.recordVote as Mock).mockRejectedValue(new Error('Blockchain unavailable'));
      (recordUserVoteOnce as Mock).mockResolvedValue({
        created: true,
        vote: {
          id: 'user-vote-123',
          user_id: mockSession.userId,
          vote_id: 'vote-123',
          option_id: OPTION_1,
          created_at: '2026-08-02T12:00:00.000Z',
        },
      });

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/participate', {
        method: 'POST',
        body: JSON.stringify(validParticipateData),
      });
      const response = await participate(request, { params: createParams('vote-123') });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(response.status).not.toBe(503);
      expect(data.alreadyRecorded).toBe(false);
      expect(recordUserVoteOnce).toHaveBeenCalled();
    });

    it('handles database errors gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (voteParticipationLimiter.check as Mock).mockResolvedValue({ limited: false });
      (getVoteWithOptions as Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/participate', {
        method: 'POST',
        body: JSON.stringify(validParticipateData),
      });
      const response = await participate(request, { params: createParams('vote-123') });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to participate in vote');
    });
  });

  describe('POST /api/votes/[id]/verify-location', () => {
    const validLocationData = {
      latitude: 32.0853,
      longitude: 34.7818,
    };

    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/verify-location', {
        method: 'POST',
        body: JSON.stringify(validLocationData),
      });
      const response = await verifyLocation(request, { params: createParams('vote-123') });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 when vote ID is empty', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/votes//verify-location', {
        method: 'POST',
        body: JSON.stringify(validLocationData),
      });
      const response = await verifyLocation(request, { params: createParams('') });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Vote ID is required');
    });

    it('should return 400 when coordinates are invalid', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/verify-location', {
        method: 'POST',
        body: JSON.stringify({ latitude: 'invalid', longitude: 34.7818 }),
      });
      const response = await verifyLocation(request, { params: createParams('vote-123') });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Latitude and longitude are required');
    });

    it('should return 404 when vote not found', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getVoteById as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/votes/nonexistent/verify-location', {
        method: 'POST',
        body: JSON.stringify(validLocationData),
      });
      const response = await verifyLocation(request, { params: createParams('nonexistent') });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Vote not found');
    });

    it('should verify location against vote municipality', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getVoteById as Mock).mockResolvedValue({ ...mockVote, municipality_id: 'tel-aviv' });
      (verifyLocationInMunicipality as Mock).mockReturnValue({
        isInside: true,
        municipality: { name: 'Tel Aviv' },
        distanceFromCenter: 500,
      });

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/verify-location', {
        method: 'POST',
        body: JSON.stringify(validLocationData),
      });
      const response = await verifyLocation(request, { params: createParams('vote-123') });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.verified).toBe(true);
      expect(data.municipality).toBe('Tel Aviv');
      expect(data.distanceFromCenter).toBe(500);
      expect(verifyLocationInMunicipality).toHaveBeenCalledWith(32.0853, 34.7818, 'tel-aviv');
    });

    it('should verify location against user municipality when vote has no municipality', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getVoteById as Mock).mockResolvedValue({ ...mockVote, municipality_id: null });
      (findMunicipalityByCoordinates as Mock).mockReturnValue('tel-aviv');
      (getUserById as Mock).mockResolvedValue(mockUser);
      (verifyLocationInMunicipality as Mock).mockReturnValue({
        isInside: true,
        municipality: { name: 'Tel Aviv' },
        distanceFromCenter: 300,
      });

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/verify-location', {
        method: 'POST',
        body: JSON.stringify(validLocationData),
      });
      const response = await verifyLocation(request, { params: createParams('vote-123') });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.verified).toBe(true);
      expect(getUserById).toHaveBeenCalledWith(mockSession.userId);
    });

    it('should return detected municipality when no context available', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getVoteById as Mock).mockResolvedValue({ ...mockVote, municipality_id: null });
      (findMunicipalityByCoordinates as Mock).mockReturnValue('jerusalem');
      (getUserById as Mock).mockResolvedValue({ ...mockUser, municipality_id: null });

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/verify-location', {
        method: 'POST',
        body: JSON.stringify(validLocationData),
      });
      const response = await verifyLocation(request, { params: createParams('vote-123') });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.verified).toBe(true);
      expect(data.municipality).toBe('jerusalem');
    });

    it('should return not verified when no municipality detected', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getVoteById as Mock).mockResolvedValue({ ...mockVote, municipality_id: null });
      (findMunicipalityByCoordinates as Mock).mockReturnValue(null);
      (getUserById as Mock).mockResolvedValue({ ...mockUser, municipality_id: null });

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/verify-location', {
        method: 'POST',
        body: JSON.stringify(validLocationData),
      });
      const response = await verifyLocation(request, { params: createParams('vote-123') });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.verified).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getVoteById as Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/verify-location', {
        method: 'POST',
        body: JSON.stringify(validLocationData),
      });
      const response = await verifyLocation(request, { params: createParams('vote-123') });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to verify location');
    });
  });

  describe('GET /api/votes/[id]/participated', () => {
    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/participated');
      const response = await checkParticipated(request, { params: createParams('vote-123') });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 when vote ID is empty', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/votes//participated');
      const response = await checkParticipated(request, { params: createParams('') });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Vote ID is required');
    });

    it('should return true when user has participated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (hasUserParticipated as Mock).mockResolvedValue(true);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/participated');
      const response = await checkParticipated(request, { params: createParams('vote-123') });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.participated).toBe(true);
      expect(hasUserParticipated).toHaveBeenCalledWith(mockSession.userId, 'vote-123');
    });

    it('should return false when user has not participated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (hasUserParticipated as Mock).mockResolvedValue(false);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/participated');
      const response = await checkParticipated(request, { params: createParams('vote-123') });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.participated).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (hasUserParticipated as Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/participated');
      const response = await checkParticipated(request, { params: createParams('vote-123') });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to check participation status');
    });
  });
});
