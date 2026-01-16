/**
 * Notifications API Client
 *
 * Handles push notification token registration for Expo notifications.
 * Tokens are used to send push notifications for verification reminders,
 * vote updates, and other app notifications.
 */

import { getApiClient } from './client';

// Request/Response types matching API endpoints

export interface RegisterPushTokenRequest {
  token: string;
  deviceType: 'ios' | 'android';
  deviceName?: string;
}

export interface RegisterPushTokenResponse {
  success: boolean;
  tokenId: string;
}

export interface PushToken {
  id: string;
  token: string;
  deviceType: 'ios' | 'android';
  deviceName: string | null;
  isActive: boolean;
  lastUsed: string;
  createdAt: string;
}

export interface GetPushTokensResponse {
  tokens: PushToken[];
}

export interface DeletePushTokenResponse {
  success: boolean;
}

export const notificationsApi = {
  /**
   * Register or update a push notification token
   * Call this after obtaining an Expo push token on app launch
   */
  async registerPushToken(
    token: string,
    deviceType: 'ios' | 'android',
    deviceName?: string
  ): Promise<RegisterPushTokenResponse> {
    const client = getApiClient();
    return client.post<RegisterPushTokenResponse>('/api/user/push-token', {
      token,
      deviceType,
      deviceName,
    });
  },

  /**
   * Get all registered push tokens for the current user
   * Useful for debugging or allowing users to manage their devices
   */
  async getPushTokens(): Promise<GetPushTokensResponse> {
    const client = getApiClient();
    return client.get<GetPushTokensResponse>('/api/user/push-token');
  },

  /**
   * Delete a push token (e.g., on logout or app uninstall)
   * This permanently removes the token from the system
   */
  async deletePushToken(token: string): Promise<DeletePushTokenResponse> {
    const client = getApiClient();
    return client.delete<DeletePushTokenResponse>(
      `/api/user/push-token?token=${encodeURIComponent(token)}`
    );
  },

  /**
   * Deactivate a push token without deleting it
   * The token is kept in the database but won't receive notifications
   */
  async deactivatePushToken(token: string): Promise<DeletePushTokenResponse> {
    const client = getApiClient();
    return client.delete<DeletePushTokenResponse>(
      `/api/user/push-token?token=${encodeURIComponent(token)}&action=deactivate`
    );
  },
};
