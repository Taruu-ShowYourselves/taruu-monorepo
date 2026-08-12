'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { safeRedirect } from '@/lib/safeRedirect';
import { useAuthStore } from '@/stores/authStore';
import type { UserProfile } from '@sync/shared';

// === Types ===

interface AuthContextType {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: UserProfile | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

// === Context ===

const AuthContext = createContext<AuthContextType | null>(null);

// === Provider ===

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const [isInitialized, setIsInitialized] = useState(false);

  const {
    user,
    isLoading,
    isAuthenticated,
    accessToken,
    setUser,
    setLoading,
    setTokens,
    signOut: clearAuth,
  } = useAuthStore();

  // Initialize auth state on mount
  useEffect(() => {
    async function initAuth() {
      setLoading(true);

      try {
        // Check for existing session
        if (accessToken) {
          // Verify session is still valid
          const response = await fetch('/api/auth/session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.user) {
              setUser(data.user);
            } else {
              // Session expired, clear auth
              clearAuth();
            }
          } else {
            // Invalid session, clear auth
            clearAuth();
          }
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        clearAuth();
      } finally {
        setLoading(false);
        setIsInitialized(true);
      }
    }

    initAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sign in - direct Google OIDC (the Auth0 hop is gone). The state and nonce
  // are minted server-side (requirement #71-M1-08): the browser only asks
  // /api/auth/google/start for the authorize URL and follows it. Google
  // redirects back to the sign-in page, where the callback effect below
  // exchanges the code. The redirect target must be an app page: the API
  // route only accepts POST, so pointing the provider redirect at it 405s
  // forever.
  const signInWithGoogle = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/google/start', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        console.error('Failed to start Google sign-in');
        return;
      }

      const data = await response.json();
      window.location.href = data.url;
    } catch (error) {
      console.error('Failed to start Google sign-in:', error);
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      // Call server to clear session
      await fetch('/api/auth/session', {
        method: 'DELETE',
        headers: accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : undefined,
      });
    } catch (error) {
      console.error('Failed to sign out:', error);
    } finally {
      // Clear local state
      clearAuth();
      router.push('/');
    }
  }, [accessToken, clearAuth, router]);

  // Refresh session
  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session/refresh', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.accessToken) {
          setTokens(data.accessToken);
        }
        if (data.user) {
          setUser(data.user);
        }
      } else {
        // Refresh failed, sign out
        await signOut();
      }
    } catch (error) {
      console.error('Failed to refresh session:', error);
      await signOut();
    }
  }, [setTokens, setUser, signOut]);

  // Handle OAuth callback
  useEffect(() => {
    async function handleCallback() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      const error = params.get('error');

      if (error) {
        console.error('OAuth error:', error);
        router.push('/sign-in?error=' + error);
        return;
      }

      if (code && state) {
        // State is no longer verified client-side (requirement #71-M1-08):
        // the server validates it against the signed oauth_state token and
        // the sync-oauth-state cookie (double submit) inside the callback.
        setLoading(true);

        try {
          // Exchange code for session
          const response = await fetch('/api/auth/callback', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, state }),
          });

          if (response.ok) {
            const data = await response.json();

            if (data.accessToken) {
              setTokens(data.accessToken, data.refreshToken, data.expiresAt);
            }

            if (data.user) {
              setUser(data.user);
            }

            // OAuth drops arbitrary query parameters. A sensitive return target
            // is therefore saved client-side by the initiating flow and only
            // consumed after the callback, via the same open-redirect guard as
            // the sign-in screen. New members still need onboarding first.
            const pilotReturn = safeRedirect(
              sessionStorage.getItem('taruu.post_auth_redirect'),
              '/dashboard'
            );
            if (data.isNewUser) {
              router.push('/onboarding');
            } else {
              sessionStorage.removeItem('taruu.post_auth_redirect');
              router.push(pilotReturn);
            }
          } else {
            const errorData = await response.json();
            router.push('/sign-in?error=' + (errorData.error || 'auth_failed'));
          }
        } catch (err) {
          console.error('Callback error:', err);
          router.push('/sign-in?error=callback_failed');
        } finally {
          setLoading(false);
        }

        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    }

    if (typeof window !== 'undefined' && window.location.search.includes('code=')) {
      handleCallback();
    }
  }, [router, setLoading, setTokens, setUser]);

  const value: AuthContextType = {
    isLoading: !isInitialized || isLoading,
    isAuthenticated,
    user,
    signInWithGoogle,
    signOut,
    refreshSession,
  };

  const Provider = AuthContext.Provider as any;
  return <Provider value={value}>{children}</Provider>;
}

// === Hook ===

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// === Convenience Hooks (Clerk-like API) ===

export function useUser() {
  const { user, isLoading } = useAuth();
  return { user, isLoaded: !isLoading };
}

export function useSignIn() {
  const { signInWithGoogle, isLoading } = useAuth();
  return {
    signIn: signInWithGoogle,
    isLoaded: !isLoading,
  };
}

export function useSignOut() {
  const { signOut, isLoading } = useAuth();
  return {
    signOut,
    isLoaded: !isLoading,
  };
}
