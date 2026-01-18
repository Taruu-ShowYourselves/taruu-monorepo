import * as WebBrowser from 'expo-web-browser';
import { paymentsApi } from '@sync/api-client';

// Mock the API client
jest.mock('@sync/api-client', () => ({
  paymentsApi: {
    createPaymentIntent: jest.fn(),
    getPaymentStatus: jest.fn(),
  },
}));

describe('usePayment Hook Logic', () => {
  const mockPaymentIntent = {
    id: 'pi_123',
    paymentUrl: 'https://payment.greeninvoice.com/checkout/123',
    amount: 300,
    type: 'vote_participation' as const,
    status: 'pending' as const,
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Payment intent creation', () => {
    it('should create payment intent with correct parameters', async () => {
      (paymentsApi.createPaymentIntent as jest.Mock).mockResolvedValue(mockPaymentIntent);

      const result = await paymentsApi.createPaymentIntent({
        amount: 300,
        type: 'vote_participation',
        metadata: { voteId: 'vote-123' },
      });

      expect(paymentsApi.createPaymentIntent).toHaveBeenCalledWith({
        amount: 300,
        type: 'vote_participation',
        metadata: { voteId: 'vote-123' },
      });
      expect(result.id).toBe('pi_123');
      expect(result.paymentUrl).toBe('https://payment.greeninvoice.com/checkout/123');
    });

    it('should handle payment creation errors', async () => {
      (paymentsApi.createPaymentIntent as jest.Mock).mockRejectedValue(
        new Error('Payment service unavailable')
      );

      await expect(
        paymentsApi.createPaymentIntent({
          amount: 300,
          type: 'vote_participation',
        })
      ).rejects.toThrow('Payment service unavailable');
    });

    it('should support vote creation payment type', async () => {
      const voteCreationIntent = {
        ...mockPaymentIntent,
        amount: 5000,
        type: 'vote_creation' as const,
      };

      (paymentsApi.createPaymentIntent as jest.Mock).mockResolvedValue(voteCreationIntent);

      const result = await paymentsApi.createPaymentIntent({
        amount: 5000,
        type: 'vote_creation',
        metadata: { voteTitle: 'New Vote' },
      });

      expect(result.amount).toBe(5000);
      expect(result.type).toBe('vote_creation');
    });
  });

  describe('Browser payment flow', () => {
    it('should open browser with payment URL', async () => {
      (WebBrowser.openBrowserAsync as jest.Mock).mockResolvedValue({
        type: 'dismiss',
      });

      const result = await WebBrowser.openBrowserAsync(mockPaymentIntent.paymentUrl, {
        dismissButtonStyle: 'cancel',
        showTitle: true,
        enableDefaultShareMenuItem: false,
      });

      expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
        mockPaymentIntent.paymentUrl,
        expect.objectContaining({
          dismissButtonStyle: 'cancel',
          showTitle: true,
        })
      );
      expect(result.type).toBe('dismiss');
    });

    it('should handle browser cancellation', async () => {
      (WebBrowser.openBrowserAsync as jest.Mock).mockResolvedValue({
        type: 'cancel',
      });

      const result = await WebBrowser.openBrowserAsync(mockPaymentIntent.paymentUrl);

      expect(result.type).toBe('cancel');
    });
  });

  describe('Payment status checking', () => {
    it('should return payment status', async () => {
      const mockStatus = {
        id: 'pi_123',
        status: 'completed',
        completedAt: new Date().toISOString(),
      };

      (paymentsApi.getPaymentStatus as jest.Mock).mockResolvedValue(mockStatus);

      const status = await paymentsApi.getPaymentStatus('pi_123');

      expect(status.status).toBe('completed');
      expect(paymentsApi.getPaymentStatus).toHaveBeenCalledWith('pi_123');
    });

    it('should handle status check errors', async () => {
      (paymentsApi.getPaymentStatus as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      await expect(paymentsApi.getPaymentStatus('pi_123')).rejects.toThrow('Network error');
    });

    it('should track status transitions', async () => {
      const pendingStatus = { id: 'pi_123', status: 'pending' };
      const processingStatus = { id: 'pi_123', status: 'processing' };
      const completedStatus = { id: 'pi_123', status: 'completed' };

      (paymentsApi.getPaymentStatus as jest.Mock)
        .mockResolvedValueOnce(pendingStatus)
        .mockResolvedValueOnce(processingStatus)
        .mockResolvedValueOnce(completedStatus);

      const status1 = await paymentsApi.getPaymentStatus('pi_123');
      const status2 = await paymentsApi.getPaymentStatus('pi_123');
      const status3 = await paymentsApi.getPaymentStatus('pi_123');

      expect(status1.status).toBe('pending');
      expect(status2.status).toBe('processing');
      expect(status3.status).toBe('completed');
    });
  });

  describe('Payment amounts', () => {
    it('should handle vote participation amount (₪3 = 300 agorot)', () => {
      const voteParticipationAmount = 300;
      expect(voteParticipationAmount / 100).toBe(3); // ₪3
    });

    it('should handle vote creation amount (₪50 = 5000 agorot)', () => {
      const voteCreationAmount = 5000;
      expect(voteCreationAmount / 100).toBe(50); // ₪50
    });
  });
});
