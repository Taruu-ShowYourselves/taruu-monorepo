import { useState, useCallback } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { paymentsApi } from '@sync/api-client';
import { PaymentIntent } from '@sync/shared';

export type PaymentType = 'vote' | 'create_vote';

export interface PaymentResult {
  success: boolean;
  cancelled: boolean;
  paymentIntent?: PaymentIntent;
  error?: string;
}

export function usePayment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initiatePayment = useCallback(
    async (
      amount: number,
      type: PaymentType,
      metadata: Record<string, any> = {}
    ): Promise<PaymentResult> => {
      setLoading(true);
      setError(null);

      try {
        // Create payment intent
        const paymentIntent = await paymentsApi.createPaymentIntent({
          amount,
          type,
          metadata,
        });

        // Open payment URL in browser
        const browserResult = await WebBrowser.openBrowserAsync(paymentIntent.paymentUrl, {
          dismissButtonStyle: 'cancel',
          showTitle: true,
          enableDefaultShareMenuItem: false,
        });

        if (browserResult.type === 'cancel') {
          return {
            success: false,
            cancelled: true,
            paymentIntent,
          };
        }

        // At this point, the user has completed the flow in the browser
        // The actual payment confirmation happens via webhook
        // We return success to indicate the flow was completed
        return {
          success: true,
          cancelled: false,
          paymentIntent,
        };
      } catch (err: any) {
        const message = err.message || 'שגיאה בתהליך התשלום';
        setError(message);
        return {
          success: false,
          cancelled: false,
          error: message,
        };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const checkPaymentStatus = useCallback(async (paymentIntentId: string) => {
    try {
      const status = await paymentsApi.getPaymentStatus(paymentIntentId);
      return status;
    } catch (err) {
      console.error('Error checking payment status:', err);
      return null;
    }
  }, []);

  return {
    loading,
    error,
    initiatePayment,
    checkPaymentStatus,
  };
}
