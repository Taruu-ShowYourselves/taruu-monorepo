import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import {
  tokenStorage,
  buildGoogleAuthUrl,
  signInWithGoogle,
  signOut,
  validateSession,
  refreshSession,
  getAuthToken,
  buildFacebookAuthUrl,
  connectFacebook,
  buildInstagramAuthUrl,
  connectInstagram,
  disconnectSocialPlatform,
  getSocialProofs,
} from '../../lib/auth';

describe('Auth Library', () => {
  const mockFetch = global.fetch as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('tokenStorage', () => {
    describe('getSessionToken', () => {
      it('should return token when available', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('mock-session-token');
        const token = await tokenStorage.getSessionToken();
        expect(token).toBe('mock-session-token');
        expect(SecureStore.getItemAsync).toHaveBeenCalledWith('sync-session-token');
      });

      it('should return null when no token stored', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
        const token = await tokenStorage.getSessionToken();
        expect(token).toBeNull();
      });

      it('should handle errors gracefully', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));
        const token = await tokenStorage.getSessionToken();
        expect(token).toBeNull();
      });
    });

    describe('saveSessionToken', () => {
      it('should save token to secure storage', async () => {
        await tokenStorage.saveSessionToken('new-token');
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith('sync-session-token', 'new-token');
      });

      it('should handle errors gracefully', async () => {
        (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));
        await expect(tokenStorage.saveSessionToken('new-token')).resolves.not.toThrow();
      });
    });

    describe('getRefreshToken', () => {
      it('should return refresh token when available', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('mock-refresh-token');
        const token = await tokenStorage.getRefreshToken();
        expect(token).toBe('mock-refresh-token');
        expect(SecureStore.getItemAsync).toHaveBeenCalledWith('sync-refresh-token');
      });
    });

    describe('saveRefreshToken', () => {
      it('should save refresh token to secure storage', async () => {
        await tokenStorage.saveRefreshToken('refresh-token');
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith('sync-refresh-token', 'refresh-token');
      });
    });

    describe('clearTokens', () => {
      it('should delete all tokens from storage', async () => {
        await tokenStorage.clearTokens();
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('sync-session-token');
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('sync-refresh-token');
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('sync-user-data');
      });
    });

    describe('getUserData', () => {
      it('should return user data when available', async () => {
        const userData = JSON.stringify({ id: '123', email: 'test@example.com' });
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(userData);
        const data = await tokenStorage.getUserData();
        expect(data).toBe(userData);
      });
    });

    describe('saveUserData', () => {
      it('should save user data to secure storage', async () => {
        const userData = JSON.stringify({ id: '123' });
        await tokenStorage.saveUserData(userData);
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith('sync-user-data', userData);
      });
    });
  });

  describe('buildGoogleAuthUrl', () => {
    it('should build correct OAuth URL with sign-in mode', () => {
      const url = buildGoogleAuthUrl(false);
      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=openid');
      expect(url).toContain('prompt=consent');
    });

    it('should build correct OAuth URL with sign-up mode', () => {
      const url = buildGoogleAuthUrl(true);
      expect(url).toContain('isSignUp');
    });

    it('should include redirect URI', () => {
      const url = buildGoogleAuthUrl();
      expect(url).toContain('redirect_uri=');
    });
  });

  describe('signInWithGoogle', () => {
    it('should return success when auth completes successfully', async () => {
      const mockUrl = 'exp://localhost:8081/auth/callback?session_token=abc123&user=' +
        encodeURIComponent(JSON.stringify({ id: '123', email: 'test@example.com' }));

      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
        type: 'success',
        url: mockUrl,
      });

      const result = await signInWithGoogle();

      expect(result.success).toBe(true);
      expect(result.sessionToken).toBe('abc123');
      expect(SecureStore.setItemAsync).toHaveBeenCalled();
    });

    it('should return error when auth is cancelled', async () => {
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
        type: 'cancel',
      });

      const result = await signInWithGoogle();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication cancelled');
    });

    it('should return error when callback contains error', async () => {
      const mockUrl = 'exp://localhost:8081/auth/callback?error=' + encodeURIComponent('Invalid code');

      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
        type: 'success',
        url: mockUrl,
      });

      const result = await signInWithGoogle();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid code');
    });

    it('should handle exceptions gracefully', async () => {
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await signInWithGoogle();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('signOut', () => {
    it('should call server to invalidate session', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('mock-token');
      mockFetch.mockResolvedValue({ ok: true });

      await signOut();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/session'),
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token',
          }),
        })
      );
    });

    it('should clear tokens even if server call fails', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('mock-token');
      mockFetch.mockRejectedValue(new Error('Network error'));

      await signOut();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    });

    it('should clear tokens when no session token exists', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      await signOut();

      expect(mockFetch).not.toHaveBeenCalled();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    });
  });

  describe('validateSession', () => {
    it('should return valid when session is valid', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('valid-token');
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user: { id: '123' } }),
      });

      const result = await validateSession();

      expect(result.valid).toBe(true);
      expect(result.user).toEqual({ id: '123' });
    });

    it('should return invalid when no token exists', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await validateSession();

      expect(result.valid).toBe(false);
    });

    it('should handle network errors gracefully', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('valid-token');
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await validateSession();

      expect(result.valid).toBe(false);
    });
  });

  describe('refreshSession', () => {
    it('should refresh session with valid refresh token', async () => {
      // Mock getting the refresh token (refreshSession calls tokenStorage.getRefreshToken())
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('refresh-token');

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          sessionToken: 'new-session',
          refreshToken: 'new-refresh',
          user: { id: '123' },
        }),
      });

      const result = await refreshSession();

      expect(result.valid).toBe(true);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('sync-session-token', 'new-session');
    });

    it('should return invalid when no refresh token exists', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await refreshSession();

      expect(result.valid).toBe(false);
    });

    it('should clear tokens when refresh fails', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('expired-refresh');
      mockFetch.mockResolvedValue({ ok: false });

      const result = await refreshSession();

      expect(result.valid).toBe(false);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    });
  });

  describe('getAuthToken', () => {
    it('should return session token', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('token');
      const token = await getAuthToken();
      expect(token).toBe('token');
    });
  });

  describe('buildFacebookAuthUrl', () => {
    it('should build correct Facebook OAuth URL', () => {
      const url = buildFacebookAuthUrl('user-123');
      expect(url).toContain('https://www.facebook.com');
      expect(url).toContain('response_type=code');
      // Scope is URL encoded (comma becomes %2C)
      expect(url).toContain('scope=email%2Cpublic_profile');
    });
  });

  describe('connectFacebook', () => {
    it('should return success when Facebook connection succeeds', async () => {
      const mockUrl = 'exp://localhost:8081/settings/social-callback?success=facebook';
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
        type: 'success',
        url: mockUrl,
      });

      const result = await connectFacebook('user-123');

      expect(result.success).toBe(true);
    });

    it('should return error when cancelled', async () => {
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
        type: 'cancel',
      });

      const result = await connectFacebook('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Facebook connection cancelled');
    });
  });

  describe('buildInstagramAuthUrl', () => {
    it('should build correct Instagram OAuth URL', () => {
      const url = buildInstagramAuthUrl('user-123');
      expect(url).toContain('https://www.instagram.com/oauth/authorize');
      expect(url).toContain('response_type=code');
      expect(url).toContain('instagram_business_basic');
    });
  });

  describe('connectInstagram', () => {
    it('should return success when Instagram connection succeeds', async () => {
      const mockUrl = 'exp://localhost:8081/settings/social-callback?success=instagram';
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
        type: 'success',
        url: mockUrl,
      });

      const result = await connectInstagram('user-123');

      expect(result.success).toBe(true);
    });

    it('should return error when cancelled', async () => {
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
        type: 'cancel',
      });

      const result = await connectInstagram('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Instagram connection cancelled');
    });
  });

  describe('disconnectSocialPlatform', () => {
    it('should disconnect Facebook successfully', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('token');
      mockFetch.mockResolvedValue({ ok: true });

      const result = await disconnectSocialPlatform('facebook');

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/social/proofs?platform=facebook'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should return error when not authenticated', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await disconnectSocialPlatform('instagram');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated');
    });

    it('should handle API errors', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('token');
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      const result = await disconnectSocialPlatform('facebook');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Server error');
    });
  });

  describe('getSocialProofs', () => {
    it('should return social proofs successfully', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('token');
      const mockProofs = [
        { platform: 'google', providerId: '123', displayName: 'Test User' },
      ];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          socialProofs: mockProofs,
          identityScore: { total: 40, level: 'basic' },
        }),
      });

      const result = await getSocialProofs();

      expect(result.success).toBe(true);
      expect(result.socialProofs).toEqual(mockProofs);
      expect(result.identityScore?.total).toBe(40);
    });

    it('should return error when not authenticated', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await getSocialProofs();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated');
    });
  });
});
