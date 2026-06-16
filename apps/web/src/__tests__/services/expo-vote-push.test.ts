/**
 * Expo vote push-notification helpers — sendVoteResultsNotification /
 * sendNewVoteNotification. The Expo SDK is mocked; this asserts the message
 * shape (title, data.type, channel) and token validation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock('expo-server-sdk', () => ({
  Expo: class {
    static isExpoPushToken(token: string): boolean {
      return typeof token === 'string' && token.startsWith('ExponentPushToken[');
    }
    sendPushNotificationsAsync = sendMock;
    chunkPushNotifications = (messages: unknown[]) => [messages];
  },
}));

import {
  sendVoteResultsNotification,
  sendNewVoteNotification,
  sendBatchNotifications,
} from '@/services/notifications/expo';

const TOKEN = 'ExponentPushToken[abc123]';

describe('Expo vote push helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendMock.mockResolvedValue([{ status: 'ok', id: 'ticket-1' }]);
  });

  it('sends a vote-results notification with the right shape', async () => {
    const res = await sendVoteResultsNotification(TOKEN, {
      voteTitle: 'גינת השכונה',
      voteId: 'v1',
      winningOption: 'בעד',
    });
    expect(res.success).toBe(true);
    const msg = sendMock.mock.calls[0][0][0];
    expect(msg.to).toBe(TOKEN);
    expect(msg.title).toContain('התוצאות');
    expect(msg.data).toMatchObject({ type: 'vote_results', voteId: 'v1', screen: '/votes/v1' });
    expect(msg.channelId).toBe('votes');
  });

  it('sends a new-vote notification with the right shape', async () => {
    const res = await sendNewVoteNotification(TOKEN, {
      voteTitle: 'מעבר חצייה',
      voteId: 'v2',
      municipality: 'קריית טבעון',
    });
    expect(res.success).toBe(true);
    const msg = sendMock.mock.calls[0][0][0];
    expect(msg.data).toMatchObject({ type: 'new_vote', voteId: 'v2' });
    expect(msg.body).toContain('קריית טבעון');
  });

  it('rejects an invalid push token without calling the SDK', async () => {
    const res = await sendVoteResultsNotification('not-a-token', {
      voteTitle: 't',
      voteId: 'v3',
      winningOption: 'x',
    });
    expect(res.success).toBe(false);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('batch-sends to valid tokens and counts invalid ones as failed', async () => {
    const result = await sendBatchNotifications([TOKEN, 'bad'], {
      title: 'x',
      body: 'y',
    });
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
  });
});
