/**
 * Newsletter API Route Tests
 *
 * Tests for the /api/newsletter/subscribe endpoint:
 * - POST /api/newsletter/subscribe - Subscribe to newsletter
 */

import { describe, it, expect, beforeEach, vi, type Mock, afterAll } from 'vitest';
import { NextRequest } from 'next/server';

// Mock fetch globally
global.fetch = vi.fn();

// Each test gets a unique IP to avoid rate limiting
let testCounter = 0;

// Mock headers - each call gets a unique IP
vi.mock('next/headers', () => ({
  headers: vi.fn().mockImplementation(() => {
    testCounter++;
    return Promise.resolve({
      get: vi.fn((name: string) => {
        if (name === 'x-forwarded-for') {
          return `192.168.${Math.floor(testCounter / 256)}.${testCounter % 256}`;
        }
        return null;
      }),
    });
  }),
}));

describe('Newsletter API Routes', () => {
  const originalEnv = process.env;
  let POST: typeof import('@/app/api/newsletter/subscribe/route').POST;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      BEEHIIV_API_KEY: 'test-api-key',
      BEEHIIV_PUBLICATION_ID: 'test-pub-id',
    };
    // Re-import to get fresh instance
    vi.resetModules();
    const module = await import('@/app/api/newsletter/subscribe/route');
    POST = module.POST;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('POST /api/newsletter/subscribe', () => {
    it('should return 400 when email is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/newsletter/subscribe', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('נא להזין כתובת אימייל');
    });

    it('should return 400 when email is empty string', async () => {
      const request = new NextRequest('http://localhost:3000/api/newsletter/subscribe', {
        method: 'POST',
        body: JSON.stringify({ email: '' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('נא להזין כתובת אימייל');
    });

    it('should return 400 for invalid email format', async () => {
      const request = new NextRequest('http://localhost:3000/api/newsletter/subscribe', {
        method: 'POST',
        body: JSON.stringify({ email: 'invalid-email' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('נא להזין כתובת אימייל תקינה');
    });

    it('should return 400 for email without domain', async () => {
      const request = new NextRequest('http://localhost:3000/api/newsletter/subscribe', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('נא להזין כתובת אימייל תקינה');
    });

    it('should subscribe successfully with valid email', async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { id: 'sub-123' } }),
      });

      const request = new NextRequest('http://localhost:3000/api/newsletter/subscribe', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.message).toBe('נרשמתם בהצלחה לעדכונים!');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('beehiiv.com'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should trim and lowercase email', async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { id: 'sub-123' } }),
      });

      const request = new NextRequest('http://localhost:3000/api/newsletter/subscribe', {
        method: 'POST',
        body: JSON.stringify({ email: '  TEST@EXAMPLE.COM  ' }),
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('test@example.com'),
        })
      );
    });

    it('should return 409 when email is already subscribed', async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ message: 'Email already subscribed' }),
      });

      const request = new NextRequest('http://localhost:3000/api/newsletter/subscribe', {
        method: 'POST',
        body: JSON.stringify({ email: 'existing@example.com' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.message).toBe('כתובת האימייל כבר רשומה לעדכונים');
    });

    it('should return 500 when Beehiiv API fails', async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Internal error' }),
      });

      const request = new NextRequest('http://localhost:3000/api/newsletter/subscribe', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('שגיאה בהרשמה. נסו שוב מאוחר יותר.');
    });

    it('should return 500 when Beehiiv not configured', async () => {
      // Remove Beehiiv config
      delete process.env.BEEHIIV_API_KEY;
      delete process.env.BEEHIIV_PUBLICATION_ID;

      // Re-import to pick up new env
      vi.resetModules();
      const { POST: POST2 } = await import('@/app/api/newsletter/subscribe/route');

      const request = new NextRequest('http://localhost:3000/api/newsletter/subscribe', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
      });
      const response = await POST2(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('שגיאת תצורה. אנא נסו שוב מאוחר יותר.');
    });

    it('should handle network errors gracefully', async () => {
      (global.fetch as Mock).mockRejectedValueOnce(new Error('Network error'));

      const request = new NextRequest('http://localhost:3000/api/newsletter/subscribe', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('שגיאה בהרשמה. נסו שוב מאוחר יותר.');
    });
  });
});
