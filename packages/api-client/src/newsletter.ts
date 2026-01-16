/**
 * Newsletter API Client
 *
 * Handles newsletter subscription via Beehiiv.
 * Used for subscribing users to product updates and announcements.
 */

import { getApiClient } from './client';

// Response types matching API endpoints

export interface SubscribeNewsletterResponse {
  message: string;
}

export const newsletterApi = {
  /**
   * Subscribe an email address to the newsletter
   * This endpoint is rate-limited to 3 requests per minute per IP
   *
   * @param email - Email address to subscribe
   * @returns Success message or error
   * @throws ApiError with status 429 if rate limited
   * @throws ApiError with status 409 if already subscribed
   */
  async subscribe(email: string): Promise<SubscribeNewsletterResponse> {
    const client = getApiClient();
    return client.post<SubscribeNewsletterResponse>('/api/newsletter/subscribe', {
      email,
    });
  },
};
