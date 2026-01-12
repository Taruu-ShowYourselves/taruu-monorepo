/**
 * Auth Store - Zustand state management for authentication
 *
 * Replaces Clerk's useAuth() and useUser() hooks
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  UserProfile,
  IdentityScore,
  SocialProof,
  VerificationStatus,
} from '@sync/shared';

// === Types ===

interface AuthState {
  // User state
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Session state
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;

  // Actions
  setUser: (user: UserProfile | null) => void;
  setTokens: (accessToken: string, refreshToken?: string, expiresAt?: Date) => void;
  setLoading: (isLoading: boolean) => void;
  updateUser: (updates: Partial<UserProfile>) => void;
  updateIdentityScore: (score: IdentityScore) => void;
  updateVerificationStatus: (status: VerificationStatus) => void;
  addSocialProof: (proof: SocialProof) => void;
  removeSocialProof: (platform: SocialProof['platform']) => void;
  signOut: () => void;
  reset: () => void;
}

// === Initial State ===

const initialState = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
};

// === Store ===

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          isLoading: false,
        }),

      setTokens: (accessToken, refreshToken, expiresAt) =>
        set({
          accessToken,
          refreshToken: refreshToken ?? get().refreshToken,
          expiresAt: expiresAt ?? null,
        }),

      setLoading: (isLoading) => set({ isLoading }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user
            ? { ...state.user, ...updates, updatedAt: new Date() }
            : null,
        })),

      updateIdentityScore: (identityScore) =>
        set((state) => ({
          user: state.user ? { ...state.user, identityScore } : null,
        })),

      updateVerificationStatus: (verificationStatus) =>
        set((state) => ({
          user: state.user ? { ...state.user, verificationStatus } : null,
        })),

      addSocialProof: (proof) =>
        set((state) => {
          if (!state.user) return state;

          // Remove existing proof for same platform, then add new one
          const filteredProofs = state.user.socialProofs.filter(
            (p) => p.platform !== proof.platform
          );

          return {
            user: {
              ...state.user,
              socialProofs: [...filteredProofs, proof],
            },
          };
        }),

      removeSocialProof: (platform) =>
        set((state) => {
          if (!state.user) return state;

          return {
            user: {
              ...state.user,
              socialProofs: state.user.socialProofs.filter(
                (p) => p.platform !== platform
              ),
            },
          };
        }),

      signOut: () =>
        set({
          ...initialState,
          isLoading: false,
        }),

      reset: () => set(initialState),
    }),
    {
      name: 'sync-auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        expiresAt: state.expiresAt,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// === Selectors ===

/**
 * Check if user can vote (has minimum identity score)
 */
export const useCanVote = () =>
  useAuthStore((state) => (state.user?.identityScore?.total ?? 0) >= 40);

/**
 * Check if user's verification is complete
 */
export const useIsVerified = () =>
  useAuthStore(
    (state) => state.user?.verificationStatus?.phase === 'completed'
  );

/**
 * Get user's DID
 */
export const useDID = () => useAuthStore((state) => state.user?.did ?? null);

/**
 * Get user's identity level
 */
export const useIdentityLevel = () =>
  useAuthStore((state) => state.user?.identityScore?.level ?? 'basic');

/**
 * Check if session is expired
 */
export const useIsSessionExpired = () =>
  useAuthStore((state) => {
    if (!state.expiresAt) return true;
    return new Date() > new Date(state.expiresAt);
  });
