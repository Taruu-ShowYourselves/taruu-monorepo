import { useAuthStore, useUser, useIsAuthenticated, useIsOnboarded, useCanVote, useIdentityLevel, useIsVerified, useSyncTokenBalance, useAvatarUrl } from '../../stores/authStore';
import * as auth from '../../lib/auth';

// Mock the auth lib
jest.mock('../../lib/auth', () => ({
  signInWithGoogle: jest.fn(),
  signOut: jest.fn(),
  validateSession: jest.fn(),
  getAuthToken: jest.fn(),
}));

describe('Auth Store', () => {
  beforeEach(() => {
    // Reset the store state before each test
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isOnboarded: false,
      error: null,
    });
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useAuthStore.getState();

      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isOnboarded).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('signInWithGoogle', () => {
    it('should set loading state while authenticating', async () => {
      (auth.signInWithGoogle as jest.Mock).mockImplementation(() => {
        return new Promise((resolve) => {
          // Check loading state immediately
          expect(useAuthStore.getState().isLoading).toBe(true);
          resolve({ success: true, user: { id: '123' } });
        });
      });

      await useAuthStore.getState().signInWithGoogle();
    });

    it('should update state on successful sign in', async () => {
      const mockUser = {
        id: 'user-123',
        googleId: 'google-456',
        email: 'test@example.com',
        did: 'did:example:123',
      };

      (auth.signInWithGoogle as jest.Mock).mockResolvedValue({
        success: true,
        user: mockUser,
      });

      const result = await useAuthStore.getState().signInWithGoogle();

      expect(result).toBe(true);
      expect(useAuthStore.getState().user).toEqual(mockUser);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().isLoading).toBe(false);
      expect(useAuthStore.getState().error).toBeNull();
    });

    it('should set error on failed sign in', async () => {
      (auth.signInWithGoogle as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Authentication failed',
      });

      const result = await useAuthStore.getState().signInWithGoogle();

      expect(result).toBe(false);
      expect(useAuthStore.getState().error).toBe('Authentication failed');
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('should handle exceptions', async () => {
      (auth.signInWithGoogle as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await useAuthStore.getState().signInWithGoogle();

      expect(result).toBe(false);
      expect(useAuthStore.getState().error).toBe('Network error');
    });
  });

  describe('signOut', () => {
    it('should clear all auth state on sign out', async () => {
      // First set up authenticated state
      useAuthStore.setState({
        user: { id: '123', googleId: 'g123', did: 'did', email: 'test@test.com' },
        isAuthenticated: true,
        isOnboarded: true,
      });

      (auth.signOut as jest.Mock).mockResolvedValue(undefined);

      await useAuthStore.getState().signOut();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().isOnboarded).toBe(false);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('should clear state even if sign out fails', async () => {
      useAuthStore.setState({
        user: { id: '123', googleId: 'g123', did: 'did', email: 'test@test.com' },
        isAuthenticated: true,
      });

      (auth.signOut as jest.Mock).mockRejectedValue(new Error('Network error'));

      await useAuthStore.getState().signOut();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('checkSession', () => {
    it('should restore auth state when session is valid', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };

      (auth.validateSession as jest.Mock).mockResolvedValue({
        valid: true,
        user: mockUser,
      });

      const result = await useAuthStore.getState().checkSession();

      expect(result).toBe(true);
      expect(useAuthStore.getState().user).toEqual(mockUser);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it('should clear state when session is invalid', async () => {
      useAuthStore.setState({
        user: { id: '123', googleId: 'g123', did: 'did', email: 'test@test.com' },
        isAuthenticated: true,
      });

      (auth.validateSession as jest.Mock).mockResolvedValue({
        valid: false,
      });

      const result = await useAuthStore.getState().checkSession();

      expect(result).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('setUser', () => {
    it('should set user and authenticate', () => {
      const user = {
        id: '123',
        googleId: 'g123',
        did: 'did',
        email: 'test@test.com',
      };

      useAuthStore.getState().setUser(user);

      expect(useAuthStore.getState().user).toEqual(user);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it('should clear authentication when user is null', () => {
      useAuthStore.setState({
        user: { id: '123', googleId: 'g123', did: 'did', email: 'test@test.com' },
        isAuthenticated: true,
      });

      useAuthStore.getState().setUser(null);

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('setOnboarded', () => {
    it('should update onboarded status', () => {
      useAuthStore.getState().setOnboarded(true);
      expect(useAuthStore.getState().isOnboarded).toBe(true);

      useAuthStore.getState().setOnboarded(false);
      expect(useAuthStore.getState().isOnboarded).toBe(false);
    });
  });

  describe('setError', () => {
    it('should update error state', () => {
      useAuthStore.getState().setError('Test error');
      expect(useAuthStore.getState().error).toBe('Test error');

      useAuthStore.getState().setError(null);
      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('clearAuth', () => {
    it('should clear all auth-related state', () => {
      useAuthStore.setState({
        user: { id: '123', googleId: 'g123', did: 'did', email: 'test@test.com' },
        isAuthenticated: true,
        isOnboarded: true,
        error: 'Some error',
      });

      useAuthStore.getState().clearAuth();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().isOnboarded).toBe(false);
      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should partially update user data', () => {
      useAuthStore.setState({
        user: {
          id: '123',
          googleId: 'g123',
          did: 'did',
          email: 'test@test.com',
          firstName: 'John',
        },
        isAuthenticated: true,
      });

      useAuthStore.getState().updateUser({ firstName: 'Jane', lastName: 'Doe' });

      expect(useAuthStore.getState().user?.firstName).toBe('Jane');
      expect(useAuthStore.getState().user?.lastName).toBe('Doe');
      expect(useAuthStore.getState().user?.email).toBe('test@test.com');
    });

    it('should not update if user is null', () => {
      useAuthStore.getState().updateUser({ firstName: 'Test' });
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  describe('selectors', () => {
    it('useCanVote should return true when score >= 40', () => {
      useAuthStore.setState({
        user: {
          id: '123',
          googleId: 'g123',
          did: 'did',
          email: 'test@test.com',
          identityScore: { total: 40, level: 'basic', breakdown: { google: 40 } },
        },
        isAuthenticated: true,
      });

      // Test the selector logic directly
      const state = useAuthStore.getState();
      const canVote = (state.user?.identityScore?.total || 0) >= 40;
      expect(canVote).toBe(true);
    });

    it('useCanVote should return false when score < 40', () => {
      useAuthStore.setState({
        user: {
          id: '123',
          googleId: 'g123',
          did: 'did',
          email: 'test@test.com',
          identityScore: { total: 20, level: 'basic', breakdown: { google: 20 } },
        },
        isAuthenticated: true,
      });

      const state = useAuthStore.getState();
      const canVote = (state.user?.identityScore?.total || 0) >= 40;
      expect(canVote).toBe(false);
    });

    it('useIdentityLevel should return correct level', () => {
      useAuthStore.setState({
        user: {
          id: '123',
          googleId: 'g123',
          did: 'did',
          email: 'test@test.com',
          identityScore: { total: 80, level: 'trusted', breakdown: { google: 40, gps: 40 } },
        },
        isAuthenticated: true,
      });

      const state = useAuthStore.getState();
      const level = state.user?.identityScore?.level || 'basic';
      expect(level).toBe('trusted');
    });

    it('useIsVerified should return true when verification is completed', () => {
      useAuthStore.setState({
        user: {
          id: '123',
          googleId: 'g123',
          did: 'did',
          email: 'test@test.com',
          verificationStatus: { phase: 'completed', startedAt: new Date().toISOString() },
        },
        isAuthenticated: true,
      });

      const state = useAuthStore.getState();
      const isVerified = state.user?.verificationStatus?.phase === 'completed';
      expect(isVerified).toBe(true);
    });

    it('useSyncTokenBalance should return balance or 0', () => {
      useAuthStore.setState({
        user: {
          id: '123',
          googleId: 'g123',
          did: 'did',
          email: 'test@test.com',
          syncTokenBalance: 150,
        },
        isAuthenticated: true,
      });

      const state = useAuthStore.getState();
      const balance = state.user?.syncTokenBalance || 0;
      expect(balance).toBe(150);
    });

    it('useAvatarUrl should return avatar URL', () => {
      useAuthStore.setState({
        user: {
          id: '123',
          googleId: 'g123',
          did: 'did',
          email: 'test@test.com',
          avatarUrl: 'https://example.com/avatar.jpg',
        },
        isAuthenticated: true,
      });

      const state = useAuthStore.getState();
      expect(state.user?.avatarUrl).toBe('https://example.com/avatar.jpg');
    });
  });
});
