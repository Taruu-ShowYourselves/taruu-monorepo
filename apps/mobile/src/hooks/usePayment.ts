import { useState, useCallback } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { paymentsApi } from '@sync/api-client';
import type { PaymentType } from '@sync/shared';
import type { CreatablePaymentType } from '@sync/shared/contracts';

// Re-export the payment types for convenience: `PaymentType` describes a
// stored payment (a legacy participation row is still one), while only a
// `CreatablePaymentType` can be charged for.
export type { PaymentType, CreatablePaymentType };

/** The payment `POST /api/payments/create` hands back. */
type CreatedPayment = Awaited<ReturnType<typeof paymentsApi.createPaymentIntent>>;

export interface PaymentResult {
  success: boolean;
  cancelled: boolean;
  paymentIntent?: CreatedPayment;
  error?: string;
}

export function usePayment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initiatePayment = useCallback(
    async (
      amount: number,
      type: CreatablePaymentType,
      metadata: Record<string, unknown> = {}
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
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'שגיאה בתהליך התשלום';
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
