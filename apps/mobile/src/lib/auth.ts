import * as SecureStore from 'expo-secure-store';
import type { TokenCache } from '@clerk/clerk-expo';

/**
 * Secure token storage for Clerk
 */
export const tokenCache: TokenCache = {
  async getToken(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('Error getting token from secure store:', error);
      return null;
    }
  },

  async saveToken(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error('Error saving token to secure store:', error);
    }
  },

  async clearToken(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('Error clearing token from secure store:', error);
    }
  },
};
