import { Share, Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { shareVote, shareApp, canShare } from '../../lib/share';

// Mock react-native Share
jest.mock('react-native', () => ({
  Share: {
    share: jest.fn().mockResolvedValue({ action: 'sharedAction' }),
    sharedAction: 'sharedAction',
    dismissedAction: 'dismissedAction',
  },
  Platform: {
    OS: 'ios',
  },
}));

describe('Share Library', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('shareVote', () => {
    it('should share vote with correct title and URL on iOS', async () => {
      const result = await shareVote('vote-123', 'Test Vote Title');

      expect(Share.share).toHaveBeenCalledWith({
        title: 'Test Vote Title',
        message: expect.stringContaining('Test Vote Title'),
        url: 'https://taruu.co.il/votes/vote-123',
      });
      expect(result).toBe(true);
    });

    it('should construct correct vote URL', async () => {
      await shareVote('my-vote-id', 'My Vote');

      expect(Share.share).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://taruu.co.il/votes/my-vote-id',
        })
      );
    });

    it('should include Hebrew message', async () => {
      await shareVote('vote-123', 'Test Vote');

      expect(Share.share).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('בואו להצביע על:'),
        })
      );
    });

    it('should return false when share is dismissed', async () => {
      (Share.share as jest.Mock).mockResolvedValueOnce({ action: 'dismissedAction' });

      const result = await shareVote('vote-123', 'Test Vote');

      expect(result).toBe(false);
    });

    it('should return false on share error', async () => {
      (Share.share as jest.Mock).mockRejectedValueOnce(new Error('Share failed'));

      const result = await shareVote('vote-123', 'Test Vote');

      expect(result).toBe(false);
    });
  });

  describe('shareApp', () => {
    it('should share app with correct content', async () => {
      const result = await shareApp();

      expect(Share.share).toHaveBeenCalledWith({
        title: 'תרו - הצבעות קהילתיות',
        message: expect.stringContaining('taruu.co.il/download'),
        url: 'https://taruu.co.il/download',
      });
      expect(result).toBe(true);
    });

    it('should include Hebrew invitation message', async () => {
      await shareApp();

      expect(Share.share).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('הצטרפו לתרו'),
        })
      );
    });

    it('should return false when share fails', async () => {
      (Share.share as jest.Mock).mockRejectedValueOnce(new Error('Failed'));

      const result = await shareApp();

      expect(result).toBe(false);
    });
  });

  describe('canShare', () => {
    it('should check if sharing is available on native', async () => {
      (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);

      const result = await canShare();

      expect(result).toBe(true);
      expect(Sharing.isAvailableAsync).toHaveBeenCalled();
    });

    it('should return false when sharing is not available', async () => {
      (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(false);

      const result = await canShare();

      expect(result).toBe(false);
    });
  });
});
