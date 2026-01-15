import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserProfile, SocialProof, IdentityScore, VerificationStatus } from '@sync/shared';
import {
  signInWithGoogle,
  signOut as authSignOut,
  validateSession,
  getAuthToken,
} from '@/lib/auth';

interface AuthUser extends Partial<UserProfile> {
  id: string;
  googleId: string;
  did: string;
  email: string;
  firstName?: string;
  lastName?: string;
  municipality?: string;
  socialProofs?: SocialProof[];
  identityScore?: IdentityScore;
  verificationStatus?: VerificationStatus;
  syncTokenBalance?: number;
}

interface AuthState {
  // State
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isOnboarded: boolean;
  error: string | null;

  // Actions
  signInWithGoogle: (isSignUp?: boolean) => Promise<boolean>;
  signOut: () => Promise<void>;
  checkSession: () => Promise<boolean>;
  setUser: (user: AuthUser | null) => void;
  setOnboarded: (onboarded: boolean) => void;
  setError: (error: string | null) => void;
  clearAuth: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: true,
      isOnboarded: false,
      error: null,

      // Sign in with Google OAuth
      signInWithGoogle: async (isSignUp = false) => {
        set({ isLoading: true, error: null });

        try {
          const result = await signInWithGoogle(isSignUp);

          if (!result.success) {
            set({
              isLoading: false,
              error: result.error || 'Authentication failed',
            });
            return false;
          }

          const user = result.user as AuthUser | undefined;

          set({
            user: user || null,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          return true;
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          return false;
        }
      },

      // Sign out
      signOut: async () => {
        set({ isLoading: true });

        try {
          await authSignOut();
        } catch (error) {
          console.error('Sign out error:', error);
        }

        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          isOnboarded: false,
          error: null,
        });
      },

      // Check if session is valid
      checkSession: async () => {
        set({ isLoading: true });

        try {
          const result = await validateSession();

          if (result.valid && result.user) {
            set({
              // Type assertion - validateSession returns user data from server
              user: result.user as unknown as AuthUser,
              isAuthenticated: true,
              isLoading: false,
            });
            return true;
          }

          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
          return false;
        } catch (_error) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
          return false;
        }
      },

      // Set user directly
      setUser: (user) => set({ user, isAuthenticated: !!user }),

      // Set onboarded status
      setOnboarded: (isOnboarded) => set({ isOnboarded }),

      // Set error
      setError: (error) => set({ error }),

      // Clear all auth state
      clearAuth: () =>
        set({
          user: null,
          isAuthenticated: false,
          isOnboarded: false,
          error: null,
        }),

      // Update user with partial data
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        isOnboarded: state.isOnboarded,
      }),
    }
  )
);

// Selectors
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useIsLoading = () => useAuthStore((state) => state.isLoading);
export const useIsOnboarded = () => useAuthStore((state) => state.isOnboarded);
export const useAuthError = () => useAuthStore((state) => state.error);

// Identity score selectors
export const useIdentityScore = () =>
  useAuthStore((state) => state.user?.identityScore);

export const useCanVote = () =>
  useAuthStore((state) => {
    const score = state.user?.identityScore?.total || 0;
    return score >= 40;
  });

export const useIdentityLevel = () =>
  useAuthStore((state) => state.user?.identityScore?.level || 'basic');

// Verification selectors
export const useVerificationStatus = () =>
  useAuthStore((state) => state.user?.verificationStatus);

export const useIsVerified = () =>
  useAuthStore(
    (state) => state.user?.verificationStatus?.phase === 'completed'
  );

// Token balance selector
export const useSyncTokenBalance = () =>
  useAuthStore((state) => state.user?.syncTokenBalance || 0);

// Export getAuthToken for API client
export { getAuthToken };
